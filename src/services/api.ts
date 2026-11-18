// 与 Aurora 后端 /api 交互的最小封装
// 开发环境由 Vite 代理到 http://localhost:3001（见 vite.config.ts）
import type { Track } from '../types';

export type ProviderId = 'local' | 'netease' | 'qq';

export type ProviderStatus = {
  id: ProviderId | string;
  name: string;
  available: boolean;
  detail?: string;
  error?: string | null;
  count?: number;
  configured?: boolean;
};

export type SearchResult = {
  tracks: Track[];
  total: number;
};

type ProvidersResponse = {
  success: boolean;
  providers?: ProviderStatus[];
  error?: { message?: string };
};

type SearchResponse = {
  success: boolean;
  source?: string;
  tracks?: Track[];
  total?: number;
  error?: { message?: string };
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(res.status >= 500 ? '音乐服务暂时无法连接，请稍后重试。' : `接口返回异常（HTTP ${res.status}）`);
  }
}

export async function fetchProviders(signal?: AbortSignal): Promise<ProviderStatus[]> {
  const res = await fetch('/api/music/providers', { signal });
  const data = await readJson<ProvidersResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || '获取音源状态失败');
  }
  return data.providers ?? [];
}

export async function searchTracks(
  source: ProviderId,
  q: string,
  limit = 24,
  signal?: AbortSignal,
  offset = 0
): Promise<SearchResult> {
  const params = new URLSearchParams({ source, q, limit: String(limit), offset: String(offset) });
  const res = await fetch(`/api/music/search?${params.toString()}`, { signal });
  const data = await readJson<SearchResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || `搜索失败（HTTP ${res.status}）`);
  }
  return { tracks: data.tracks ?? [], total: data.total ?? 0 };
}

export type DJPlan = { description: string; label: string; intro: string; queries: string[]; excludeTerms: string[]; instrumental: boolean; artistFocus?: string | null };
export type DJResult = { success: boolean; mode: 'ai' | 'rules'; modelAvailable: boolean; plan: DJPlan; tracks: Track[]; loggedIn: boolean };
export type AccountStatus = { loggedIn: boolean; profile: { nickname: string; avatarUrl: string; vipType: number } | null };
export async function apiRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const data = await readJson<T & { success?: boolean; error?: { message?: string } }>(response);
  if (!response.ok || data.success === false) throw new Error(data.error?.message || '服务暂时无法连接，请重试。');
  return data;
}
