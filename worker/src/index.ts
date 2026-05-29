/**
 * VaultDrop CloudFlare Worker — Primary API & Scraper
 *
 * Data Storage: GitHub (repos/contents API on a `data` branch)
 * - Reads from raw.githubusercontent.com (fast, CDN-backed)
 * - Writes via GitHub Contents API (PUT commits)
 * - No KV dependency — data is versioned and free
 *
 * Scraping Strategy:
 * - Reddit: Uses OAuth2 client_credentials flow (reddit.com/api/v1/access_token)
 *   to authenticate API requests (avoids 403 blocks on unauthenticated requests)
 * - APKMirror: Moved to GitHub Actions (Cloudflare JS challenge blocks Workers)
 * - Advance Servers: Simple HEAD request check (still works from Workers)
 * - Full scrape also triggered by GitHub Actions every 2 hours
 *
 * API Endpoints:
 * - GET /health              — Health check + last scrape time
 * - GET /leaks               — Paginated leaks (?game=&category=&limit=&offset=)
 * - GET /leaks/categories    — Leak categories with counts
 * - GET /clips               — Paginated clips (?game=&limit=&offset=)
 * - GET /memes               — Paginated memes (?game=&limit=&offset=)
 * - GET /apk/alerts          — APK version alerts (?game=)
 * - GET /advance-servers     — Advance server status (?game=)
 * - GET /taptap              — TapTap posts (?game=)
 * - GET /stats               — Content statistics
 * - GET /content             — General content query (?type=&game=)
 * - POST /scraper/trigger    — Manually trigger a scrape run
 * - POST /scraper/ingest     — Receive scraped data from GitHub Actions
 */

export interface Env {
  GITHUB_TOKEN: string;        // Secret: GitHub PAT for repo read/write
  REPO_OWNER: string;          // e.g. "horsnel"
  REPO_NAME: string;           // e.g. "vaultdrop"
  DATA_BRANCH: string;         // e.g. "data"
  REDDIT_CLIENT_ID: string;    // Secret: Reddit app client ID
  REDDIT_CLIENT_SECRET: string;// Secret: Reddit app client secret
  SCRAPER_SECRET: string;      // Secret: Shared secret for /scraper/ingest auth
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

// ---- GitHub Storage ----

const RAW_BASE = 'https://raw.githubusercontent.com';

function rawUrl(env: Env, path: string): string {
  return `${RAW_BASE}/${env.REPO_OWNER}/${env.REPO_NAME}/${env.DATA_BRANCH}/${path}`;
}

async function readJSON<T>(env: Env, path: string): Promise<T | null> {
  try {
    const resp = await fetch(rawUrl(env, path), {
      headers: { 'User-Agent': 'VaultDrop-Worker/2.0' },
    });
    if (!resp.ok) return null;
    return await resp.json() as T;
  } catch {
    return null;
  }
}

async function writeJSON(env: Env, path: string, data: unknown): Promise<boolean> {
  try {
    const apiBase = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${path}`;

    // Get the current file SHA (needed for update)
    const headResp = await fetch(`${apiBase}?ref=${env.DATA_BRANCH}`, {
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'VaultDrop-Worker/2.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    let sha: string | null = null;
    if (headResp.ok) {
      const headData = await headResp.json() as any;
      sha = headData.sha || null;
    }

    // PUT the file
    const body: Record<string, unknown> = {
      message: `auto: update ${path} [skip ci]`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data)))),
      branch: env.DATA_BRANCH,
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(`${apiBase}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'VaultDrop-Worker/2.0',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return putResp.ok;
  } catch (e) {
    console.error(`[Worker] GitHub write error for ${path}:`, e);
    return false;
  }
}

// ---- Reddit OAuth2 ----

let redditAccessToken: string | null = null;
let redditTokenExpiry = 0;

async function getRedditToken(env: Env): Promise<string | null> {
  // Return cached token if still valid
  if (redditAccessToken && Date.now() < redditTokenExpiry) {
    return redditAccessToken;
  }

  // Reddit OAuth2 client_credentials grant
  const creds = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);

