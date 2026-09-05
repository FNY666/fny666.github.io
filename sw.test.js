// sw.js 行为测试：用 vm 沙箱跑真实的 sw.js，配一套 caches / fetch / self 模拟。
// 覆盖的回归点：离线时 fight.html 必须回退到游戏外壳而不是游戏厅首页；
// 静态资源请求失败时绝不能返回 HTML 外壳。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const ORIGIN = 'https://fny666.github.io';
// 线上已发布的缓存名（https://fny666.github.io/sw.js）。缓存名必须轮换，
// 否则老用户的 activate 不会清掉那份外壳错误的缓存。
const PUBLISHED_VERSION = 'pixel-brawl-v57';

const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function keyOf(req) {
  const raw = typeof req === 'string' ? req : req.url;
  return new URL(raw, ORIGIN + '/').href;
}

function localPath(key) {
  let p = decodeURIComponent(new URL(key).pathname);
  if (p.endsWith('/')) p += 'index.html';
  return path.join(root, p);
}

function makeResponse(body, status) {
  const st = status || 200;
  return {status: st, body, clone: () => makeResponse(body, st), text: () => Promise.resolve(body)};
}

// 模拟服务器：仓库里读得到的文件返回 200，读不到就 404
function serverResponse(key) {
  const file = localPath(key);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  return makeResponse(fs.readFileSync(file, 'utf8'));
}

let fetchImpl;
const onlineFetch = (req) => {
  const resp = serverResponse(keyOf(req));
  return resp ? Promise.resolve(resp) : Promise.reject(new Error('404 ' + keyOf(req)));
};
const offlineFetch = () => Promise.reject(new Error('offline'));

class CacheMock {
  constructor(name) { this.name = name; this.entries = new Map(); }
  addAll(urls) { return Promise.all(urls.map((u) => this.add(u))); }
  add(u) {
    const key = keyOf(u);
    return Promise.resolve().then(() => fetchImpl(key)).then((resp) => {
      if (!resp || resp.status !== 200) throw new Error('precache failed for ' + key);
      return this.put(key, resp);
    });
  }
  put(req, resp) { this.entries.set(keyOf(req), resp); return Promise.resolve(); }
  match(req) {
    const hit = this.entries.get(keyOf(req));
    return Promise.resolve(hit ? hit.clone() : undefined);
  }
}

const store = new Map();
const caches = {
  open(name) {
    if (!store.has(name)) store.set(name, new CacheMock(name));
    return Promise.resolve(store.get(name));
  },
  keys: () => Promise.resolve([...store.keys()]),
  delete(name) { store.delete(name); return Promise.resolve(true); },
  match(req) {
    for (const cache of store.values()) {
      const hit = cache.entries.get(keyOf(req));
      if (hit) return Promise.resolve(hit.clone());
    }
    return Promise.resolve(undefined);
  }
};

