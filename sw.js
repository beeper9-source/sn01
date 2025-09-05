// 서비스 워커 - 오프라인 지원 및 캐싱
const CACHE_NAME = 'chamber-attendance-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/logo.png'
];

// 설치 이벤트
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('캐시 열기');
        return cache.addAll(urlsToCache);
      })
  );
});

// 페치 이벤트
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // 캐시에서 찾으면 반환
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// 활성화 이벤트
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
