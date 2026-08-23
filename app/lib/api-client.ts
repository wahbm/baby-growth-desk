import { withBasePath } from "./base-path";

export class ApiRequestError extends Error {
  constructor(message: string, public status: number, public code = "") {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(withBasePath(path), {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (!response.ok) throw new ApiRequestError(body.error || "请求失败，请稍后重试", response.status, body.code);
  return body as T;
}
