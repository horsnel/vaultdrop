import {
  Leak,
  Clip,
  Meme,
  APKVersion,
  AdvanceServer,
  TaptapPost,
  LeakCategory,
  ContentStats,
} from './types';

const API_BASE = 'https://vaultdrop-scraper-production.up.railway.app';

async function fetchAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(endpoint, API_BASE);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error);
    throw error;
  }
}

// Paginated response types
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface CategoriesResponse {
  categories: LeakCategory[];
}

interface APKAlertsResponse {
  alerts: APKVersion[];
}

interface AdvanceServersResponse {
  servers: AdvanceServer[];
}

interface TaptapResponse {
  posts: TaptapPost[];
}

interface MemesResponse {
  items: Meme[];
  limit: number;
  offset: number;
}

export async function fetchLeaks(game?: string, category?: string, limit?: number): Promise<Leak[]> {
  const params: Record<string, string> = {};
  if (game) params.game = game;
  if (category) params.category = category;
  if (limit) params.limit = limit.toString();
  const data = await fetchAPI<PaginatedResponse<Leak>>('/leaks', params);
  return data.items || [];
}

export async function fetchLeakCategories(): Promise<LeakCategory[]> {
  const data = await fetchAPI<CategoriesResponse>('/leaks/categories');
  return data.categories || [];
}

export async function fetchClips(game?: string, limit?: number): Promise<Clip[]> {
  const params: Record<string, string> = {};
  if (game) params.game = game;
  if (limit) params.limit = limit.toString();
  const data = await fetchAPI<PaginatedResponse<Clip>>('/clips', params);
  return data.items || [];
}

export async function fetchMemes(game?: string, limit?: number): Promise<Meme[]> {
  const params: Record<string, string> = {};
  if (game) params.game = game;
  if (limit) params.limit = limit.toString();
  const data = await fetchAPI<MemesResponse>('/memes', params);
  return data.items || [];
}

export async function fetchApkAlerts(game?: string): Promise<APKVersion[]> {
  const params: Record<string, string> = {};
  if (game) params.game = game;
  const data = await fetchAPI<APKAlertsResponse>('/apk/alerts', params);
  return data.alerts || [];
}

export async function fetchAdvanceServers(game?: string): Promise<AdvanceServer[]> {
  const params: Record<string, string> = {};
  if (game) params.game = game;
  const data = await fetchAPI<AdvanceServersResponse>('/advance-servers', params);
  return data.servers || [];
}

export async function fetchTaptapPosts(game?: string): Promise<TaptapPost[]> {
  const params: Record<string, string> = {};
  if (game) params.game = game;
  const data = await fetchAPI<TaptapResponse>('/taptap', params);
  return data.posts || [];
}

export async function fetchContent(type?: string, game?: string): Promise<unknown> {
  const params: Record<string, string> = {};
  if (type) params.type = type;
  if (game) params.game = game;
  return fetchAPI('/content', params);
}

export async function fetchStats(): Promise<ContentStats> {
  return fetchAPI<ContentStats>('/stats');
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
