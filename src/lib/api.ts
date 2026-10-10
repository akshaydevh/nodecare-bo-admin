const CONFIGURED_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

/**
 * Production builds must be pointed at an API explicitly; silently falling back
 * to localhost would make a misconfigured deploy look like an outage.
 */
export const API_CONFIG_ERROR: string | null =
  import.meta.env.PROD && !CONFIGURED_API_BASE
    ? 'VITE_API_BASE_URL is not set for this build. Set it in the hosting environment (for example https://api.example.com/api/v1) and redeploy.'
    : null;

const API_BASE = (CONFIGURED_API_BASE || 'http://localhost:3000/api/v1').replace(/\/+$/, '');

export type AdminUser = {
  id: string;
  phone: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  role: string;
  accountStatus: string;
  mustChangePassword: boolean;
  providerEntityId?: string | null;
  region?: string | null;
  createdAt?: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId: string;
};

/** Standard pagination meta returned alongside list payloads. */
export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId: string;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem('bo_access_token'),
    refreshToken: localStorage.getItem('bo_refresh_token'),
  };
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('bo_access_token', accessToken);
  localStorage.setItem('bo_refresh_token', refreshToken);
}

export function clearStoredTokens() {
  localStorage.removeItem('bo_access_token');
  localStorage.removeItem('bo_refresh_token');
  localStorage.removeItem('bo_user');
}

export function setStoredUser(user: AdminUser) {
  localStorage.setItem('bo_user', JSON.stringify(user));
}

export function getStoredUser(): AdminUser | null {
  const raw = localStorage.getItem('bo_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

let onAuthExpired: (() => void) | null = null;

export function setOnAuthExpired(handler: (() => void) | null) {
  onAuthExpired = handler;
}

function expireSession() {
  clearStoredTokens();
  onAuthExpired?.();
}

function isAuthFailure(status: number, code?: string) {
  if (status !== 401) return false;
  const key = (code ?? '').toUpperCase();
  return (
    key === '' ||
    key === 'UNAUTHORIZED' ||
    key === 'SESSION_INVALID' ||
    key === 'INVALID_REFRESH_TOKEN' ||
    key === 'TOKEN_EXPIRED'
  );
}

function canRecoverSession(path: string, auth: boolean) {
  if (!auth) return false;
  return (
    path !== '/admin/auth/login' &&
    path !== '/admin/auth/refresh' &&
    path !== '/admin/auth/logout'
  );
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = (await res.json()) as ApiSuccess<{
        accessToken: string;
        refreshToken: string;
        user?: AdminUser;
      }> | ApiFailure;
      if (!res.ok || !json.success) return false;
      setStoredTokens(json.data.accessToken, json.data.refreshToken);
      if (json.data.user) setStoredUser(json.data.user);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function recoverOrExpire(path: string, auth: boolean, error: ApiError): Promise<boolean> {
  if (!canRecoverSession(path, auth) || !isAuthFailure(error.status, error.code)) {
    return false;
  }
  const refreshed = await refreshAccessToken();
  if (refreshed) return true;
  expireSession();
  return false;
}

async function parseJson<T>(res: Response): Promise<ApiSuccess<T> | ApiFailure | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiSuccess<T> | ApiFailure;
  } catch {
    return null;
  }
}

function toApiError(res: Response, json: ApiFailure | null): ApiError {
  if (json && !json.success) {
    return new ApiError(res.status, json.error.code, json.error.message);
  }
  return new ApiError(res.status, res.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN', res.statusText || 'Request failed');
}

async function requestEnvelope<T>(
  path: string,
  options: RequestInit,
  auth: boolean,
  retried = false,
): Promise<ApiSuccess<T>> {
  if (API_CONFIG_ERROR) throw new ApiError(0, 'CONFIG_ERROR', API_CONFIG_ERROR);
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const { accessToken } = getStoredTokens();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await parseJson<T>(res);

  if (!res.ok || !json || !json.success) {
    const error = toApiError(res, json && !json.success ? json : null);
    if (!retried) {
      const recovered = await recoverOrExpire(path, auth, error);
      if (recovered) return requestEnvelope<T>(path, options, auth, true);
    } else if (canRecoverSession(path, auth) && isAuthFailure(error.status, error.code)) {
      expireSession();
    }
    throw error;
  }

  return json;
}

async function requestJson<T>(path: string, options: RequestInit, auth: boolean): Promise<T> {
  return (await requestEnvelope<T>(path, options, auth)).data;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  return requestJson<T>(path, options, auth);
}

/** Like apiRequest, but also returns the envelope's `meta` (pagination, summaries). */
export async function apiRequestWithMeta<T, M = PageMeta>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta: M }> {
  const json = await requestEnvelope<T>(path, options, true);
  return { data: json.data, meta: (json.meta ?? {}) as M };
}

export async function apiUploadBinary<T>(path: string, body: Blob, contentType: string): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    },
    true,
  );
}

export async function apiDownloadCsv(path: string, filename: string) {
  if (API_CONFIG_ERROR) throw new ApiError(0, 'CONFIG_ERROR', API_CONFIG_ERROR);
  const run = async () => {
    const headers = new Headers();
    const { accessToken } = getStoredTokens();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`${API_BASE}${path}`, { headers });
  };

  let res = await run();
  if (res.status === 401) {
    const recovered = await recoverOrExpire(path, true, new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    if (recovered) res = await run();
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'EXPORT_FAILED', 'Could not export CSV');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
