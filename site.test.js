// 站点结构测试：入口 URL 必须真实存在，根目录不许再堆历史版本快照。
// 回归背景：仓库里曾经积了 21 个 arcade-vN.html / index-vN.html / *-v1.html
// 迭代快照，全部零引用、却照样发布到 fny666.github.io 上。
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const ORIGIN = 'https://fny666.github.io/';
// arcade.html 是游戏厅入口页本身，不在 games.json 的机台列表里
const KNOWN_PAGES = new Set(['arcade.html']);
// 迭代快照命名：arcade-v2.html / index-v53.html / game-v57.js / xxx-v1.html
const SNAPSHOT_NAME = /-v?\d+\.(html|js)$/;

function localPathOf(url) {
  let p = new URL(url, ORIGIN).pathname;
  if (p.endsWith('/')) p += 'index.html';
  return path.join(root, decodeURIComponent(p).replace(/^\/+/, ''));
}

const games = JSON.parse(fs.readFileSync(path.join(root, 'games.json'), 'utf8'));

// 1) games.json 里每个入口 URL 都必须能在仓库里落到真实文件，否则线上就是 404
assert.ok(games.length >= 26, 'games.json should list every cabinet, got ' + games.length);
games.forEach((g) => {
  assert.ok(g.url && g.name, 'every entry needs url + name: ' + JSON.stringify(g));
  const file = localPathOf(g.url);
  assert.ok(fs.existsSync(file), 'cabinet URL must resolve to a real file: ' + g.url);
});

// 2) 根目录每个 .html 要么是游戏厅里的机台，要么是已知的基础设施页面。
//    这条就是拦住「改一版就复制一份 xxx-vN.html」的做法。
const rootPages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const entrances = new Set(games.map((g) => path.basename(localPathOf(g.url))));
const orphans = rootPages.filter((f) => !entrances.has(f) && !KNOWN_PAGES.has(f));
assert.deepStrictEqual(orphans, [],
  'root-level pages must be reachable from the arcade or explicitly known: ' + orphans.join(', '));

// 3) 任何位置都不许出现迭代快照命名
const tracked = fs.readdirSync(root, {recursive: true})
  .map((f) => String(f).replace(/\\/g, '/'))
  .filter((f) => !f.startsWith('.git/') && !f.includes('node_modules'));
const snapshots = tracked.filter((f) => SNAPSHOT_NAME.test(f));
assert.deepStrictEqual(snapshots, [],
  'no iteration snapshots in the repo: ' + snapshots.join(', '));

// 4) arcade.html / index.html 里每个站内链接都必须能落到真实文件
let checkedRefs = 0;
['arcade.html', 'index.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, page + ' should expose href/src refs to check');
  refs.forEach((ref) => {
    if (ref.startsWith('#') || ref.startsWith('mailto:') || ref.startsWith('data:')) return;
    const abs = new URL(ref, ORIGIN);
    if (abs.origin !== new URL(ORIGIN).origin) return; // 外链不归本站结构管
    checkedRefs++;
    const file = localPathOf(ref);
    assert.ok(fs.existsSync(file), page + ' links to a missing file: ' + ref);
  });
});
// 断言 4 不许空转：确实检查过站内链接
assert.ok(checkedRefs >= 30, 'link check must not silently pass on zero refs, got ' + checkedRefs);

console.log(`SITE-STRUCTURE-OK cabinets=${games.length} pages=${rootPages.length}`);
