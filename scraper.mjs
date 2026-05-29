/**
 * VaultDrop GitHub Actions Scraper
 *
 * This script runs in GitHub Actions (where Reddit & APKMirror are accessible)
 * and pushes scraped data to the Cloudflare Worker via /scraper/ingest.
 *
 * Usage: node scraper.mjs
 * Outputs: scrape-data.json (for the ingest step)
 */

import { writeFileSync } from 'fs';

// ---- Config ----

const REDDIT_SOURCES = {
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

const APKMIRROR_APPS = {
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

const ADVANCE_SERVER_SOURCES = {
  CODM: { url: 'https://www.callofduty.com/mobile/test', name: 'CODM Test Server' },
  PUBGM: { url: 'https://www.pubgmobile.com/news', name: 'PUBGM Beta Server' },
  'Free Fire': { url: 'https://ff.advance.garena.com/', name: 'FF Advance Server' },
  'Blood Strike': { url: 'https://bloodstrike.netease.com/', name: 'Blood Strike Beta' },
};

const CATEGORY_KEYWORDS = {
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

// ---- Reddit OAuth2 ----

let accessToken = null;
let tokenExpiry = 0;

async function getRedditToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Scraper] No Reddit credentials — trying unauthenticated...');
    return null;
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

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
    console.error(`[Scraper] Reddit OAuth failed: ${resp.status}`);
    return null;
  }

  const data = await resp.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  console.log('[Scraper] Reddit OAuth token obtained');
  return accessToken;
}

// ---- Category Classification ----

function classifyCategory(text) {
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

async function scrapeReddit() {
  const allLeaks = [];
  let idCounter = Date.now();

  const token = await getRedditToken();

  for (const [gameKey, config] of Object.entries(REDDIT_SOURCES)) {
    const headers = token
      ? {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'VaultDrop/2.0 by horsnel',
          'Accept': 'application/json',
        }
      : {
          'User-Agent': 'VaultDrop/2.0 by horsnel',
          'Accept': 'application/json',
        };

    const baseUrl = token
      ? 'https://oauth.reddit.com'
      : 'https://www.reddit.com';

    // Fetch subreddit new posts
    for (const subreddit of config.subreddits) {
      try {
        const url = `${baseUrl}/r/${subreddit}/new.json?limit=15`;
        const resp = await fetch(url, { headers });

        if (!resp.ok) {
          console.warn(`[Scraper] r/${subreddit} returned ${resp.status}`);
          continue;
        }

        const data = await resp.json();
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

          allLeaks.push({
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
        console.log(`[Scraper] r/${subreddit}: ${children.length} posts fetched`);
      } catch (e) {
        console.error(`[Scraper] Error scraping r/${subreddit}:`, e.message);
      }
    }

    // Search queries
    for (const query of config.searchQueries) {
      try {
        const url = token
          ? `${baseUrl}/search?q=${encodeURIComponent(query)}&sort=new&limit=10&type=link`
          : `${baseUrl}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=10&type=link`;

        const resp = await fetch(url, { headers });
        if (!resp.ok) continue;

        const data = await resp.json();
        const children = data?.data?.children || [];

        for (const child of children) {
          const post = child.data || {};
          const title = post.title?.trim();
          if (!title) continue;
          if (allLeaks.some(i => i.title === title)) continue;

          const flair = post.link_flair_text || '';
          const category = classifyCategory(title + ' ' + flair);
          const thumbnail = post.thumbnail?.startsWith('http') ? post.thumbnail : '';

          allLeaks.push({
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
        console.log(`[Scraper] Search "${query}": done`);
      } catch (e) {
        console.error(`[Scraper] Search error "${query}":`, e.message);
      }
    }
  }

  console.log(`[Scraper] Total Reddit leaks: ${allLeaks.length}`);
  return allLeaks;
}

async function scrapeAPKVersions() {
  const items = [];
  let idCounter = Date.now() + 100000;

  for (const [gameKey, appInfo] of Object.entries(APKMIRROR_APPS)) {
    try {
      const resp = await fetch(appInfo.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
        },
      });

      if (!resp.ok) {
        console.warn(`[Scraper] APKMirror ${gameKey} returned ${resp.status}`);
        continue;
      }

      const html = await resp.text();

      // Extract version numbers from the page
      const versionRegex = /href="\/apk\/[^"]+\/([\d.]+)[^"]*"/g;
      const versions = new Set();
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

      console.log(`[Scraper] APKMirror ${gameKey}: ${versions.size} versions found`);
    } catch (e) {
      console.error(`[Scraper] APKMirror error for ${gameKey}:`, e.message);
    }
  }

  return items;
}

async function scrapeAdvanceServers() {
  const items = [];
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

// ---- Main ----

async function main() {
  console.log('[Scraper] Starting GitHub Actions scrape...');

  const [leaks, apkAlerts, advanceServers] = await Promise.all([
    scrapeReddit(),
    scrapeAPKVersions(),
    scrapeAdvanceServers(),
  ]);

  const payload = {
    leaks,
    apk_alerts: apkAlerts,
    advance_servers: advanceServers,
    source: 'github-actions',
    timestamp: new Date().toISOString(),
  };

  writeFileSync('scrape-data.json', JSON.stringify(payload, null, 2));
  console.log(`[Scraper] Data written to scrape-data.json`);
  console.log(`[Scraper] Done: ${leaks.length} leaks, ${apkAlerts.length} APK versions, ${advanceServers.length} servers`);
}

main().catch(e => {
  console.error('[Scraper] Fatal error:', e);
  process.exit(1);
});
