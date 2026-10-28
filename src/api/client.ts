import { reactive } from 'vue';
import type { Platform, Session, User, Problem } from '../types/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: Problem,
  ) {
    super(
      problem.detail ||
        problem.title ||
        (
          {
            401: '登录已过期，请重新登录',
            403: '当前账户没有操作权限',
            409: '数据状态已变化，请刷新后再试',
            412: '数据已被其他人修改，请刷新后重试',
            429: '操作过于频繁，请稍后重试',
            503: '服务暂不可用，请稍后重试',
          } as Record<number, string>
        )[status] ||
        '请求未完成，请重试',
    );
  }
}
// 访问令牌仅在内存保存；重载页面通过同平台HttpOnly刷新Cookie恢复。
export const auth = reactive<{
  platform: Platform;
  user: User | null;
  token: string;
  csrf: string;
  permissions: string[];
  ready: boolean;
}>({
  platform: 'student',
  user: null,
  token: '',
  csrf: '',
  permissions: [],
  ready: false,
});
let refreshing: {
  platform: Platform;
  epoch: number;
  promise: Promise<boolean>;
} | null = null;
let epoch = 0;
function csrfCookie(platform: Platform) {
  const name = `zx_${platform}_csrf=`;
  const value = document.cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name));
  return value ? decodeURIComponent(value.slice(name.length)) : '';
}
function install(session: Session, expected: Platform) {
  if (session.platform !== expected || session.user.platform !== expected)
    throw new ApiError(403, { detail: '账户所属平台与当前入口不一致' });
  auth.platform = expected;
  auth.token = session.accessToken;
  auth.csrf = session.csrfToken;
  auth.user = session.user;
}
export function forget() {
  epoch++;
  refreshing = null;
  auth.token = '';
  auth.csrf = '';
  auth.user = null;
  auth.permissions = [];
}
export async function refresh(platform = auth.platform): Promise<boolean> {
  const started = epoch;
  if (refreshing?.platform === platform && refreshing.epoch === started) return refreshing.promise;
  const perform = async () => {
    // 等待其他标签页期间可能已退出；获取锁后再读取已轮换的CSRF Cookie。
    if (epoch !== started || auth.platform !== platform) return false;
    const csrf = csrfCookie(platform);
    if (!csrf) return false;
    try {
      const response = await fetch(`/api/v1/auth/${platform}/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (!response.ok) return false;
      const session = (await response.json()) as Session;
      // 离开入口或退出后，旧请求不得恢复已撤销的界面身份。
      if (epoch !== started || auth.platform !== platform) return false;
      install(session, platform);
      return true;
    } catch {
      return false;
    }
  };
  // Web Locks在同源标签间串行化一次性刷新；不广播访问令牌或扩大Cookie范围。
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const promise: Promise<boolean> = Promise.resolve(
    locks ? locks.request(`zx:refresh:${platform}`, perform) : perform(),
  );
  refreshing = { platform, epoch: started, promise };
  try {
    return await promise;
  } finally {
    if (refreshing?.promise === promise) refreshing = null;
  }
}

export async function bootstrap(platform: Platform) {
  if (auth.ready && auth.platform === platform) return;
  forget();
  auth.platform = platform;
  auth.ready = false;
  if (await refresh(platform)) await permissions();
  auth.ready = true;
}
export async function login(platform: Platform, phone: string, password: string, mfaCode?: string) {
  const session = await request<Session>(`/auth/${platform}/login`, {
    method: 'POST',
    body: { phone, password, ...(mfaCode ? { mfaCode } : {}) },
    authenticated: false,
  });
  install(session, platform);
  await permissions();
  auth.ready = true;
}
export async function acceptSession(session: Session, platform: Platform) {
  install(session, platform);
  await permissions();
  auth.ready = true;
}
export async function permissions() {
  auth.permissions = await request<string[]>('/auth/permissions');
}
export async function logout() {
  // 退出必须由服务端撤销刷新族；失败时保留状态让用户重试。
  await request(`/auth/${auth.platform}/logout`, {
    method: 'POST',
    csrf: true,
  });
  forget();
}
export interface RequestOptions {
  method?: string;
  body?: unknown;
  version?: number;
  key?: string;
  csrf?: boolean;
  signal?: AbortSignal;
  authenticated?: boolean;
  query?: Record<string, unknown>;
}
export async function raw(
  path: string,
  options: RequestOptions = {},
  retry = true,
): Promise<Response> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.authenticated !== false && auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.version !== undefined) headers['If-Match'] = `"${options.version}"`;
  // 同一次请求的重试沿用同一键；网络不明时交由调用者保留key，不盲目重发写请求。
  const key = options.key || (method !== 'GET' ? crypto.randomUUID() : undefined);
  if (key) headers['Idempotency-Key'] = key;
  if (options.csrf) headers['X-CSRF-Token'] = auth.csrf || csrfCookie(auth.platform);
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(options.query || {}))
    if (value !== undefined && value !== null && value !== '') query.set(name, String(value));
  const url = `/api/v1${path}${query.size ? `?${query}` : ''}`;
  const response = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  if (
    response.status === 401 &&
    retry &&
    options.authenticated !== false &&
    !path.startsWith('/auth/')
  ) {
    if (await refresh()) return raw(path, { ...options, key }, false);
    forget();
  }
  if (!response.ok) {
    let problem: Problem = {};
    try {
      problem = (await response.json()) as Problem;
    } catch {
      /* 不展示代理返回的HTML。 */
    }
    throw new ApiError(response.status, problem);
  }
  return response;
}
export async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await raw(path, options);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : '操作未完成，请稍后重试';
}