const listeners = {};
const sandbox = {
  self: {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    skipWaiting: () => Promise.resolve(),
    clients: {claim: () => Promise.resolve()}
  },
  caches,
  location: {origin: ORIGIN},
  URL,
  Promise,
  console,
  fetch: (req) => fetchImpl(req)
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// sw.js 顶层的 const 不会挂到 globalThis 上，追加一行把它们暴露给测试
vm.runInContext(
  swSource + '\n;globalThis.__VERSION = VERSION; globalThis.__ASSETS = ASSETS;',
  sandbox
);

function fire(type, event) { (listeners[type] || []).forEach((fn) => fn(event)); }

function runInstall() {
  let pending;
  fire('install', {waitUntil: (p) => { pending = p; }});
  return pending;
}

function runFetch(url, mode) {
  let responded;
  fire('fetch', {
    request: {url, mode: mode || 'no-cors', method: 'GET'},
    respondWith: (p) => { responded = p; }
  });
  return responded;
}

async function main() {
  const ASSETS = sandbox.__ASSETS;

  // 1) 预缓存清单里的每一项都必须真实存在，否则 install 直接失败、SW 装不上
  assert.ok(ASSETS.includes('./fight.html'), 'the real game page fight.html must be pre-cached');
  assert.ok(ASSETS.includes('./index.html'), 'the arcade hub must be pre-cached');
  ASSETS.filter((a) => a !== './').forEach((a) => {
    const file = localPath(keyOf(a));
    assert.ok(fs.existsSync(file), 'pre-cached asset must exist on disk: ' + a);
  });

  // 2) 缓存名必须轮换，老缓存才会被 activate 清掉
  assert.notStrictEqual(sandbox.__VERSION, PUBLISHED_VERSION,
    'cache name must rotate away from the published ' + PUBLISHED_VERSION);

  // 3) 联网安装：install 成功并填满缓存
  fetchImpl = onlineFetch;
  await runInstall();
  const cache = await caches.open(sandbox.__VERSION);
  // './' 也会进缓存：GitHub Pages 把目录请求当 index.html 返回 200
  assert.strictEqual(cache.entries.size, ASSETS.length,
    'every pre-cached asset must land in the cache');
  assert.ok(await caches.match(ORIGIN + '/fight.html'), 'fight.html must be in the cache after install');

  // 4) 断网访问游戏页：必须拿到像素乱斗外壳，而不是游戏厅首页
  fetchImpl = offlineFetch;
  const game = await runFetch(ORIGIN + '/fight.html', 'navigate');
  const gameBody = await game.text();
  assert.ok(gameBody.includes('像素乱斗 PIXEL BRAWL'), 'offline game navigation must serve the game shell');
  assert.ok(!gameBody.includes('星港游戏厅 · NEON ARCADE'),
    'offline game navigation must not fall back to the arcade hub');

  // 5) 断网访问根域：拿到游戏厅首页
  const hub = await runFetch(ORIGIN + '/', 'navigate');
  assert.ok((await hub.text()).includes('星港游戏厅'), 'offline root navigation must serve the hub');

  // 6) 断网访问没有预缓存的页面：不拿错误外壳冒充，交给浏览器
  const other = await runFetch(ORIGIN + '/starport-diner.html', 'navigate');
  assert.strictEqual(await other, undefined,
    'an uncached page must not be answered with the wrong shell');

  // 7) 断网请求未缓存的脚本：必须真实失败，绝不能回一段 HTML 回去
  await assert.rejects(runFetch(ORIGIN + '/definitely-not-cached.js', 'no-cors'),
    /offline/, 'a missing subresource must fail as a network error, not resolve to HTML');

  // 8) 断网请求已缓存的脚本：缓存优先仍然生效
  const js = await runFetch(ORIGIN + '/game.js?v=57', 'no-cors');
  assert.ok((await js.text()).length > 1000, 'cached subresources must still be served offline');

  // 9) 联网导航仍是网络优先，并刷新缓存
  fetchImpl = (req) => Promise.resolve(makeResponse('FRESH PAGE', 200));
  const fresh = await runFetch(ORIGIN + '/arcade.html', 'navigate');
  assert.strictEqual(await fresh.text(), 'FRESH PAGE', 'online navigation must be network-first');
  assert.strictEqual(await (await caches.match(ORIGIN + '/arcade.html')).text(), 'FRESH PAGE',
    'a fresh navigation response must update the cache');

  // 10) 跨域与非 GET 请求不被接管
  assert.strictEqual(runFetch('https://example.com/x.js', 'no-cors'), undefined,
    'cross-origin requests must pass through');
  let nonGet;
  fire('fetch', {
    request: {url: ORIGIN + '/game.js?v=57', mode: 'no-cors', method: 'POST'},
    respondWith: (p) => { nonGet = p; }
  });
  assert.strictEqual(nonGet, undefined, 'non-GET requests must pass through');

  console.log('SERVICE-WORKER-OK version=' + sandbox.__VERSION + ' assets=' + ASSETS.length);
}

main().catch((err) => { console.error(err); process.exit(1); });
