/**
 * VaultDrop CloudFlare Worker — Primary API & Scraper
 *
 * This worker serves as:
 * 1. The primary API for the VaultDrop frontend (replaces Railway)
 * 2. A caching layer using Cloudflare KV
 * 3. A scheduled scraper that runs every 15 minutes via Cron
 *
 * API Endpoints:
 * - GET /health              — Health check
 * - GET /leaks               — Paginated leaks (supports ?game=&category=&limit=&offset=)
 * - GET /leaks/categories    — Leak categories with counts
 * - GET /clips               — Paginated clips (supports ?game=&limit=&offset=)
 * - GET /memes               — Paginated memes (supports ?game=&limit=&offset=)
 * - GET /apk/alerts          — APK version alerts (supports ?game=)
 * - GET /advance-servers     — Advance server status (supports ?game=)
 * - GET /taptap              — TapTap posts (supports ?game=)
 * - GET /stats               — Content statistics
 * - GET /content             — General content query (supports ?type=&game=)
 * - POST /scraper/trigger    — Manually trigger a scrape run
 *
 * Scrapers:
 * - Reddit leak scraper (game-specific subreddits + cross-game)
 * - APK Version Monitor (APKMirror for all 4 games)
 * - Advance server status checker
 */

export interface Env {
  VAULTDROP_KV: KVNamespace;
  API_BASE: string; // kept for future use but no longer proxies to Railway
}

// ---- Types ----

interface Leak {
  id: number;
  game: string;
  title: string;
  description: string;
  category: string;
  source_url: string;
  source_name: string;
  thumbnail_url: string;
  media_url: string;
  ai_caption: string;
  severity: string;
  is_verified: boolean;
  created_at: string;
}

interface Clip {
  id: number;
  game: string;
  title: string;
  description: string;
  category: string;
  source_url: string;
  thumbnail_url: string;
  views: number;
  likes: number;
  created_at: string;
}

interface Meme {
  id: number;
  game: string;
  title: string;
  image_url: string;
  source_url: string;
  source_name: string;
  upvotes: number;
}

interface APKVersion {
  id: number;
  game: string;
  package_name: string;
  version_name: string;
  version_code: number;
  source: string;
  source_url: string;
  is_beta: boolean;
  detected_at: string;
}

interface AdvanceServer {
  id: number;
  game: string;
  server_name: string;
  status: string;
  registration_url: string;
  source_url: string;
  notes: string;
  detected_at: string;
}

interface TaptapPost {
  id: number;
  game: string;
  title: string;
  original_title: string;
  content: string;
  language: string;
  source_url: string;
  author: string;
  likes: number;
}

interface LeakCategory {
  category: string;
  count: number;
}

interface ContentStats {
  leaks: number;
  clips: number;
  memes: number;
  apk_versions: number;
  advance_servers: number;
  taptap_posts: number;
  scraper_runs: number;
  by_game: { game: string; count: number }[];
  by_category: { category: string; count: number }[];
}

// ---- Scraping Config ----

const APKMIRROR_APPS: Record<string, { url: string; pkg: string; name: string }> = {
  CODM: {
    url: 'https://www.apkmirror.com/apk/activision-publishing-inc/call-of-duty-mobile/',
    pkg: 'com.activision.callofduty.shooter',
    name: 'Call of Duty: Mobile',
  },
  PUBGM: {
    url: 'https://www.apkmirror.com/apk/proxima-beta/pubg-mobile-arcade-shooting/',
    pkg: 'com.tencent.ig',
    name: 'PUBG Mobile',
  },
  'Free Fire': {
    url: 'https://www.apkmirror.com/apk/garena-online-private/garena-free-fire/',
    pkg: 'com.dts.freefireth',
    name: 'Free Fire',
  },
  'Blood Strike': {
    url: 'https://www.apkmirror.com/apk/netease-games/blood-strike/',
    pkg: 'com.netease.bs',
    name: 'Blood Strike',
  },
};