  try {
    const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VaultDrop/2.0 by horsnel',
      },
      body: 'grant_type=client_credentials',
    });

    if (!resp.ok) {
      console.error(`[Worker] Reddit OAuth error: ${resp.status}`);
      return null;
    }

    const data = await resp.json() as any;
    redditAccessToken = data.access_token;
    redditTokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000; // 1 min buffer

    console.log('[Worker] Reddit OAuth token obtained');
    return redditAccessToken;
  } catch (e) {
    console.error('[Worker] Reddit OAuth error:', e);
    return null;
  }
}

// ---- Scraping Config ----

const REDDIT_SOURCES: Record<string, { subreddits: string[]; searchQueries: string[] }> = {
  CODM: {
    subreddits: ['CODMobileLeaks', 'CallOfDutyMobile'],
    searchQueries: ['codm leak', 'cod mobile leak'],
  },
  PUBGM: {
    subreddits: ['PUBGMobileLeaks', 'BGMI'],
    searchQueries: ['pubgm leak', 'pubg mobile leak'],
  },
  'Free Fire': {
    subreddits: ['FreeFireLeaks', 'freefire'],
    searchQueries: ['free fire leak', 'free fire advance server'],
  },
  'Blood Strike': {
    subreddits: ['BloodStrike'],
    searchQueries: ['blood strike leak', 'blood strike update'],
  },
};

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

// ---- Scraping Functions ----

