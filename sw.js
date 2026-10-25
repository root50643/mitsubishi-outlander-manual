/* The build replaces this token whenever the published application changes. */
'use strict';
const BUILD_VERSION = 'bf0b6c9dafe4';
const VERSION = BUILD_VERSION.startsWith('__') ? '20261024-v1' : BUILD_VERSION;
const ROOT = new URL('./', self.location.href);
const CACHE_PREFIX = 'mitsubishi-manual:' + ROOT.pathname + ':';
const SHELL_CACHE = CACHE_PREFIX + 'shell:' + VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + 'pages:' + VERSION;
const RUNTIME_LIMIT = 200 * 1024 * 1024;
let writeQueue = Promise.resolve();
let runtimeIndex;
let runtimeBytes = 0;

function scoped(url) {
  return url.origin === ROOT.origin && url.pathname.startsWith(ROOT.pathname);
}

function cacheKey(input) {
  const url = new URL(typeof input === 'string' ? input : (input.url || input.href), ROOT);
  url.hash = '';
  url.searchParams.delete('_t');
  return url.href;
}

function shellSeeds() {
  const paths = ['./', 'index.html', 'offline.html', 'manifest.webmanifest',
    'mobile.css', 'mobile.js', 'pwa.js', 'icons/icon-192.png',
    'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
  for (const section of ['N5', 'N8']) {
    paths.push('moca/' + section + '/index/index.html');
    for (const name of ['header', 'subheader', 'doctype', 'outline', 'top', 'footer', 'large', 'bookmark']) {
      paths.push('moca/' + section + '/html/' + name + '.html');
    }
    paths.push('moca/' + section + '/css/sie.css');
  }
  return paths.map(path => new URL(path, ROOT).href);
}

/* Follow rendering dependencies only: the thousands of chapter links in the
   outline must never become an automatic whole-manual download. */
function renderingDependencies(text, type, base) {
  const paths = [];
  if (type.includes('text/html')) {
    const tags = text.match(/<(?:script|link|img|iframe)\b[^>]*>/gi) || [];
    for (const tag of tags) {
      const attr = tag.match(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/i);
      if (attr && attr[2]) paths.push(attr[2].replace(/&amp;/g, '&'));
    }
  } else if (type.includes('text/css')) {
    const pattern = /url\(\s*(["']?)([^)"']+)\1\s*\)/gi;
    let match;
    while ((match = pattern.exec(text))) paths.push(match[2].trim());
  }
  return paths.filter(path => !/^(data:|javascript:|#)/i.test(path)).map(path => {
    try { return new URL(path, base); } catch (_) { return null; }
  }).filter(url => url && scoped(url)).map(cacheKey);
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const pending = shellSeeds();
  const seen = new Set();
  while (pending.length) {
    const batch = [];
    while (pending.length && batch.length < 5) {
      const key = cacheKey(pending.shift());
      if (!seen.has(key)) { seen.add(key); batch.push(key); }
    }
    const dependencies = await Promise.all(batch.map(async key => {
      const response = await fetch(new Request(key, { cache: 'reload', credentials: 'same-origin' }));
      if (!response.ok) throw new Error('Cannot prepare offline resource: ' + key);
      const contentType = response.headers.get('content-type') || '';
      const refs = /text\/(html|css)/.test(contentType)
        ? renderingDependencies(await response.clone().text(), contentType, key) : [];
      await cache.put(key, response);
      return refs;
    }));
    for (const refs of dependencies) pending.push(...refs);
  }
}

async function runtimeEntries(cache) {
  const keys = await cache.keys();
  return Promise.all(keys.map(async request => {
    const response = await cache.match(request);
    let bytes = Number(response && response.headers.get('x-manual-cache-bytes'));
    if (!Number.isFinite(bytes) || bytes < 0) {
      bytes = response ? (await response.clone().arrayBuffer()).byteLength : 0;
    }
    return { request, bytes };
  }));
}

async function getRuntimeIndex(cache) {
  if (!runtimeIndex) {
    const entries = await runtimeEntries(cache);
    runtimeIndex = new Map(entries.map(item => [item.request.url, { bytes: item.bytes }]));
    runtimeBytes = entries.reduce((sum, item) => sum + item.bytes, 0);
  }
  return runtimeIndex;
}

function forgetRuntime(key) {
  if (runtimeIndex && runtimeIndex.has(key)) {
    runtimeBytes -= runtimeIndex.get(key).bytes;
    runtimeIndex.delete(key);
  }
}

async function trimRuntime(cache, incomingBytes = 0) {
  const entries = await getRuntimeIndex(cache);
  for (const [key] of entries) {
    if (runtimeBytes + incomingBytes <= RUNTIME_LIMIT) break;
    await cache.delete(key);
    forgetRuntime(key);
  }
  return runtimeBytes;
}

async function putRuntime(key, response) {
  if (!response.ok || response.status !== 200) return;
  const body = await response.arrayBuffer();
  if (body.byteLength > RUNTIME_LIMIT) return;
  const cache = await caches.open(RUNTIME_CACHE);
  await getRuntimeIndex(cache);
  await cache.delete(key); // Re-reading online makes this the newest saved item.
  forgetRuntime(key);
  await trimRuntime(cache, body.byteLength);
  const headers = new Headers(response.headers);
  // Fetch already decoded the body. The synthetic cached response must not
  // retain the server's compressed transfer length or gzip/br encoding.
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding']) headers.delete(name);
  headers.set('x-manual-cache-bytes', String(body.byteLength));
  headers.set('x-manual-cache-saved', String(Date.now()));
  const cachedResponse = new Response(body, { status: response.status, statusText: response.statusText, headers });
  try {
    await cache.put(key, cachedResponse.clone());
  } catch (_) {
    // A browser can impose a smaller device quota. Retry after freeing older
    // runtime content; a cache failure must never break the live response.
    const keys = [...runtimeIndex.keys()];
    for (const oldKey of keys.slice(0, Math.max(1, Math.ceil(keys.length / 4)))) {
      await cache.delete(oldKey);
      forgetRuntime(oldKey);
    }
    try { await cache.put(key, cachedResponse); } catch (_) { return; /* Online still works. */ }
  }
  runtimeIndex.set(key, { bytes: body.byteLength });
  runtimeBytes += body.byteLength;
}

function saveRuntime(event, key, response) {
  writeQueue = writeQueue.catch(() => {}).then(() => putRuntime(key, response)).catch(() => {});
  event.waitUntil(writeQueue);
}

async function findCached(key) {
  const shell = await caches.open(SHELL_CACHE);
  const runtime = await caches.open(RUNTIME_CACHE);
  return (await shell.match(key)) || runtime.match(key);
}

function offlineImage() {
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160"><rect width="640" height="160" fill="#f1f3f5"/><text x="320" y="73" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#414b55">此圖片尚未離線儲存</text><text x="320" y="112" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#58626c">請連上網路後重新開啟</text></svg>', {
    status: 200, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function unavailable(request, image) {
  if (image) return offlineImage();
  if (request.mode === 'navigate' || request.destination === 'document') {
    try {
      const fallback = await (await caches.open(SHELL_CACHE)).match(new URL('offline.html', ROOT).href);
      if (fallback) return fallback;
    } catch (_) { /* Cache access itself may be unavailable on this device. */ }
    return new Response('目前無法取得此章節，且尚未離線儲存。請連上網路後重試。', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  return new Response('Offline resource unavailable', { status: 503 });
}

async function respond(event) {
  const request = event.request;
  const key = cacheKey(request);
  const url = new URL(key);
  const image = request.destination === 'image' || /\.(webp|png|jpe?g|gif|svg|ico)$/i.test(url.pathname);
  let cached;
  try { cached = await findCached(key); } catch (_) { /* The online page must survive disabled storage. */ }
  if (image && cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Shell resources are versioned together. Never duplicate them in the
      // bounded chapter cache, and do not cache partial/error responses.
      let inShell = false;
      try { inShell = !!(await (await caches.open(SHELL_CACHE)).match(key)); } catch (_) {}
      if (!inShell) saveRuntime(event, key, response.clone());
      return response;
    }
    if (cached) return cached;
    if (response.status >= 500) return unavailable(request, image);
    return response;
  } catch (_) {
    if (cached) return cached;
    return unavailable(request, image);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheShell());
  // Updates wait for the reader to choose "更新並重新載入".
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX)
      && name !== SHELL_CACHE && name !== RUNTIME_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !scoped(url) || event.request.headers.has('range')) return;
  event.respondWith(respond(event));
});

self.addEventListener('message', event => {
  const data = event.data || {};
  const reply = value => { if (event.ports && event.ports[0]) event.ports[0].postMessage(value); };
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (data.type === 'GET_STATUS') {
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const entries = await getRuntimeIndex(cache);
      const shell = await caches.open(SHELL_CACHE);
      reply({ ok: true, version: VERSION, ready: !!(await shell.match(new URL('offline.html', ROOT).href)),
        bytes: runtimeBytes, entries: entries.size, limit: RUNTIME_LIMIT });
    });
    event.waitUntil(writeQueue.catch(() => reply({ ok: false, message: '無法讀取離線儲存狀態。' })));
  }
  if (data.type === 'CLEAR_RUNTIME') {
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      await caches.delete(RUNTIME_CACHE);
      runtimeIndex = new Map();
      runtimeBytes = 0;
    });
    event.waitUntil(writeQueue.then(() => reply({ ok: true })).catch(() => reply({ ok: false })));
  }
});
