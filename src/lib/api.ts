const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

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
  createdAt?: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (auth) {
    const { accessToken } = getStoredTokens();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (!res.ok || !json.success) {
    const err = json.success
      ? { code: 'UNKNOWN', message: res.statusText }
      : json.error;
    throw new ApiError(res.status, err.code, err.message);
  }

  return json.data;
}
