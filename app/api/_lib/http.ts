import { createHash, timingSafeEqual } from "node:crypto";
import { InputError } from "@/app/lib/records";

const sessionCookie = "tangtang_session";

function accessToken() {
  const token = process.env.APP_ACCESS_TOKEN?.trim();
  if (token && token.length < 16) throw new Error("APP_ACCESS_TOKEN 至少需要 16 个字符");
  return token || null;
}

function sessionDigest(token: string) {
  return createHash("sha256").update(`tangtang-session:${token}`).digest("hex");
}

function equalText(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function apiSessionError(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const expectedHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  if (request.method !== "GET" && origin) {
    try {
      if (new URL(origin).host !== expectedHost) throw new Error("untrusted origin");
    } catch {
      return Response.json({ error: "请求来源不受信任" }, { status: 403 });
    }
  }
  const token = accessToken();
  if (!token) {
    return process.env.NODE_ENV === "production"
      ? Response.json({ error: "服务端尚未配置访问口令" }, { status: 503 })
      : null;
  }
  const actual = cookieValue(request, sessionCookie);
  return equalText(actual, sessionDigest(token))
    ? null
    : Response.json({ error: "请先输入家庭访问口令", code: "AUTH_REQUIRED" }, { status: 401 });
}

export function verifyAccessToken(candidate: unknown) {
  const token = accessToken();
  if (!token) return process.env.NODE_ENV !== "production";
  return typeof candidate === "string" && equalText(candidate, token);
}

export function sessionCookieHeader(request: Request, remove = false) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "/";
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const secure = forwardedProtocol === "https" || new URL(request.url).protocol === "https:";
  const value = remove ? "" : sessionDigest(accessToken() || "development");
  const age = remove ? 0 : 60 * 60 * 24 * 90;
  return `${sessionCookie}=${value}; Path=${basePath}; Max-Age=${age}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function apiError(error: unknown) {
  if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof Error && error.message.startsWith("缺少数据库环境变量")) {
    console.error("[database] MariaDB environment is incomplete");
    return Response.json({ error: "数据库尚未完成配置" }, { status: 503 });
  }
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    if (code === "ER_DUP_ENTRY") return Response.json({ error: "记录 ID 已存在，请刷新后重试" }, { status: 409 });
    if (code.startsWith("ER_") || code === "ECONNREFUSED" || code === "ETIMEDOUT") {
      console.error("[database] MariaDB request failed", code);
      return Response.json({ error: "数据库暂时不可用，请稍后重试" }, { status: 503 });
    }
  }
  console.error("[api] Request failed", error);
  return Response.json({ error: "服务器处理失败，请稍后重试" }, { status: 500 });
}

export function validRecordId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new InputError("记录 ID 格式不正确");
  return id;
}
