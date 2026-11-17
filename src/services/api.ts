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
    throw new Error(`接口返回异常（HTTP ${res.status}）`);
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
  signal?: AbortSignal
): Promise<SearchResult> {
  const params = new URLSearchParams({ source, q, limit: String(limit) });
  const res = await fetch(`/api/music/search?${params.toString()}`, { signal });
  const data = await readJson<SearchResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || `搜索失败（HTTP ${res.status}）`);
  }
  return { tracks: data.tracks ?? [], total: data.total ?? 0 };
}
