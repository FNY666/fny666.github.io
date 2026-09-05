from html import escape
from pathlib import Path
import json

root = Path(__file__).parent
raw_games = json.loads((root / 'games.json').read_text())
games = []
for game in raw_games:
    item = dict(game)
    item['category'] = {
        'ARCADE':'格斗', 'MAIN':'格斗', 'VERSUS':'格斗', 'SCORE':'格斗', 'LAB':'格斗',
        'NOVEL':'叙事', 'HERO':'叙事', 'RUN':'动作', 'DEFENSE':'策略', 'MUSIC':'节奏',
        'PUZZLE':'解谜', 'SIMULATION':'模拟', 'SALVAGE':'探索', 'TRADING':'经营',
        'TACTICAL':'策略', 'STEALTH':'潜行', 'NEW':'生存', 'RACING':'竞速',
        'INSPECTION':'模拟', 'RESCUE':'救援', 'DINER':'经营', 'COMPANION':'休闲',
        'PINBALL':'街机', 'SPORTS':'运动', 'SHOOTER':'射击', 'EXPLORER':'探索', 'CASE':'推理',
    }.get(item['pill'], item['pill'])
    item['safe_url'] = escape(item['url'], quote=True)
    for key in ('name','tag','desc','pill','category'):
        item[key] = escape(item[key])
    games.append(item)

by_name = {g['name']: g for g in games}
def pick(name):
    return by_name[name]

hero = pick('霓虹幸存者')
feature_names = ['星港调查员', '星港调度', '量子弹珠']
features = [pick(x) for x in feature_names]

def card(g, index, compact=False):
    extra = ' compact' if compact else ''
    return f'''<a class="game-card cab{extra}" href="{g['safe_url']}" data-category="{g['category']}" aria-label="进入 {g['name']}">
      <div class="card-index">{index:02d}</div>
      <div class="card-signal"></div>
      <div class="card-copy"><span class="card-type">{g['category']} / {g['tag']}</span><h3>{g['name']}</h3><p>{g['desc']}</p></div>
      <span class="card-arrow" aria-hidden="true">↗</span>
    </a>'''

feature_cards = []
for g in features:
    feature_cards.append(f'''<a class="mini-feature cab" href="{g['safe_url']}" data-category="{g['category']}" aria-label="进入 {g['name']}">
      <span class="mini-number">{games.index(next(x for x in games if x['name'] == g['name'])) + 1:02d}</span>
      <div><span class="mini-type">{g['category']} · {g['tag']}</span><h3>{g['name']}</h3><p>{g['desc']}</p></div><b>↗</b>
    </a>''')

categories = []
for g in games:
    if g['category'] not in categories:
        categories.append(g['category'])
category_buttons = ''.join(f'<button class="filter" data-filter="{escape(c)}">{escape(c)}</button>' for c in categories)
catalog = ''.join(card(g, i) for i, g in enumerate(games, 1))

html = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07131d">
<title>星港游戏厅 · NIGHT MARKET</title>
<meta name="description" content="星港游戏厅：深夜宇宙港里的独立街机，选一台，立即开玩。">
<style>
:root{
  --ink:#07131d; --ink-deep:#040b12; --panel:#0c1d28; --panel-2:#102733;
  --cream:#e8e2d0; --muted:#91a7a7; --faint:#5e777b;
  --orange:#f5a85c; --orange-hot:#ffd08a; --mint:#9ce2c3; --cyan:#78cfe0;
  --line:rgba(213,231,218,.15); --line-bright:rgba(245,168,92,.55);
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  --mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--ink-deep)}
body{margin:0;min-width:320px;background:var(--ink-deep);color:var(--cream);font-family:var(--sans);overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;cursor:pointer}
body::before{content:"";position:fixed;z-index:-3;inset:0;background:radial-gradient(ellipse at 50% -12%,#173748 0,transparent 52%),linear-gradient(180deg,#091924 0,#07131d 48%,#040b12 100%)}
body::after{content:"";position:fixed;z-index:-2;inset:0;opacity:.18;pointer-events:none;background-image:linear-gradient(rgba(156,211,205,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(156,211,205,.06) 1px,transparent 1px);background-size:100% 46px,72px 100%;mask-image:linear-gradient(180deg,#000,transparent 72%)}
.shell{width:min(1180px,calc(100% - 40px));margin:0 auto}
.topbar{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:relative;z-index:5}
.brand{display:flex;align-items:center;gap:12px}
.brand-mark{width:32px;height:32px;border:1px solid var(--orange);border-radius:50%;display:grid;place-items:center;position:relative;color:var(--orange);font:700 13px var(--mono);box-shadow:0 0 0 5px rgba(245,168,92,.07)}
.brand-mark::before,.brand-mark::after{content:"";position:absolute;background:var(--orange)}
.brand-mark::before{width:1px;height:42px;top:-6px;left:15px;opacity:.7}.brand-mark::after{height:1px;width:42px;left:-6px;top:15px;opacity:.7}
.brand-text b{display:block;font-size:14px;letter-spacing:.18em;font-weight:800}.brand-text span{display:block;margin-top:4px;color:var(--faint);font:10px var(--mono);letter-spacing:.18em}
.nav{display:flex;align-items:center;gap:23px;color:var(--muted);font-size:12px}.nav a{transition:color .2s}.nav a:hover{color:var(--orange-hot)}
.live{display:flex;align-items:center;gap:8px;color:var(--mint);font:10px var(--mono);letter-spacing:.1em}.live i{width:6px;height:6px;border-radius:50%;background:var(--mint);box-shadow:0 0 12px var(--mint)}
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(420px,.92fr);gap:55px;align-items:center;padding:76px 0 70px;min-height:610px}
.eyebrow{display:flex;align-items:center;gap:12px;color:var(--orange);font:11px var(--mono);letter-spacing:.18em}.eyebrow::before{content:"";width:34px;height:1px;background:var(--orange)}
.hero h1{font-size:clamp(48px,7vw,88px);line-height:1.03;letter-spacing:-.075em;margin:22px 0 20px;font-weight:850;color:var(--cream)}
.hero h1 em{font-style:normal;color:var(--orange);white-space:nowrap}.lede{max-width:460px;color:var(--muted);font-size:15px;line-height:1.9;margin:0}.lede strong{color:var(--cream);font-weight:600}
.hero-actions{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}.action{display:inline-flex;align-items:center;gap:12px;padding:13px 18px;border:1px solid var(--line);font-size:13px;border-radius:3px;transition:.2s}.action.primary{background:var(--orange);border-color:var(--orange);color:var(--ink);font-weight:800}.action:hover{transform:translateY(-3px);border-color:var(--orange)}
.hero-meta{display:flex;gap:29px;margin-top:42px}.hero-meta div{border-left:1px solid var(--line-bright);padding-left:12px}.hero-meta b{display:block;font:700 22px var(--mono);color:var(--cream)}.hero-meta span{display:block;margin-top:5px;color:var(--faint);font-size:10px;letter-spacing:.13em}
.dock{position:relative;min-height:420px;border:1px solid var(--line);background:linear-gradient(145deg,rgba(19,49,61,.86),rgba(7,18,28,.97));overflow:hidden;box-shadow:22px 28px 0 rgba(0,0,0,.12)}
.dock::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 76% 27%,rgba(245,168,92,.22),transparent 4%),radial-gradient(circle at 76% 27%,rgba(245,168,92,.08),transparent 25%),linear-gradient(150deg,transparent 45%,rgba(156,226,195,.04) 45%,transparent 46%),repeating-linear-gradient(90deg,transparent 0 52px,rgba(156,226,195,.05) 53px,transparent 54px);pointer-events:none}
.dock-label{position:absolute;left:22px;top:18px;color:var(--muted);font:10px var(--mono);letter-spacing:.2em}.dock-label::after{content:"  /  03:17 LOCAL";color:var(--faint)}
.star{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--cream);box-shadow:0 0 9px var(--cream);opacity:.7}.s1{top:23%;left:20%}.s2{top:35%;left:44%;width:2px;height:2px}.s3{top:16%;left:62%;width:2px;height:2px}.s4{top:31%;left:86%;width:2px;height:2px}
.horizon{position:absolute;left:0;right:0;bottom:0;height:43%;background:linear-gradient(180deg,transparent,#07151e 23%),linear-gradient(160deg,transparent 48%,rgba(120,207,224,.12) 49%,transparent 50%),linear-gradient(20deg,transparent 48%,rgba(120,207,224,.09) 49%,transparent 50%)}
.horizon::before{content:"";position:absolute;left:0;right:0;bottom:18%;height:1px;background:rgba(156,226,195,.24);box-shadow:0 16px rgba(156,226,195,.08),0 36px rgba(156,226,195,.05)}
.station{position:absolute;left:12%;right:12%;bottom:16%;height:32%;border:1px solid rgba(156,226,195,.18);background:linear-gradient(180deg,rgba(22,51,61,.55),rgba(5,14,21,.9));clip-path:polygon(8% 0,92% 0,100% 100%,0 100%)}
.station::before{content:"";position:absolute;left:10%;right:10%;top:13%;height:5px;background:var(--orange);box-shadow:0 0 22px rgba(245,168,92,.8)}
.station::after{content:"";position:absolute;left:18%;right:18%;top:38%;height:45%;background:repeating-linear-gradient(90deg,rgba(120,207,224,.35) 0 7px,transparent 7px 30px);opacity:.55}
.hero-machine{position:absolute;z-index:2;left:50%;bottom:4%;transform:translateX(-50%);width:47%;height:48%;border:1px solid rgba(232,226,208,.35);background:linear-gradient(100deg,#182d35,#0a141c 65%);clip-path:polygon(13% 0,87% 0,100% 100%,0 100%);box-shadow:0 12px 32px #02070b}.hero-machine::before{content:"";position:absolute;left:11%;right:11%;top:13%;height:46%;background:linear-gradient(135deg,#102a37,#071018);border:5px solid #1b3e49;box-shadow:inset 0 0 35px rgba(120,207,224,.16)}
.machine-glow{position:absolute;z-index:3;left:23%;right:23%;top:25%;height:18%;background:linear-gradient(90deg,transparent,var(--orange),transparent);opacity:.45;filter:blur(8px)}
.machine-screen{position:absolute;z-index:4;left:17%;right:17%;top:19%;height:34%;display:grid;place-items:center;text-align:center;color:var(--orange-hot);font:900 clamp(12px,2vw,20px) var(--mono);letter-spacing:.1em;text-shadow:0 0 14px var(--orange);border:1px solid rgba(120,207,224,.2)}.machine-screen small{display:block;margin-top:7px;color:var(--mint);font-size:8px;letter-spacing:.2em}
.machine-controls{position:absolute;z-index:4;left:21%;right:21%;bottom:17%;height:12%;border-top:1px solid rgba(232,226,208,.25)}.machine-controls::before,.machine-controls::after{content:"";position:absolute;top:9px;width:13px;height:13px;border-radius:50%;background:var(--orange);box-shadow:0 0 10px var(--orange)}.machine-controls::before{left:12%}.machine-controls::after{right:12%;background:var(--mint);box-shadow:0 0 10px var(--mint)}
.dock-copy{position:absolute;z-index:5;left:22px;bottom:20px}.dock-copy span{color:var(--mint);font:10px var(--mono);letter-spacing:.16em}.dock-copy b{display:block;margin-top:5px;font-size:18px}.dock-copy small{color:var(--muted);font-size:11px}
.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;border-top:1px solid var(--line);padding-top:24px;margin-bottom:20px}.section-head h2{margin:0;font-size:25px;letter-spacing:-.04em}.section-head p{margin:0;color:var(--faint);font:10px var(--mono);letter-spacing:.15em}
.featured{padding:5px 0 74px}.feature-layout{display:grid;grid-template-columns:1.16fr .84fr;gap:16px}.feature-main{min-height:275px;position:relative;display:flex;flex-direction:column;justify-content:end;padding:28px;border:1px solid var(--line);background:linear-gradient(120deg,#183747,#0a1822 70%);overflow:hidden;cursor:pointer;transition:.22s}.feature-main:hover{border-color:var(--orange);transform:translateY(-4px)}.feature-main::before{content:"";position:absolute;inset:0;background:linear-gradient(112deg,transparent 45%,rgba(245,168,92,.12) 45.2%,transparent 66%),radial-gradient(circle at 80% 30%,rgba(120,207,224,.28),transparent 19%)}
.feature-main::after{content:"CASE FILE 08  /  NIGHT SHIFT";position:absolute;right:22px;top:20px;color:var(--mint);font:9px var(--mono);letter-spacing:.15em;transform:rotate(90deg);transform-origin:right top;opacity:.7}.feature-kicker{position:relative;color:var(--orange);font:10px var(--mono);letter-spacing:.18em}.feature-main h3{position:relative;margin:12px 0 7px;font-size:34px;letter-spacing:-.05em}.feature-main p{position:relative;margin:0;color:var(--muted);font-size:13px}.feature-main .go{position:absolute;right:25px;bottom:25px;color:var(--orange-hot);font:24px var(--mono)}
.feature-side{display:grid;gap:8px}.mini-feature{display:grid;grid-template-columns:31px 1fr 23px;align-items:center;gap:12px;padding:15px 17px;border:1px solid var(--line);background:rgba(12,29,40,.72);cursor:pointer;transition:.2s}.mini-feature:hover{border-color:var(--orange);transform:translateX(4px)}.mini-number{color:var(--orange);font:11px var(--mono)}.mini-type{display:block;color:var(--faint);font:9px var(--mono);letter-spacing:.08em}.mini-feature h3{margin:4px 0 3px;font-size:15px}.mini-feature p{margin:0;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini-feature>b{color:var(--orange);font:18px var(--mono)}
.catalog{padding-bottom:80px}.filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}.filter{padding:8px 12px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:11px;border-radius:2px;transition:.18s}.filter:hover,.filter.active{color:var(--ink);border-color:var(--orange);background:var(--orange)}.catalog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.game-card{min-height:128px;position:relative;display:flex;align-items:flex-end;padding:17px 19px;border:1px solid var(--line);background:linear-gradient(135deg,rgba(16,39,51,.88),rgba(8,20,29,.88));overflow:hidden;cursor:pointer;transition:.2s}.game-card::before{content:"";position:absolute;right:-28px;top:-35px;width:125px;height:125px;border:1px solid rgba(156,226,195,.13);border-radius:50%;box-shadow:0 0 0 18px rgba(156,226,195,.02),0 0 0 36px rgba(156,226,195,.02)}.game-card:hover{border-color:var(--orange);background:linear-gradient(135deg,rgba(24,57,67,.94),rgba(9,22,30,.94));transform:translateY(-3px)}.game-card[hidden]{display:none}.card-index{position:absolute;left:18px;top:15px;color:var(--faint);font:10px var(--mono)}.card-signal{position:absolute;right:18px;top:18px;width:6px;height:6px;border-radius:50%;background:var(--mint);box-shadow:0 0 9px var(--mint)}.card-copy{position:relative;max-width:90%}.card-type{color:var(--orange);font:9px var(--mono);letter-spacing:.08em}.card-copy h3{font-size:18px;margin:7px 0 6px;letter-spacing:-.035em}.card-copy p{color:var(--muted);font-size:11px;line-height:1.45;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-arrow{position:absolute;right:16px;bottom:16px;color:var(--faint);font:18px var(--mono);transition:.2s}.game-card:hover .card-arrow{color:var(--orange);transform:translate(2px,-2px)}
.empty{grid-column:1/-1;padding:32px;text-align:center;border:1px dashed var(--line);color:var(--muted);font-size:13px}
.footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--line);padding:22px 0 30px;color:var(--faint);font:10px var(--mono);letter-spacing:.08em}.footer b{color:var(--orange);font-weight:500}
.cab:focus-visible,.action:focus-visible,.filter:focus-visible,.nav a:focus-visible{outline:2px solid var(--orange-hot);outline-offset:4px}
@media (max-width:860px){.hero{grid-template-columns:1fr;gap:36px;padding-top:55px}.hero-copy{max-width:650px}.dock{min-height:390px}.feature-layout{grid-template-columns:1fr}.catalog-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.shell{width:min(100% - 28px,1180px)}.topbar{height:65px}.brand-text span{display:none}.nav{gap:13px}.nav a:first-child{display:none}.live{font-size:9px}.hero{padding:48px 0 58px;min-height:0}.hero h1{font-size:clamp(48px,14vw,70px);margin-top:18px}.lede{font-size:14px}.hero-meta{gap:18px;margin-top:32px}.hero-meta b{font-size:18px}.hero-meta span{font-size:9px}.dock{min-height:335px}.dock-label{left:15px}.dock-copy{left:16px;bottom:15px}.dock-copy b{font-size:16px}.hero-machine{width:56%;height:46%}.featured{padding-bottom:55px}.section-head{align-items:start;flex-direction:column;gap:8px}.section-head h2{font-size:23px}.feature-main{min-height:260px;padding:21px}.feature-main h3{font-size:29px}.feature-main::after{font-size:8px;right:17px}.mini-feature{padding:14px}.catalog{padding-bottom:55px}.catalog-grid{grid-template-columns:1fr;gap:7px}.game-card{min-height:108px}.footer{flex-direction:column;gap:8px;padding-bottom:22px}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.action,.feature-main,.mini-feature,.game-card{transition:none}}
</style>
</head>
<body class="scene">
<div class="shell">
  <header class="topbar">
    <a class="brand" href="#top" aria-label="星港游戏厅首页"><span class="brand-mark">09</span><span class="brand-text"><b>星港游戏厅</b><span>STARPORT NIGHT MARKET</span></span></a>
    <nav class="nav" aria-label="主导航"><a href="#featured">精选机台</a><a href="#catalog">全部游戏</a><span class="live"><i></i>OPEN / 24H</span></nav>
  </header>

  <main id="top">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="eyebrow">DOCK 09 / AFTER DARK</div>
        <h1 id="hero-title">今晚，玩点<br><em>不一样的</em></h1>
        <p class="lede">穿过港区最里面那条亮着橙灯的街。这里没有排行榜的喧闹，只有 <strong>一台台等你接管的游戏</strong>。</p>
        <div class="hero-actions"><a class="action primary" href="#featured">逛精选机台 <span>↓</span></a><a class="action" href="#catalog">查看全部 <span>↗</span></a></div>
        <div class="hero-meta"><div><b>''' + str(len(games)).zfill(2) + r'''</b><span>可玩的机台</span></div><div><b>24H</b><span>永远营业</span></div><div><b>1 COIN</b><span>进入游戏</span></div></div>
      </div>
      <div class="dock" aria-label="星港游戏厅夜景">
        <span class="dock-label">PLATFORM 09 / LIVE FEED</span><i class="star s1"></i><i class="star s2"></i><i class="star s3"></i><i class="star s4"></i>
        <div class="horizon"></div><div class="station"></div>
        <div class="hero-machine"><div class="machine-glow"></div><div class="machine-screen">NEON<br>SURVIVORS<small>INSERT COIN / PLAY NOW</small></div><div class="machine-controls"></div></div>
        <div class="dock-copy"><span>NOW PLAYING / 01</span><b>霓虹幸存者</b><small>生存构筑 · 自动开火 · BOSS</small></div>
      </div>
    </section>

    <section id="featured" class="featured" aria-labelledby="featured-title">
      <div class="section-head"><div><h2 id="featured-title">今晚的灯是亮着的</h2></div><p>HANDPICKED FROM THE ARCADE FLOOR</p></div>
      <div class="feature-layout">
        <a class="feature-main cab" href="''' + hero['safe_url'] + r'''" data-category="''' + hero['category'] + r'''" aria-label="进入霓虹幸存者"><span class="feature-kicker">NEW ARRIVAL / SURVIVAL</span><h3>霓虹幸存者</h3><p>把一艘小船开进无尽的夜，升级你的火力，撑到下一波。</p><span class="go">↗</span></a>
        <div class="feature-side">''' + ''.join(feature_cards) + r'''</div>
      </div>
    </section>

    <section id="catalog" class="catalog" aria-labelledby="catalog-title">
      <div class="section-head"><h2 id="catalog-title">机台目录</h2><p>''' + str(len(games)).zfill(2) + r''' GAMES / PICK YOUR FREQUENCY</p></div>
      <div class="filters" role="group" aria-label="按类型筛选"><button class="filter active" data-filter="全部">全部</button>''' + category_buttons + r'''</div>
      <div class="catalog-grid">''' + catalog + r'''<div class="empty" hidden>这一区还没有亮灯，换个频段看看。</div></div>
    </section>
  </main>
  <footer class="footer"><span>STARPORT NIGHT MARKET / <b>OPEN 24 HOURS</b></span><span>SELECT A MACHINE · START YOUR OWN STORY</span></footer>
</div>
<script>
(function(){
  const filters=[...document.querySelectorAll('.filter')], games=[...document.querySelectorAll('.game-card')], empty=document.querySelector('.empty');
  filters.forEach(filter=>filter.addEventListener('click',()=>{const value=filter.dataset.filter;filters.forEach(x=>x.classList.toggle('active',x===filter));let shown=0;games.forEach(game=>{const visible=value==='全部'||game.dataset.category===value;game.hidden=!visible;if(visible)shown++});empty.hidden=shown>0}));
})();
</script>
</body>
</html>
'''
(root / 'arcade.html').write_text(html)
print(f'generated arcade.html with {len(games)} entrances and {len(categories)} categories')
