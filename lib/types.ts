export interface Leak {
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

export interface Clip {
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

export interface Meme {
  id: number;
  game: string;
  title: string;
  image_url: string;
  source_url: string;
  source_name: string;
  upvotes: number;
}

export interface APKVersion {
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

export interface AdvanceServer {
  id: number;
  game: string;
  server_name: string;
  status: string;
  registration_url: string;
  source_url: string;
  notes: string;
  detected_at: string;
}

export interface TaptapPost {
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

export interface LeakCategory {
  category: string;
  count: number;
}

export interface ContentStats {
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

export type GameName = 'CODM' | 'PUBGM' | 'Free Fire' | 'Blood Strike';

export const GAMES: { name: GameName; color: string; icon: string }[] = [
  { name: 'CODM', color: '#10b981', icon: '🎯' },
  { name: 'PUBGM', color: '#f97316', icon: '🪖' },
  { name: 'Free Fire', color: '#eab308', icon: '🔥' },
  { name: 'Blood Strike', color: '#ef4444', icon: '🩸' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  mythic: '#8b5cf6',
  legendary: '#f59e0b',
  collab: '#3b82f6',
  DMZ: '#ef4444',
  BR: '#10b981',
  meta: '#f97316',
  esports: '#06b6d4',
  test_server: '#ec4899',
  season: '#8b5cf6',
  apk_update: '#3b82f6',
  general: '#6b7280',
};

export const GAME_COLORS: Record<string, string> = {
  CODM: '#10b981',
  PUBGM: '#f97316',
  'Free Fire': '#eab308',
  'Blood Strike': '#ef4444',
};