const REDDIT_SOURCES: Record<string, string[]> = {
  CODM: [
    'https://www.reddit.com/r/CODMobileLeaks/new.json?limit=10',
    'https://www.reddit.com/r/CallOfDutyMobile/new.json?limit=10',
  ],
  PUBGM: [
    'https://www.reddit.com/r/PUBGMobileLeaks/new.json?limit=10',
    'https://www.reddit.com/r/BGMI/new.json?limit=10',
  ],
  'Free Fire': [
    'https://www.reddit.com/r/FreeFireLeaks/new.json?limit=10',
    'https://www.reddit.com/r/freefire/new.json?limit=10',
  ],
  'Blood Strike': [
    'https://www.reddit.com/r/BloodStrike/new.json?limit=10',
  ],
};

const CROSS_GAME_REDDIT = [
  'https://www.reddit.com/r/GamingLeaksAndRumours/search.json?q=codm+OR+pubgm+OR+free+fire+OR+blood+strike&sort=new&limit=10',
];

// Advance server check URLs (official & community sources)
const ADVANCE_SERVER_SOURCES: Record<string, { url: string; name: string }> = {
  CODM: { url: 'https://www.callofduty.com/mobile/test', name: 'CODM Test Server' },
  PUBGM: { url: 'https://www.pubgmobile.com/news', name: 'PUBGM Beta Server' },
  'Free Fire': { url: 'https://ff.advance.garena.com/', name: 'FF Advance Server' },
  'Blood Strike': { url: 'https://bloodstrike.netease.com/', name: 'Blood Strike Beta' },
};

// ---- Category Classification ----

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  mythic: ['mythic', 'mythic draw', 'mythic weapon'],
  legendary: ['legendary', 'legendary draw', 'legendary skin'],
  collab: ['collaboration', 'collab', 'crossover', 'street fighter', 'the boys', 'anime', 'godzilla'],
  DMZ: ['dmz', 'recon', 'extraction', 'wipe', 'reset'],
  BR: ['battle royale', 'br map', 'rebirth', 'resurgence', 'new map'],
  meta: ['buff', 'nerf', 'meta', 'weapon balance', 'patch note'],
  esports: ['world championship', 'esports', 'competitive', 'ranked', 'tournament'],
  test_server: ['test server', 'pts', 'beta', 'advance server', 'unreleased'],
  season: ['season', 'battle pass', 'bp weapon', 'new season'],
};

function classifyCategory(text: string): string {
  const lower = text.toLowerCase();
  let best = 'general';
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

// ---- KV Helpers ----

async function getCached<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.VAULTDROP_KV.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCached(env: Env, key: string, value: unknown, ttl = 900): Promise<void> {
  try {
    await env.VAULTDROP_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (e) {
    console.error(`[Worker] KV write error for ${key}:`, e);
  }
}

// ---- Scraping Functions ----

async function scrapeReddit(gameKey: string, urls: string[]): Promise<Leak[]> {
  const items: Leak[] = [];
  let idCounter = Date.now();

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'VaultDrop/2.0 (Content Aggregator)',
          'Accept': 'application/json',
        },
      });

      if (!resp.ok) continue;

      const data = await resp.json() as any;
      const children = data?.data?.children || [];

      for (const child of children) {
        const post = child.data || {};
        const title = post.title?.trim();
        if (!title) continue;

        const flair = post.link_flair_text || '';
        const category = classifyCategory(title + ' ' + flair);
        const thumbnail = post.thumbnail?.startsWith('http') ? post.thumbnail : '';
        const hasMedia = post.is_video || (post.preview?.images?.length > 0);
        const mediaUrl = hasMedia
          ? (post.url?.startsWith('http') && !post.url.includes('reddit.com') ? post.url : '')
          : '';

        items.push({
          id: idCounter++,
          game: gameKey,
          title,
          description: (post.selftext || '').slice(0, 500),
          category,
          source_url: `https://reddit.com${post.permalink || ''}`,
          source_name: `r/${post.subreddit || 'unknown'}`,
          thumbnail_url: thumbnail,
          media_url: mediaUrl,
          ai_caption: '',
          severity: ['mythic', 'legendary', 'leak', 'datamine', 'beta'].some(kw =>
            title.toLowerCase().includes(kw)
          ) ? 'high' : 'normal',
          is_verified: (post.score || 0) > 50,
          created_at: new Date((post.created_utc || 0) * 1000).toISOString(),
        });
      }
    } catch (e) {
      console.error(`[Worker] Reddit scrape error for ${gameKey}:`, e);
    }
  }

  return items;
}

