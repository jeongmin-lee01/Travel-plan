// 서비스워커: 한 번 열어 두면 와이파이·데이터 없이도 앱이 열린다.
// 지도 타일은 본 만큼만 저장되므로, 가려는 지역을 미리 한 번 훑어 두면 오프라인에서도 보인다.
const APP_CACHE = 'travel-plan-app-v1'
const RUNTIME_CACHE = 'travel-plan-runtime-v1'
const TILE_LIMIT = 400
const NAV_TIMEOUT_MS = 4000
// 서버가 Vary: Origin을 붙이면 모듈 스크립트 요청(Origin 포함)이 저장본과 안 맞아 오프라인에서 못 찾는다
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE)
      // 첫 방문 때 이미 불러온 JS·CSS도 오프라인에서 쓰도록 index.html에서 파일 목록을 읽어 저장한다
      const res = await fetch('/', { cache: 'reload' })
      const html = await res.clone().text()
      await cache.put('/', res)
      const urls = new Set(['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'])
      for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) urls.add(m[1])
      await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([APP_CACHE, RUNTIME_CACHE])
      for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(k)
}

/** 화면 이동: 네트워크 우선(새 배포를 바로 받음), 느리거나 끊기면 저장본 */
async function navigate(request) {
  const cache = await caches.open(APP_CACHE)
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
    ])
    if (res.ok) cache.put('/', res.clone())
    return res
  } catch {
    return (await cache.match('/', MATCH)) ?? Response.error()
  }
}

/** 저장본을 먼저 보여주고 뒤에서 새로 받아 둔다 */
async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request, MATCH)
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') {
        cache.put(request, res.clone()).then(() => (limit ? trim(cacheName, limit) : undefined))
      }
      return res
    })
    .catch(() => undefined)
  return cached ?? (await refresh) ?? Response.error()
}

/** 파일명에 해시가 붙은 정적 파일: 저장본이 있으면 그대로 */
async function cacheFirst(request) {
  const cache = await caches.open(APP_CACHE)
  const cached = await cache.match(request, MATCH)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
  } else if (url.origin === self.location.origin) {
    event.respondWith(url.pathname.startsWith('/assets/') ? cacheFirst(request) : staleWhileRevalidate(request, APP_CACHE))
  } else if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, TILE_LIMIT))
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    // Pretendard 글꼴
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE))
  }
})
