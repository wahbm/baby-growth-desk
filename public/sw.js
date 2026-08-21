const CACHE_PREFIX = "tangtang-workbench-";
const CACHE_NAME = CACHE_PREFIX + "v8";
const CORE_URLS = ["/", "/manifest.webmanifest", "/tangtang-avatar.png"];

async function cacheFirstVisit() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await fetch(new Request("/", { cache: "reload" }));
  if (!rootResponse.ok) throw new Error("首页暂时不可用");
  await cache.put("/", rootResponse.clone());

  const html = await rootResponse.text();
  const discovered = new Set(CORE_URLS.slice(1));
  const matcher = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = matcher.exec(html))) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname !== "/og.png") {
      discovered.add(url.pathname + url.search);
    }
  }

  await Promise.all(Array.from(discovered).map(async (url) => {
    try {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (response.ok) await cache.put(url, response);
    } catch {
      // A nonessential asset may fail without blocking offline installation.
    }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheFirstVisit().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put("/", response.clone());
        return response;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