async function scrapeAPKVersions(): Promise<APKVersion[]> {
  const items: APKVersion[] = [];
  let idCounter = Date.now() + 100000;

  for (const [gameKey, appInfo] of Object.entries(APKMIRROR_APPS)) {
    try {
      const resp = await fetch(appInfo.url, {
        headers: {
          'User-Agent': 'VaultDrop/2.0 (Content Aggregator)',
        },
      });

      if (!resp.ok) continue;

      const html = await resp.text();

      // Extract version numbers from the page
      const versionRegex = /href="\/apk\/[^"]+\/([\d.]+)[^"]*"/g;
      const versions = new Set<string>();
      let match;

      while ((match = versionRegex.exec(html)) !== null) {
        if (match[1] && /^\d/.test(match[1])) {
          versions.add(match[1]);
        }
      }

      for (const version of versions) {
        const isBeta = /beta|test|rc|alpha/i.test(version);

        items.push({
          id: idCounter++,
          game: gameKey,
          package_name: appInfo.pkg,
          version_name: version,
          version_code: parseInt(version.replace(/\./g, ''), 10) || 0,
          source: 'APKMirror',
          source_url: appInfo.url,
          is_beta: isBeta,
          detected_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(`[Worker] APK scrape error for ${gameKey}:`, e);
    }
  }

  return items;
}

async function scrapeAdvanceServers(): Promise<AdvanceServer[]> {
  const items: AdvanceServer[] = [];
  let idCounter = Date.now() + 200000;

  for (const [gameKey, source] of Object.entries(ADVANCE_SERVER_SOURCES)) {
    try {
      const resp = await fetch(source.url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'VaultDrop/2.0 (Content Aggregator)' },
        redirect: 'follow',
      });

      // If the URL responds, we assume the server page is available
      const isOpen = resp.ok || resp.status === 200 || resp.status === 301 || resp.status === 302;

      items.push({
        id: idCounter++,
        game: gameKey,
        server_name: source.name,
        status: isOpen ? 'rumored' : 'closed',
        registration_url: source.url,
        source_url: source.url,
        notes: isOpen
          ? 'Server page accessible — check for registration openings'
          : 'Server page currently unavailable',
        detected_at: new Date().toISOString(),
      });
    } catch {
      items.push({
        id: idCounter++,
        game: gameKey,
        server_name: source.name,
        status: 'unknown',
        registration_url: source.url,
        source_url: source.url,
        notes: 'Could not verify server status',
        detected_at: new Date().toISOString(),
      });
    }
  }

  return items;
}

async function generateClipsFromLeaks(leaks: Leak[]): Promise<Clip[]> {
  // Generate clips from Reddit video posts
  return leaks
    .filter(l => l.media_url && (l.media_url.includes('v.redd.it') || l.media_url.includes('youtu')))
    .map((l, i) => ({
      id: l.id + 300000,
      game: l.game,
      title: l.title,
      description: l.description,
      category: l.category,
      source_url: l.source_url,
      thumbnail_url: l.thumbnail_url,
      views: 0,
      likes: 0,
      created_at: l.created_at,
    }));
}

async function generateMemesFromLeaks(leaks: Leak[]): Promise<Meme[]> {
  // Generate memes from Reddit image posts
  return leaks
    .filter(l => l.thumbnail_url && !l.media_url)
    .map((l) => ({
      id: l.id + 400000,
      game: l.game,
      title: l.title,
      image_url: l.thumbnail_url,
      source_url: l.source_url,
      source_name: l.source_name,
      upvotes: 0,
    }));
}

// ---- Full Scrape Run ----

async function runFullScrape(env: Env): Promise<void> {
  console.log('[Worker] Starting full scrape...');

  const allLeaks: Leak[] = [];
  const allClips: Clip[] = [];
  const allMemes: Meme[] = [];

  // 1. Scrape Reddit for all games
  for (const [gameKey, urls] of Object.entries(REDDIT_SOURCES)) {
    const leaks = await scrapeReddit(gameKey, urls);
    allLeaks.push(...leaks);
  }

  // 2. Scrape cross-game subreddits
  for (const url of CROSS_GAME_REDDIT) {
    const leaks = await scrapeReddit('CODM', [url]); // default to CODM for cross-game
    allLeaks.push(...leaks);
  }

  // 3. Scrape APK versions
  const apkVersions = await scrapeAPKVersions();

  // 4. Scrape advance servers
  const advanceServers = await scrapeAdvanceServers();

  // 5. Derive clips & memes from leaks
  const clips = await generateClipsFromLeaks(allLeaks);
  const memes = await generateMemesFromLeaks(allLeaks);

  // 6. Compute categories
  const categoryMap: Record<string, number> = {};
  for (const leak of allLeaks) {
    categoryMap[leak.category] = (categoryMap[leak.category] || 0) + 1;
  }
  const categories: LeakCategory[] = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
  }));

  // 7. Compute stats
  const gameCountMap: Record<string, number> = {};
  for (const leak of allLeaks) {
    gameCountMap[leak.game] = (gameCountMap[leak.game] || 0) + 1;
  }

  const stats: ContentStats = {
    leaks: allLeaks.length,
    clips: clips.length,
    memes: memes.length,
    apk_versions: apkVersions.length,
    advance_servers: advanceServers.length,
    taptap_posts: 0,
    scraper_runs: 0,
    by_game: Object.entries(gameCountMap).map(([game, count]) => ({ game, count })),
    by_category: categories,
  };

  // 8. Cache everything in KV (15 min TTL)
  await Promise.all([
    setCached(env, 'leaks:all', allLeaks, 900),
    setCached(env, 'clips:all', clips, 900),
    setCached(env, 'memes:all', memes, 900),
    setCached(env, 'apk:alerts', apkVersions, 1800),
    setCached(env, 'advance_servers:all', advanceServers, 1800),
    setCached(env, 'categories:all', categories, 900),
    setCached(env, 'stats', stats, 900),
    setCached(env, 'last_scrape', { timestamp: new Date().toISOString(), items: allLeaks.length }, 900),
  ]);

  console.log(`[Worker] Scrape complete: ${allLeaks.length} leaks, ${apkVersions.length} APK versions, ${advanceServers.length} servers`);
}

