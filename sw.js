// 星港游戏厅 Service Worker：安装后可离线游玩
'use strict';

// 缓存名轮换后，activate 会清掉旧的 pixel-brawl-v57 缓存
// （那份缓存里的离线外壳是过期的首页，见 git 历史）。
const VERSION = 'starport-arcade-v1';
const CACHE_NAME = VERSION;

// 离线外壳：根域首页是游戏厅，像素乱斗机台页是 fight.html，两者各自回退。
const SHELL_HUB = './index.html';
const SHELL_GAME = './fight.html';

// 注意：必须与 fight.html 中引用的资源版本号一致
const ASSETS = [
  './',
  './index.html',
  './arcade.html',
  './fight.html',
  './style.css?v=17',
  './game.js?v=57',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 一个导航请求离线时应该回退到哪个外壳。
// 非导航请求（JS / CSS / 图片）返回 null：绝不把 HTML 外壳当作脚本或样式返回，
// 那会让浏览器报 SyntaxError 或渲染成破图，而不是干净地失败重试。
function offlineShellFor(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/index.html' || path === '/arcade.html') return SHELL_HUB;
  if (path === '/fight.html') return SHELL_GAME;
  return null;
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 仅接管本站请求；其余透传
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  // 页面导航：网络优先（保证拿到最新版），离线退回该页面对应的外壳
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return resp;
      }).catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          const shell = offlineShellFor(url);
          return shell ? caches.match(shell) : undefined;
        })
      )
    );
    return;
  }

  // 静态资源：缓存优先，未命中则走网络并顺手缓存。
  // 网络失败时不再回退成 HTML —— 让请求真实失败，交给浏览器处理。
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