async function scrapeReddit(env: Env, gameKey: string): Promise<Leak[]> {
  const items: Leak[] = [];
  let idCounter = Date.now() + gameKey.length * 10000;

  const config = REDDIT_SOURCES[gameKey];
  if (!config) return items;

  const token = await getRedditToken(env);
  if (!token) {
    console.warn(`[Worker] No Reddit token — skipping ${gameKey}`);
    return items;
  }

  const authHeaders: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'VaultDrop/2.0 by horsnel',
    'Accept': 'application/json',
  };

  // 1. Fetch new posts from each subreddit
  for (const subreddit of config.subreddits) {
    try {
      const url = `https://oauth.reddit.com/r/${subreddit}/new?limit=15`;
      const resp = await fetch(url, { headers: authHeaders });

      if (!resp.ok) {
        console.warn(`[Worker] Reddit r/${subreddit} returned ${resp.status}`);
        continue;
      }

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
      console.error(`[Worker] Reddit scrape error for r/${subreddit}:`, e);
    }
  }

  // 2. Search for game-specific leaks across all of Reddit
  for (const query of config.searchQueries) {
    try {
      const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&sort=new&limit=10&type=link`;
      const resp = await fetch(url, { headers: authHeaders });

      if (!resp.ok) continue;

      const data = await resp.json() as any;
      const children = data?.data?.children || [];

      for (const child of children) {
        const post = child.data || {};
        const title = post.title?.trim();
        if (!title) continue;

        // Avoid duplicates
        if (items.some(i => i.title === title && i.source_name === `r/${post.subreddit}`)) continue;

        const flair = post.link_flair_text || '';
        const category = classifyCategory(title + ' ' + flair);
        const thumbnail = post.thumbnail?.startsWith('http') ? post.thumbnail : '';

        items.push({
          id: idCounter++,
          game: gameKey,
          title,
          description: (post.selftext || '').slice(0, 500),
          category,
          source_url: `https://reddit.com${post.permalink || ''}`,
          source_name: `r/${post.subreddit || 'unknown'}`,
          thumbnail_url: thumbnail,
          media_url: post.url?.startsWith('http') && !post.url.includes('reddit.com') ? post.url : '',
          ai_caption: '',
          severity: ['mythic', 'legendary', 'leak', 'datamine', 'beta'].some(kw =>
            title.toLowerCase().includes(kw)
          ) ? 'high' : 'normal',
          is_verified: (post.score || 0) > 50,
          created_at: new Date((post.created_utc || 0) * 1000).toISOString(),
        });
      }
    } catch (e) {
      console.error(`[Worker] Reddit search error for "${query}":`, e);
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

function deriveClipsFromLeaks(leaks: Leak[]): Clip[] {
  return leaks
    .filter(l => l.media_url && (l.media_url.includes('v.redd.it') || l.media_url.includes('youtu')))
    .map((l) => ({
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

function deriveMemesFromLeaks(leaks: Leak[]): Meme[] {
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

// ---- Full Scrape Run (Worker-side) ----

async function runFullScrape(env: Env): Promise<void> {
  console.log('[Worker] Starting full scrape...');

  const allLeaks: Leak[] = [];

  // 1. Scrape Reddit for all games (using OAuth2)
  for (const gameKey of Object.keys(REDDIT_SOURCES)) {
    const leaks = await scrapeReddit(env, gameKey);
    allLeaks.push(...leaks);
  }

  // 2. Read existing APK data from GitHub (APKMirror scraping is done by GitHub Actions)
  const apkVersions = await readJSON<APKVersion[]>(env, 'apk_alerts.json') || [];

  // 3. Scrape advance servers
  const advanceServers = await scrapeAdvanceServers();

  // 4. Derive clips & memes from leaks
  const clips = deriveClipsFromLeaks(allLeaks);
  const memes = deriveMemesFromLeaks(allLeaks);

  // 5. Compute categories
  const categoryMap: Record<string, number> = {};
  for (const leak of allLeaks) {
    categoryMap[leak.category] = (categoryMap[leak.category] || 0) + 1;
  }
  const categories: LeakCategory[] = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
  }));

  // 6. Compute stats
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

  const lastScrape = {
    timestamp: new Date().toISOString(),
    items: allLeaks.length,
    source: 'worker',
  };

  // 7. Write all data to GitHub data branch
  await Promise.all([
    writeJSON(env, 'leaks.json', allLeaks),
    writeJSON(env, 'clips.json', clips),
    writeJSON(env, 'memes.json', memes),
    writeJSON(env, 'advance_servers.json', advanceServers),
    writeJSON(env, 'categories.json', categories),
    writeJSON(env, 'stats.json', stats),
    writeJSON(env, 'last_scrape.json', lastScrape),
  ]);

  console.log(`[Worker] Scrape complete: ${allLeaks.length} leaks, ${apkVersions.length} APK versions, ${advanceServers.length} servers`);
}

// ---- Ingest Scrape Data from GitHub Actions ----

interface IngestPayload {
  leaks?: Leak[];
  apk_alerts?: APKVersion[];
  advance_servers?: AdvanceServer[];
  source?: string;
}

async function ingestScrapeData(env: Env, payload: IngestPayload): Promise<void> {
  console.log(`[Worker] Ingesting scrape data from ${payload.source || 'external'}`);

  const allLeaks = payload.leaks || [];
  const apkVersions = payload.apk_alerts || [];
  const advanceServers = payload.advance_servers || await scrapeAdvanceServers();
  const clips = deriveClipsFromLeaks(allLeaks);
  const memes = deriveMemesFromLeaks(allLeaks);

  // Compute categories
  const categoryMap: Record<string, number> = {};
  for (const leak of allLeaks) {
    categoryMap[leak.category] = (categoryMap[leak.category] || 0) + 1;
  }
  const categories: LeakCategory[] = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
  }));

  // Compute stats
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

  const lastScrape = {
    timestamp: new Date().toISOString(),
    items: allLeaks.length,
    source: payload.source || 'github-actions',
  };

  await Promise.all([
    writeJSON(env, 'leaks.json', allLeaks),
    writeJSON(env, 'clips.json', clips),
    writeJSON(env, 'memes.json', memes),
    writeJSON(env, 'apk_alerts.json', apkVersions),
    writeJSON(env, 'advance_servers.json', advanceServers),
    writeJSON(env, 'categories.json', categories),
    writeJSON(env, 'stats.json', stats),
    writeJSON(env, 'last_scrape.json', lastScrape),
  ]);

  console.log(`[Worker] Ingest complete: ${allLeaks.length} leaks, ${apkVersions.length} APK versions, ${advanceServers.length} servers`);
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
      'Access-Control-Allow-Headers': 'Content-Type, X-Scraper-Secret',
      'Cache-Control': 'public, max-age=300',
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
          'Access-Control-Allow-Headers': 'Content-Type, X-Scraper-Secret',
        },
      });
    }

    try {
      // ---- Health Check ----
      if (url.pathname === '/' || url.pathname === '/health') {
        const lastScrape = await readJSON<{ timestamp: string; items: number; source: string }>(env, 'last_scrape.json');
        return jsonResponse({
          service: 'VaultDrop API',
          version: '2.1.0',
          status: 'running',
          storage: 'github',
          last_scrape: lastScrape?.timestamp || 'never',
          last_scrape_source: lastScrape?.source || 'none',
          timestamp: new Date().toISOString(),
        });
      }

      // ---- Leaks ----
      if (url.pathname === '/leaks' || url.pathname === '/leaks/') {
        const allLeaks = await readJSON<Leak[]>(env, 'leaks.json') || [];
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
        const categories = await readJSON<LeakCategory[]>(env, 'categories.json') || [];
        return jsonResponse({ categories });
      }

      // ---- Clips ----
      if (url.pathname === '/clips' || url.pathname === '/clips/') {
        const allClips = await readJSON<Clip[]>(env, 'clips.json') || [];
        const game = url.searchParams.get('game') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        return jsonResponse(paginate(filterByGame(allClips, game), limit, offset));
      }

      // ---- Memes ----
      if (url.pathname === '/memes' || url.pathname === '/memes/') {
        const allMemes = await readJSON<Meme[]>(env, 'memes.json') || [];
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
        const apkAlerts = await readJSON<APKVersion[]>(env, 'apk_alerts.json') || [];
        const game = url.searchParams.get('game') || undefined;

        return jsonResponse({ alerts: filterByGame(apkAlerts, game) });
      }

      // ---- Advance Servers ----
      if (url.pathname === '/advance-servers' || url.pathname === '/advance-servers/') {
        const servers = await readJSON<AdvanceServer[]>(env, 'advance_servers.json') || [];
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

        if (type === 'leak') {
          const items = await readJSON<Leak[]>(env, 'leaks.json') || [];
          return jsonResponse(filterByGame(items, game));
        }
        if (type === 'clip') {
          const items = await readJSON<Clip[]>(env, 'clips.json') || [];
          return jsonResponse(filterByGame(items, game));
        }
        if (type === 'meme') {
          const items = await readJSON<Meme[]>(env, 'memes.json') || [];
          return jsonResponse(filterByGame(items, game));
        }
        if (type === 'apk_version') {
          const items = await readJSON<APKVersion[]>(env, 'apk_alerts.json') || [];
          return jsonResponse(filterByGame(items, game));
        }

        const stats = await readJSON<ContentStats>(env, 'stats.json') || {
          leaks: 0, clips: 0, memes: 0, apk_versions: 0,
          advance_servers: 0, taptap_posts: 0, scraper_runs: 0,
          by_game: [], by_category: [],
        };
        return jsonResponse(stats);
      }

      // ---- Stats ----
      if (url.pathname === '/stats' || url.pathname === '/stats/') {
        const stats = await readJSON<ContentStats>(env, 'stats.json') || {
          leaks: 0, clips: 0, memes: 0, apk_versions: 0,
          advance_servers: 0, taptap_posts: 0, scraper_runs: 0,
          by_game: [], by_category: [],
        };
        return jsonResponse(stats);
      }

      // ---- Manual Scrape Trigger (Worker scrapes Reddit directly) ----
      if (url.pathname === '/scraper/trigger' && request.method === 'POST') {
        ctx.waitUntil(runFullScrape(env));
        return jsonResponse({ message: 'Scrape triggered (Worker-side)', timestamp: new Date().toISOString() });
      }

      // Catch-all scraper trigger (compatibility)
      if (url.pathname.startsWith('/scraper/trigger/') && request.method === 'POST') {
        ctx.waitUntil(runFullScrape(env));
        return jsonResponse({ message: 'Scrape triggered (Worker-side)', timestamp: new Date().toISOString() });
      }

      // ---- Ingest Scrape Data from GitHub Actions ----
      if (url.pathname === '/scraper/ingest' && request.method === 'POST') {
        // Verify shared secret
        const providedSecret = request.headers.get('X-Scraper-Secret') || url.searchParams.get('secret') || '';
        if (!env.SCRAPER_SECRET || providedSecret !== env.SCRAPER_SECRET) {
          return errorResponse('Unauthorized: invalid or missing scraper secret', 401);
        }

        const payload = await request.json() as IngestPayload;
        ctx.waitUntil(ingestScrapeData(env, payload));
        return jsonResponse({ message: 'Data ingested', timestamp: new Date().toISOString() });
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