// ---- API Query Helpers ----

function filterByGame<T extends { game: string }>(items: T[], game?: string): T[] {
  if (!game) return items;
  return items.filter(item => item.game === game);
}

function paginate<T>(items: T[], limit?: number, offset?: number): { items: T[]; total: number; limit: number; offset: number } {
  const l = limit || 20;
  const o = offset || 0;
  return {
    items: items.slice(o, o + l),
    total: items.length,
    limit: l,
    offset: o,
  };
}

// ---- HTTP Handler ----

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=300', // 5 min browser cache
    },
  });
}

function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // ---- Health Check ----
      if (url.pathname === '/' || url.pathname === '/health') {
        const lastScrape = await getCached<{ timestamp: string; items: number }>(env, 'last_scrape');
        return jsonResponse({
          service: 'VaultDrop API',
          version: '2.0.0',
          status: 'running',
          last_scrape: lastScrape?.timestamp || 'never',
          timestamp: new Date().toISOString(),
        });
      }

      // ---- Leaks ----
      if (url.pathname === '/leaks' || url.pathname === '/leaks/') {
        const allLeaks = await getCached<Leak[]>(env, 'leaks:all') || [];
        const game = url.searchParams.get('game') || undefined;
        const category = url.searchParams.get('category') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        let filtered = filterByGame(allLeaks, game);
        if (category) {
          filtered = filtered.filter(l => l.category === category);
        }

        return jsonResponse(paginate(filtered, limit, offset));
      }

      // ---- Leak Categories ----
      if (url.pathname === '/leaks/categories' || url.pathname === '/leaks/categories/') {
        const categories = await getCached<LeakCategory[]>(env, 'categories:all') || [];
        return jsonResponse({ categories });
      }

      // ---- Clips ----
      if (url.pathname === '/clips' || url.pathname === '/clips/') {
        const allClips = await getCached<Clip[]>(env, 'clips:all') || [];
        const game = url.searchParams.get('game') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        return jsonResponse(paginate(filterByGame(allClips, game), limit, offset));
      }

      // ---- Memes ----
      if (url.pathname === '/memes' || url.pathname === '/memes/') {
        const allMemes = await getCached<Meme[]>(env, 'memes:all') || [];
        const game = url.searchParams.get('game') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '30', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        return jsonResponse({
          items: filterByGame(allMemes, game).slice(offset, offset + limit),
          limit,
          offset,
        });
      }

      // ---- APK Alerts ----
      if (url.pathname === '/apk/alerts' || url.pathname === '/apk/alerts/') {
        const apkAlerts = await getCached<APKVersion[]>(env, 'apk:alerts') || [];
        const game = url.searchParams.get('game') || undefined;

        return jsonResponse({ alerts: filterByGame(apkAlerts, game) });
      }

      // ---- Advance Servers ----
      if (url.pathname === '/advance-servers' || url.pathname === '/advance-servers/') {
        const servers = await getCached<AdvanceServer[]>(env, 'advance_servers:all') || [];
        const game = url.searchParams.get('game') || undefined;

        return jsonResponse({ servers: filterByGame(servers, game) });
      }

      // ---- TapTap (placeholder) ----
      if (url.pathname === '/taptap' || url.pathname === '/taptap/') {
        return jsonResponse({ posts: [] });
      }

      // ---- Content (general query) ----
      if (url.pathname === '/content' || url.pathname === '/content/') {
        const type = url.searchParams.get('type') || undefined;
        const game = url.searchParams.get('game') || undefined;

        // Route to appropriate cached data
        if (type === 'leak') {
          const items = await getCached<Leak[]>(env, 'leaks:all') || [];
          return jsonResponse(filterByGame(items, game));
        }
        if (type === 'clip') {
          const items = await getCached<Clip[]>(env, 'clips:all') || [];
          return jsonResponse(filterByGame(items, game));
        }
        if (type === 'meme') {
          const items = await getCached<Meme[]>(env, 'memes:all') || [];
          return jsonResponse(filterByGame(items, game));
        }
        if (type === 'apk_version') {
          const items = await getCached<APKVersion[]>(env, 'apk:alerts') || [];
          return jsonResponse(filterByGame(items, game));
        }

        // Return all stats if no type specified
        const stats = await getCached<ContentStats>(env, 'stats') || {
          leaks: 0, clips: 0, memes: 0, apk_versions: 0,
          advance_servers: 0, taptap_posts: 0, scraper_runs: 0,
          by_game: [], by_category: [],
        };
        return jsonResponse(stats);
      }

      // ---- Stats ----
      if (url.pathname === '/stats' || url.pathname === '/stats/') {
        const stats = await getCached<ContentStats>(env, 'stats') || {
          leaks: 0, clips: 0, memes: 0, apk_versions: 0,
          advance_servers: 0, taptap_posts: 0, scraper_runs: 0,
          by_game: [], by_category: [],
        };
        return jsonResponse(stats);
      }

      // ---- Manual Scrape Trigger ----
      if (url.pathname === '/scraper/trigger' && request.method === 'POST') {
        ctx.waitUntil(runFullScrape(env));
        return jsonResponse({ message: 'Scrape triggered', timestamp: new Date().toISOString() });
      }

      // Catch-all scraper trigger (compatibility with old endpoint pattern)
      if (url.pathname.startsWith('/scraper/trigger/') && request.method === 'POST') {
        ctx.waitUntil(runFullScrape(env));
        return jsonResponse({ message: 'Scrape triggered', timestamp: new Date().toISOString() });
      }

      // ---- 404 ----
      return errorResponse('Not found', 404);

    } catch (error) {
      console.error('[Worker] Request error:', error);
      return errorResponse('Internal server error', 500);
    }
  },

  // ---- Cron Handler ----
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runFullScrape(env));
  },
};
