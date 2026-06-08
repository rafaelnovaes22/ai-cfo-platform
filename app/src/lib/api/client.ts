const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

const TOKEN_KEY = "aicfo.accessToken";
const REFRESH_KEY = "aicfo.refreshToken";

export class ApiProblem extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(detail ?? title);
    this.name = "ApiProblem";
  }
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {
  clearTokens();
  window.location.href = "/auth";
};

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (isRefreshing) {
    return new Promise((resolve) => refreshQueue.push(resolve));
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      refreshQueue.forEach((cb) => cb(null));
      return null;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    refreshQueue.forEach((cb) => cb(data.accessToken));
    return data.accessToken;
  } catch {
    // Erro de rede no refresh: libera os callers enfileirados (senão suas promises
    // ficariam penduradas para sempre) em vez de deixá-los travados.
    refreshQueue.forEach((cb) => cb(null));
    return null;
  } finally {
    isRefreshing = false;
    refreshQueue = [];
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const isProblem =
    contentType.includes("application/problem+json") || (!res.ok && contentType.includes("application/json"));

  if (!res.ok) {
    if (contentType.includes("application/json") || isProblem) {
      const body = (await res.json()) as {
        title?: string;
        detail?: string;
        errors?: Record<string, string[]>;
      };
      throw new ApiProblem(res.status, body.title ?? res.statusText, body.detail, body.errors);
    }
    throw new ApiProblem(res.status, res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, application/problem+json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !retried) {
    const newToken = await tryRefresh();
    if (!newToken) {
      onUnauthorized();
      throw new ApiProblem(401, "Não autenticado");
    }
    return apiFetch<T>(path, init, true);
  }

  return parseResponse<T>(res);
}

export async function apiUpload<T>(path: string, body: FormData, retried = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json, application/problem+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body });

  // Mesmo tratamento de 401 do apiFetch: tenta refresh e repete uma vez.
  if (res.status === 401 && !retried) {
    const newToken = await tryRefresh();
    if (!newToken) {
      onUnauthorized();
      throw new ApiProblem(401, "Não autenticado");
    }
    return apiUpload<T>(path, body, true);
  }

  return parseResponse<T>(res);
}

// Download de resposta binária (ex.: PDF de export). NÃO usar apiFetch, que faz
// res.json() e corromperia/quebraria o stream binário. Mantém auth + refresh 401.
export async function apiDownload(path: string, retried = false): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers });

  if (res.status === 401 && !retried) {
    const newToken = await tryRefresh();
    if (!newToken) {
      onUnauthorized();
      throw new ApiProblem(401, "Não autenticado");
    }
    return apiDownload(path, true);
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("json")) {
      const b = (await res.json()) as { title?: string; detail?: string };
      throw new ApiProblem(res.status, b.title ?? res.statusText, b.detail);
    }
    throw new ApiProblem(res.status, res.statusText);
  }

  return res.blob();
}
