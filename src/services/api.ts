// 与 Aurora 后端 /api 交互的最小封装
// 开发环境由 Vite 代理到 http://localhost:3001（见 vite.config.ts）
import type { Track } from '../types';
import type { ContextSnapshot } from '../../shared/contextMix.js';
export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
export const ONLINE_PLAYER_URL = 'https://www.modelscope.cn/studios/Tzm1111/aurora-music?mode=full';
const SESSION_KEY = 'aurora-backend-session:' + API_BASE;
let fallbackSession: string | null = null;
function saveSession(token: string | null) {
  fallbackSession = token;
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* 旧标签页存储可能不可用。 */ }
  } catch {
    try {
      if (token) sessionStorage.setItem(SESSION_KEY, token);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* 禁用存储时仅维持当前页面连接。 */ }
  }
}
function savedSession(): string | null {
  try {
    const token = localStorage.getItem(SESSION_KEY);
    if (token) return token;
    // 迁移之前仅存在于当前标签页的加密凭证。
    try {
      const legacy = sessionStorage.getItem(SESSION_KEY);
      if (legacy) { saveSession(legacy); return legacy; }
    } catch { /* 不影响持久存储。 */ }
    return null;
  } catch {
    try { return sessionStorage.getItem(SESSION_KEY) || fallbackSession; }
    catch { return fallbackSession; }
  }
}
export function apiUrl(path: string) { return API_BASE + path; }
async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const sentSession = savedSession();
  if (sentSession) headers.set('X-Aurora-Session', sentSession);
  const timeout = AbortSignal.timeout(path === '/api/dj/session' ? 55000 : 25000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers, signal, credentials: API_BASE ? 'omit' : 'same-origin' });
  } catch (error) {
    if (init.signal?.aborted) throw error; // 用户取消或搜索切换，不显示网络错误。
    if (timeout.aborted) throw new Error('音乐服务响应超时，请稍后重试。', { cause: error });
    throw new Error('无法连接音乐服务，请检查网络或使用魔搭在线入口。', { cause: error });
  }
  signal.throwIfAborted();
  const token = response.headers?.get('X-Aurora-Session') ?? null;
  // 迟到的状态查询不能覆盖已经保存或清除的新连接。
  if (token !== null && savedSession() === sentSession) saveSession(token || null);
  return response;
}
export async function resolveAudioSource(src: string, signal?: AbortSignal): Promise<string> {
  const match = API_BASE && src.match(/^\/api\/music\/stream\/netease\/(\d+)/);
  if (match) { const result = await apiRequest<{ src: string }>('/api/music/playback/netease/' + match[1], undefined, signal); return apiUrl(result.src); }
  return src.startsWith('/api/') ? apiUrl(src) : src;
}

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
  const res = await apiFetch('/api/music/providers', { signal });
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
  const res = await apiFetch(`/api/music/search?${params.toString()}`, { signal });
  const data = await readJson<SearchResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || `搜索失败（HTTP ${res.status}）`);
  }
  return { tracks: data.tracks ?? [], total: data.total ?? 0 };
}

export type DJPlan = { description: string; label: string; intro: string; queries: string[]; excludeTerms: string[]; instrumental: boolean; artistFocus?: string | null; context?: ContextSnapshot };
export type DJResult = { success: boolean; mode: 'ai' | 'rules'; modelAvailable: boolean; plan: DJPlan; tracks: Track[]; loggedIn: boolean };
export type AccountStatus = { loggedIn: boolean; profile: { nickname: string; avatarUrl: string; vipType: number } | null };
export type ModelStatus = { available: boolean; saved: boolean; provider: string; model: string | null };
async function requestData<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const sentSession = savedSession();
  const response = await apiFetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const data = await readJson<T & { success?: boolean; connectionToken?: string; error?: { message?: string; code?: string } }>(response);
  signal?.throwIfAborted();
  const headerToken = response.headers?.get('X-Aurora-Session') ?? null;
  if (typeof data.connectionToken === 'string' && (savedSession() === sentSession || (headerToken !== null && savedSession() === headerToken))) {
    saveSession(data.connectionToken || null);
  }
  delete data.connectionToken;
  if (!response.ok || data.success === false) throw new Error(data.error?.message || '服务暂时无法连接，请重试。');
  return data;
}
let connectionRequest: Promise<unknown> = Promise.resolve();
export function apiRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const changesConnection = body !== undefined && (path.startsWith('/api/account/') || path.startsWith('/api/dj/model'));
  if (!changesConnection) return requestData<T>(path, body, signal);
  // 扫码确认、保存模型和退出依次使用最新凭证，避免互相覆盖。
  const request = connectionRequest.then(() => requestData<T>(path, body, signal));
  connectionRequest = request.catch(() => {});
  return request;
}
