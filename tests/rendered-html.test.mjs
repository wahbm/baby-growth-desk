import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const deploymentBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${deploymentBasePath || ""}/`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the personalized database-backed workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>糖糖成长工作台<\/title>/i);
  assert.match(html, /文博文 · 糖糖/);
  assert.match(html, /学习记录/);
  assert.match(html, /健康记录/);
  assert.doesNotMatch(html, /登录工作台|家庭云端|已连接云端/);
  if (deploymentBasePath) {
    assert.match(html, new RegExp(`${deploymentBasePath}/tangtang-avatar\\.png`));
  }
});

test("uses the MariaDB API and only reads localStorage for one-time migration", async () => {
  const [page, layout, serviceWorker, manifest, recordsRoute, database] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    access(new URL("public/tangtang-avatar.png", root)),
  ]);

  assert.match(page, /window\.localStorage\.getItem\(LEGACY_STORAGE_KEY\)/);
  assert.match(page, /window\.localStorage\.removeItem\(LEGACY_STORAGE_KEY\)/);
  assert.doesNotMatch(page, /localStorage\.setItem/);
  assert.match(page, /tangtang-local-desk-v1/);
  assert.match(page, /\/api\/records/);
  assert.match(page, /保存到数据库/);
  assert.match(page, /导出备份/);
  assert.match(page, /导入备份/);
  assert.doesNotMatch(page, /supabase|tt_login/);
  assert.match(recordsRoute, /listRecords/);
  assert.match(recordsRoute, /replaceRecords/);
  assert.match(database, /mysql2\/promise/);
  assert.match(database, /connectionLimit: poolLimit\(\)/);
  assert.match(page, /serviceWorker\.register\(withBasePath\("\/sw\.js"\)/);
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /url\.pathname\.includes\("\/api\/"\)/);
  assert.match(layout, /tangtang-avatar\.png/);
  assert.equal(JSON.parse(manifest).start_url, ".");
  await access(new URL("../dist/standalone/server.js", import.meta.url));
});

test("database health endpoint fails closed when credentials are absent", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("health-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request(`http://localhost${deploymentBasePath || ""}/api/health`),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /数据库尚未完成配置/);
  assert.doesNotMatch(JSON.stringify(body), /DB_PASSWORD|replace-with/);
});

test("records API requires a server-side family session", async () => {
  const originalToken = process.env.APP_ACCESS_TOKEN;
  process.env.APP_ACCESS_TOKEN = "test-only-family-token-123456";
  try {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("auth-test", `${process.pid}-${Date.now()}`);
    const { default: worker } = await import(workerUrl.href);
    const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
    const context = { waitUntil() {}, passThroughOnException() {} };

    const denied = await worker.fetch(new Request(`http://localhost${deploymentBasePath || ""}/api/records`), environment, context);
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).code, "AUTH_REQUIRED");

    const login = await worker.fetch(new Request(`http://localhost${deploymentBasePath || ""}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: process.env.APP_ACCESS_TOKEN }),
    }), environment, context);
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict/);
    assert.doesNotMatch(login.headers.get("set-cookie") ?? "", /test-only-family-token/);
  } finally {
    if (originalToken === undefined) delete process.env.APP_ACCESS_TOKEN;
    else process.env.APP_ACCESS_TOKEN = originalToken;
  }
});
