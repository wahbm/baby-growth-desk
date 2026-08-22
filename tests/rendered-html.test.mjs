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

test("server-renders the personalized local workbench", async () => {
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

test("uses local-only storage and ships the generated avatar", async () => {
  const [page, layout, serviceWorker, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    access(new URL("public/tangtang-avatar.png", root)),
  ]);

  assert.match(page, /window\.localStorage/);
  assert.match(page, /tangtang-local-desk-v1/);
  assert.match(page, /导出备份/);
  assert.match(page, /导入备份/);
  assert.doesNotMatch(page, /supabase|tt_login|家庭账号/);
  assert.match(page, /serviceWorker\.register\(withBasePath\("\/sw\.js"\)/);
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(layout, /tangtang-avatar\.png/);
  assert.equal(JSON.parse(manifest).start_url, ".");
  await access(new URL("../dist/standalone/server.js", import.meta.url));
});
