from html import escape
from pathlib import Path
import json

ROOT = Path(__file__).parent
games = json.loads((ROOT / 'games.json').read_text())
CATEGORY = {
    'ARCADE':'格斗', 'MAIN':'格斗', 'VERSUS':'格斗', 'SCORE':'格斗', 'LAB':'格斗',
    'NOVEL':'叙事', 'HERO':'叙事', 'RUN':'动作', 'DEFENSE':'策略', 'MUSIC':'节奏',
    'PUZZLE':'解谜', 'SIMULATION':'模拟', 'SALVAGE':'探索', 'TRADING':'经营',
    'TACTICAL':'策略', 'STEALTH':'潜行', 'NEW':'生存', 'RACING':'竞速',
    'INSPECTION':'模拟', 'RESCUE':'救援', 'DINER':'经营', 'COMPANION':'休闲',
    'PINBALL':'街机', 'SPORTS':'运动', 'SHOOTER':'射击', 'EXPLORER':'探索', 'CASE':'推理',
}
for game in games:
    game['category'] = CATEGORY.get(game['pill'], game['pill'])

by_name = {game['name']: game for game in games}
def game(name):
    return by_name[name]

def safe(game):
    return {key: escape(str(game[key]), quote=True) for key in ('url','name','tag','desc','pill','category')}

def signal_card(g, index):
    g = safe(g)
    return f'''<a class="signal-card cab" href="{g['url']}" data-category="{g['category']}" data-name="{g['name']}" data-tag="{g['tag']}" aria-label="锁定并进入 {g['name']}">
      <span class="signal-id">SIG-{index:02d}</span><span class="signal-dot"></span>
      <span class="signal-type">{g['category']} / {g['tag']}</span><strong>{g['name']}</strong><small>{g['desc']}</small><span class="signal-enter">OPEN <b>↗</b></span>
    </a>'''

def mini_card(g, index):
    g = safe(g)
    return f'''<a class="relay-card cab" href="{g['url']}" data-category="{g['category']}" data-name="{g['name']}" data-tag="{g['tag']}" aria-label="锁定并进入 {g['name']}">
      <span class="relay-id">SIG-{index:02d}</span><span><em>{g['category']} · {g['tag']}</em><strong>{g['name']}</strong><small>{g['desc']}</small></span><b class="relay-arrow">↗</b>
    </a>'''

hero_game = game('霓虹幸存者')
feature_games = [game('星港调查员'), game('星港调度'), game('量子弹珠')]
categories = []
for g in games:
    if g['category'] not in categories:
        categories.append(g['category'])
filters = ''.join(f'<button class="filter" data-filter="{escape(c)}">{escape(c)}</button>' for c in categories)
catalog = ''.join(signal_card(g, i) for i, g in enumerate(games, 1))
relays = ''.join(mini_card(g, next(i for i, x in enumerate(games, 1) if x['name'] == g['name'])) for g in feature_games)
hero = safe(hero_game)

html = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#020711">
<title>星港游戏厅 · ARCADE OS 09</title>
<meta name="description" content="星港游戏厅 ARCADE OS 09：正在运行的未来街机信号站，锁定一台游戏开始。">
<style>
:root{
  --void:#020711;--deep:#040d1b;--glass:rgba(5,18,35,.72);--glass-2:rgba(8,28,48,.82);
  --cyan:#59f3ff;--cyan-dim:#2a899d;--violet:#9b7cff;--pink:#ff4fbd;--lime:#a8ffcf;
  --amber:#ffc15c;--white:#e6f7ff;--muted:#7192a9;--faint:#3d5c72;
  --line:rgba(89,243,255,.22);--mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
}
*{box-sizing:border-box}
html{background:var(--void);scroll-behavior:smooth}
body{margin:0;min-width:320px;overflow-x:hidden;background:var(--void);color:var(--white);font-family:var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;cursor:pointer}
#starfield{position:fixed;z-index:0;inset:0;width:100%;height:100%;background:#020711;pointer-events:none}
.scanline{position:fixed;z-index:4;inset:0;pointer-events:none;opacity:.18;mix-blend-mode:screen;background:repeating-linear-gradient(180deg,rgba(89,243,255,.06) 0 1px,transparent 1px 5px)}
.vignette{position:fixed;z-index:1;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 35%,transparent 20%,rgba(1,5,12,.2) 62%,rgba(1,4,9,.88) 100%)}
.page{position:relative;z-index:2;width:min(1320px,calc(100% - 48px));margin:0 auto}
.hud-top{height:72px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:relative}
.brand{display:flex;align-items:center;gap:12px}.brand-orbit{width:32px;height:32px;border:1px solid var(--cyan);border-radius:50%;display:grid;place-items:center;color:var(--cyan);font:700 11px var(--mono);position:relative;box-shadow:0 0 18px rgba(89,243,255,.35)}
.brand-orbit:before,.brand-orbit:after{content:"";position:absolute;border:1px solid var(--cyan-dim);border-radius:50%;transform:rotate(45deg)}.brand-orbit:before{inset:-6px 6px}.brand-orbit:after{inset:6px -6px}.brand-text b{display:block;font-size:14px;letter-spacing:.18em}.brand-text small{display:block;color:var(--faint);font:9px var(--mono);letter-spacing:.18em;margin-top:4px}
.system-status{display:flex;align-items:center;gap:16px;color:var(--muted);font:10px var(--mono);letter-spacing:.12em}.system-status i{width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 12px var(--lime)}.system-status b{color:var(--lime);font-weight:500}
.hero{min-height:calc(100vh - 72px);display:grid;grid-template-columns:minmax(330px,.8fr) minmax(500px,1.2fr);gap:42px;align-items:center;padding:48px 0 78px;position:relative}
.hero-copy{position:relative;z-index:3}.overline{display:flex;align-items:center;gap:12px;color:var(--cyan);font:11px var(--mono);letter-spacing:.2em}.overline:before{content:"";width:38px;height:1px;background:var(--cyan);box-shadow:0 0 12px var(--cyan)}
.hero h1{font-size:clamp(48px,6.4vw,92px);line-height:.98;letter-spacing:-.08em;margin:22px 0 20px;font-weight:900;color:var(--white);text-shadow:0 0 28px rgba(89,243,255,.12)}.hero h1 span{display:block;color:var(--cyan);text-shadow:0 0 18px rgba(89,243,255,.65),3px 0 rgba(255,79,189,.22)}
.hero-lede{max-width:445px;color:var(--muted);font-size:15px;line-height:1.85;margin:0}.hero-lede b{color:var(--white);font-weight:600}.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:27px}.action{display:inline-flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--line);background:rgba(5,18,33,.72);color:var(--white);font-size:12px;letter-spacing:.08em;transition:.2s}.action.primary{background:var(--cyan);border-color:var(--cyan);color:#02101a;font-weight:900;box-shadow:0 0 24px rgba(89,243,255,.22)}.action:hover{transform:translateY(-3px);border-color:var(--cyan);box-shadow:0 0 20px rgba(89,243,255,.18)}
.hero-stats{display:flex;gap:25px;margin-top:37px}.hero-stats div{border-left:1px solid var(--violet);padding-left:11px}.hero-stats b{display:block;color:var(--white);font:700 19px var(--mono)}.hero-stats small{display:block;color:var(--faint);font:9px var(--mono);letter-spacing:.1em;margin-top:5px}
.hero-stage{height:min(620px,70vw);min-height:470px;position:relative;display:grid;place-items:center;perspective:1000px}.stage-label,.stage-coordinate{position:absolute;z-index:5;color:var(--muted);font:9px var(--mono);letter-spacing:.15em}.stage-label{top:3%;left:2%}.stage-label:before{content:"◈ ";color:var(--pink)}.stage-coordinate{right:2%;bottom:4%;color:var(--cyan-dim)}
.holo-console{width:min(650px,94%);aspect-ratio:1.15;position:relative;transform:rotateX(10deg) rotateY(-5deg);transform-style:preserve-3d;filter:drop-shadow(0 22px 35px rgba(0,0,0,.7))}.console-ring{position:absolute;inset:5%;border:1px solid rgba(89,243,255,.32);border-radius:50%;transform:rotateX(67deg);box-shadow:0 0 0 18px rgba(89,243,255,.025),0 0 0 42px rgba(89,243,255,.022),inset 0 0 32px rgba(89,243,255,.13)}.console-ring:before,.console-ring:after{content:"";position:absolute;inset:10%;border:1px dashed rgba(155,124,255,.28);border-radius:50%}.console-ring:after{inset:27%;border-style:solid;border-color:rgba(255,79,189,.28)}
.console-grid{position:absolute;inset:12% 4% 11%;overflow:hidden;background:linear-gradient(rgba(89,243,255,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(89,243,255,.11) 1px,transparent 1px),radial-gradient(ellipse at 50% 45%,rgba(26,109,138,.26),transparent 52%);background-size:35px 35px,35px 35px,100% 100%;transform:rotateX(58deg) scale(1.03);transform-origin:center bottom;border:1px solid rgba(89,243,255,.18);box-shadow:inset 0 0 50px rgba(1,8,17,.85)}
.console-grid:after{content:"";position:absolute;left:-20%;right:-20%;top:44%;height:2px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);box-shadow:0 0 18px var(--cyan);animation:scan 3.4s linear infinite}@keyframes scan{0%{transform:translateY(-170px);opacity:0}16%,72%{opacity:.8}100%{transform:translateY(190px);opacity:0}}
.radar{position:absolute;z-index:3;width:52%;aspect-ratio:1;left:24%;top:16%;border:1px solid rgba(89,243,255,.38);border-radius:50%;background:radial-gradient(circle,rgba(89,243,255,.13) 0 2%,transparent 2.5% 25%,rgba(89,243,255,.18) 25.2% 25.5%,transparent 25.7% 49%,rgba(89,243,255,.18) 49.2% 49.5%,transparent 49.7% 74%,rgba(89,243,255,.18) 74.2% 74.5%,transparent 74.7%),linear-gradient(90deg,transparent 49.7%,rgba(89,243,255,.18) 50%,transparent 50.3%),linear-gradient(0deg,transparent 49.7%,rgba(89,243,255,.18) 50%,transparent 50.3%);box-shadow:0 0 30px rgba(89,243,255,.15),inset 0 0 40px rgba(89,243,255,.08);animation:float 6s ease-in-out infinite}@keyframes float{50%{transform:translateY(-7px) scale(1.02)}}
.radar:before{content:"";position:absolute;inset:-2px;background:conic-gradient(from 0deg,transparent 0 74%,rgba(89,243,255,.55) 80%,transparent 86%);border-radius:50%;animation:radar-spin 4s linear infinite}@keyframes radar-spin{to{transform:rotate(360deg)}}.radar:after{content:"TARGET LOCK";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:var(--pink);font:9px var(--mono);letter-spacing:.16em;white-space:nowrap;text-shadow:0 0 9px var(--pink)}
.target{position:absolute;z-index:5;width:10px;height:10px;border:1px solid var(--pink);box-shadow:0 0 14px var(--pink);animation:blink 1.2s infinite}.target:before,.target:after{content:"";position:absolute;background:var(--pink)}.target:before{height:1px;width:22px;left:-7px;top:4px}.target:after{width:1px;height:22px;left:4px;top:-7px}.t1{left:35%;top:32%}.t2{left:68%;top:59%;border-color:var(--lime);box-shadow:0 0 14px var(--lime);animation-delay:.4s}.t3{left:27%;top:70%;border-color:var(--amber);box-shadow:0 0 14px var(--amber);animation-delay:.8s}@keyframes blink{50%{opacity:.25;transform:scale(.7)}}
.console-frame{position:absolute;z-index:4;inset:2%;border:1px solid rgba(89,243,255,.2);clip-path:polygon(6% 0,94% 0,100% 7%,100% 93%,94% 100%,6% 100%,0 93%,0 7%)}.console-frame:before,.console-frame:after{content:"";position:absolute;width:45px;height:45px;border-color:var(--cyan);border-style:solid}.console-frame:before{left:-1px;top:-1px;border-width:1px 0 0 1px}.console-frame:after{right:-1px;bottom:-1px;border-width:0 1px 1px 0}
.telemetry{position:absolute;z-index:7;padding:9px 11px;border:1px solid rgba(89,243,255,.22);background:rgba(2,10,20,.74);backdrop-filter:blur(6px);font:9px/1.7 var(--mono);letter-spacing:.08em;color:var(--muted)}.telemetry b{display:block;color:var(--cyan);font-size:10px}.telemetry span{color:var(--faint)}.telemetry.left{left:0;top:26%}.telemetry.right{right:0;top:39%;text-align:right}.telemetry.bottom{left:10%;bottom:7%}
.lock-panel{position:absolute;z-index:9;left:50%;bottom:8%;transform:translateX(-50%);width:min(380px,78%);padding:11px 15px;border:1px solid rgba(255,79,189,.45);background:linear-gradient(90deg,rgba(22,7,30,.86),rgba(4,15,28,.9));box-shadow:0 0 22px rgba(255,79,189,.1);display:flex;align-items:center;gap:13px}.lock-icon{width:27px;height:27px;border:1px solid var(--pink);display:grid;place-items:center;color:var(--pink);font:13px var(--mono)}.lock-panel small{display:block;color:var(--pink);font:8px var(--mono);letter-spacing:.15em}.lock-panel strong{display:block;font-size:15px;margin-top:2px}.lock-panel em{margin-left:auto;color:var(--lime);font:9px var(--mono);font-style:normal}
.section{padding:40px 0 92px}.section-title{display:flex;align-items:end;justify-content:space-between;gap:20px;border-top:1px solid var(--line);padding-top:19px;margin-bottom:20px}.section-title h2{margin:0;font-size:27px;letter-spacing:-.05em}.section-title p{margin:0;color:var(--faint);font:10px var(--mono);letter-spacing:.14em}.relay{display:grid;grid-template-columns:1.1fr .9fr;gap:9px;margin-bottom:55px}.relay-main{min-height:225px;position:relative;display:flex;flex-direction:column;justify-content:end;padding:25px;border:1px solid rgba(89,243,255,.33);background:radial-gradient(circle at 78% 24%,rgba(89,243,255,.3),transparent 3%,transparent 22%),linear-gradient(135deg,rgba(12,48,69,.95),rgba(6,16,29,.92));overflow:hidden;transition:.22s}.relay-main:before{content:"";position:absolute;inset:0;background:linear-gradient(125deg,transparent 41%,rgba(89,243,255,.1) 41.2%,transparent 59%),repeating-linear-gradient(90deg,transparent 0 48px,rgba(89,243,255,.05) 49px,transparent 50px)}.relay-main:hover{border-color:var(--pink);box-shadow:0 0 30px rgba(255,79,189,.12);transform:translateY(-3px)}.relay-main .kicker{position:relative;color:var(--pink);font:10px var(--mono);letter-spacing:.16em}.relay-main h3{position:relative;margin:9px 0 5px;font-size:32px}.relay-main p{position:relative;color:var(--muted);font-size:13px;margin:0}.relay-main .arrow{position:absolute;right:22px;bottom:20px;color:var(--pink);font:28px var(--mono)}.relay-side{display:grid;gap:9px}.relay-card{display:grid;grid-template-columns:54px 1fr 25px;align-items:center;gap:10px;padding:15px;border:1px solid rgba(89,243,255,.19);background:rgba(5,20,35,.75);transition:.2s}.relay-card:hover{border-color:var(--cyan);background:rgba(8,34,54,.9);transform:translateX(4px)}.relay-id{color:var(--violet);font:10px var(--mono)}.relay-card em{display:block;color:var(--faint);font:9px var(--mono);font-style:normal;letter-spacing:.06em}.relay-card strong{display:block;font-size:16px;margin:4px 0 3px}.relay-card small{display:block;color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.relay-arrow{color:var(--cyan);font:20px var(--mono)}
.signal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.signal-card{min-height:145px;position:relative;padding:18px;border:1px solid rgba(89,243,255,.16);background:linear-gradient(140deg,rgba(8,29,47,.84),rgba(3,12,23,.9));overflow:hidden;transition:.2s}.signal-card:before{content:"";position:absolute;right:-28px;top:-30px;width:125px;height:125px;border:1px solid rgba(89,243,255,.11);border-radius:50%;box-shadow:0 0 0 18px rgba(89,243,255,.018),0 0 0 37px rgba(89,243,255,.015)}.signal-card:hover{border-color:var(--cyan);box-shadow:0 0 24px rgba(89,243,255,.12);transform:translateY(-4px)}.signal-card:hover .signal-dot{box-shadow:0 0 16px var(--pink);background:var(--pink)}.signal-card[hidden]{display:none}.signal-id{color:var(--faint);font:9px var(--mono);letter-spacing:.12em}.signal-dot{position:absolute;right:18px;top:19px;width:6px;height:6px;border-radius:50%;background:var(--lime);box-shadow:0 0 9px var(--lime);transition:.2s}.signal-type{display:block;color:var(--cyan);font:9px var(--mono);letter-spacing:.08em;margin-top:21px}.signal-card strong{display:block;font-size:19px;margin:7px 0 5px}.signal-card small{display:block;max-width:83%;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.signal-enter{position:absolute;right:17px;bottom:16px;color:var(--faint);font:9px var(--mono)}.signal-enter b{color:var(--cyan);font-size:16px;margin-left:5px}
.filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}.filter{padding:8px 12px;color:var(--muted);background:rgba(4,16,28,.75);border:1px solid rgba(89,243,255,.17);font-size:11px;transition:.18s}.filter:hover,.filter.active{color:#02101a;background:var(--cyan);border-color:var(--cyan);box-shadow:0 0 14px rgba(89,243,255,.25)}.empty{grid-column:1/-1;padding:30px;text-align:center;border:1px dashed var(--line);color:var(--muted);font:12px var(--mono)}
.footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--line);padding:20px 0 30px;color:var(--faint);font:9px var(--mono);letter-spacing:.09em}.footer b{color:var(--lime);font-weight:500}
.cab:focus-visible,.action:focus-visible,.filter:focus-visible{outline:2px solid var(--pink);outline-offset:4px}
@media (max-width:900px){.hero{grid-template-columns:1fr;gap:20px;padding-top:42px}.hero-copy{max-width:690px}.hero-stage{height:540px}.signal-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.page{width:calc(100% - 28px)}.hud-top{height:62px}.brand-text small{display:none}.system-status{gap:8px;font-size:8px}.system-status span:first-of-type{display:none}.hero{min-height:0;padding:42px 0 48px}.hero h1{font-size:clamp(49px,15vw,70px);margin-top:18px}.hero-lede{font-size:14px}.hero-stats{gap:17px;margin-top:29px}.hero-stats b{font-size:16px}.hero-stage{height:435px;min-height:435px;margin:0 -7px}.holo-console{width:100%;transform:rotateX(8deg) rotateY(-3deg)}.telemetry{font-size:8px;padding:7px 8px}.telemetry.left{left:0;top:18%}.telemetry.right{right:0;top:36%}.telemetry.bottom{left:4%;bottom:3%}.lock-panel{bottom:4%;width:83%;padding:9px 11px}.lock-panel strong{font-size:13px}.stage-coordinate{font-size:8px}.section{padding:25px 0 58px}.section-title{align-items:start;flex-direction:column;gap:8px}.section-title h2{font-size:24px}.relay{grid-template-columns:1fr;margin-bottom:40px}.relay-main{min-height:220px;padding:20px}.relay-main h3{font-size:29px}.relay-card{padding:13px}.signal-grid{grid-template-columns:1fr;gap:7px}.signal-card{min-height:118px}.footer{flex-direction:column;gap:8px}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.console-grid:after,.console-ring,.radar,.radar:before,.target{animation:none!important}.action,.relay-main,.relay-card,.signal-card{transition:none}}
</style>
</head>
<body class="scene">
<canvas id="starfield" aria-hidden="true"></canvas><div class="vignette"></div><div class="scanline"></div>
<div class="page">
  <header class="hud-top"><a class="brand" href="#top" aria-label="星港游戏厅首页"><span class="brand-orbit">09</span><span class="brand-text"><b>星港游戏厅</b><small>ARCADE OS / NIGHT TERMINAL</small></span></a><div class="system-status"><span>UPLINK 09.77.21</span><span><i></i> SYSTEM <b>ONLINE</b></span></div></header>
  <main id="top">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><div class="overline">PORT 09 / UNAUTHORIZED FUN</div><h1 id="hero-title">接入<br><span>黑夜信号</span></h1><p class="hero-lede">这里不是游戏列表。<br>这是星港深夜仍在运行的 <b>29 个游戏信号</b>，等你锁定下一次跃迁。</p><div class="hero-actions"><a class="action primary" href="#signals">扫描全部信号 <span>↓</span></a><a class="action" href="__HERO_URL__">接入新信号 <span>↗</span></a></div><div class="hero-stats"><div><b>29</b><small>ACTIVE SIGNALS</small></div><div><b>24 / 7</b><small>UPLINK STATUS</small></div><div><b>01 COIN</b><small>TO INITIALIZE</small></div></div></div>
      <div class="hero-stage"><span class="stage-label">HOLOGRAPHIC COMMAND DECK / LIVE</span><span class="stage-coordinate">X 09.771 · Y 44.203 · Z 00.013</span><div class="holo-console"><div class="console-frame"></div><div class="console-ring"></div><div class="console-grid"></div><div class="radar"><i class="target t1"></i><i class="target t2"></i><i class="target t3"></i></div><div class="telemetry left"><b>FIELD / NIGHT-09</b><span>PARTICLES 128<br>DRIFT 0.0037</span></div><div class="telemetry right"><b>LOCK / ACTIVE</b><span>WAVEFORM: STABLE<br>LATENCY: 12ms</span></div><div class="telemetry bottom"><b>SCAN BEAM  ∿∿∿</b><span>SEARCHING FOR PLAYERS</span></div><a class="lock-panel cab" href="__HERO_URL__" data-name="霓虹幸存者" data-tag="NEON SURVIVORS" aria-label="锁定并进入霓虹幸存者"><span class="lock-icon">⌁</span><span><small>TARGET LOCKED / NEW SIGNAL</small><strong id="lock-name">霓虹幸存者</strong></span><em>READY ↗</em></a></div></div>
    </section>
    <section class="section" id="featured" aria-labelledby="relay-title"><div class="section-title"><h2 id="relay-title">锁定后的第一批信号</h2><p>RECOMMENDED RELAYS / 03 TARGETS</p></div><div class="relay"><a class="relay-main cab" href="__HERO_URL__" data-category="__HERO_CATEGORY__" data-name="霓虹幸存者" data-tag="NEON SURVIVORS" aria-label="锁定并进入霓虹幸存者"><span class="kicker">NEW SIGNAL / SURVIVAL PROTOCOL</span><h3>霓虹幸存者</h3><p>把一艘小船开进无尽的夜，撑到下一波。</p><span class="arrow">↗</span></a><div class="relay-side">__RELAYS__</div></div></section>
    <section class="section" id="signals" aria-labelledby="signals-title"><div class="section-title"><h2 id="signals-title">全部游戏信号</h2><p>SELECT FREQUENCY / 29 ACTIVE NODES</p></div><div class="filters" role="group" aria-label="按类型筛选"><button class="filter active" data-filter="全部">全部信号</button>__FILTERS__</div><div class="signal-grid">__CATALOG__<div class="empty" hidden>该频段暂时没有回应，换一个信号。</div></div></section>
  </main>
  <footer class="footer"><span>STARPORT ARCADE OS / <b>ALL SYSTEMS ONLINE</b></span><span>LOCK A SIGNAL · ENTER THE GAME · MAKE YOUR OWN ROUTE</span></footer>
</div>
<script>
(function(){
  const canvas=document.getElementById('starfield'),ctx=canvas.getContext('2d'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=0,height=0,dpr=1,stars=[],pointer={x:.5,y:.5};
  function resize(){dpr=Math.min(window.devicePixelRatio||1,1.5);width=innerWidth;height=innerHeight;canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);const count=width<600?95:170;stars=Array.from({length:count},(_,i)=>({x:Math.random()*width,y:Math.random()*height,z:Math.random(),r:Math.random()*1.4+.25,v:Math.random()*.16+.035,hue:i%11===0?'pink':i%7===0?'violet':'cyan'}));}
  function draw(time){ctx.clearRect(0,0,width,height);const t=reduced?0:time*.001;const px=(pointer.x-.5)*18,py=(pointer.y-.5)*12;ctx.fillStyle='#020711';ctx.fillRect(0,0,width,height);stars.forEach((s,i)=>{let x=(s.x+px*s.z+(reduced?0:t*s.v*9))%width;if(x<0)x+=width;let y=s.y+py*s.z;const pulse=.55+.45*Math.sin(t*1.8+i);ctx.fillStyle=s.hue==='pink'?`rgba(255,79,189,${.28+pulse*.4})`:s.hue==='violet'?`rgba(155,124,255,${.25+pulse*.35})`:`rgba(89,243,255,${.18+pulse*.35})`;ctx.beginPath();ctx.arc(x,y,s.r*(.6+s.z),0,Math.PI*2);ctx.fill();if(s.z>.72){ctx.strokeStyle=ctx.fillStyle;ctx.globalAlpha=.15;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-px*.8,y-py*.8);ctx.stroke();ctx.globalAlpha=1;}});const horizon=height*.72;ctx.strokeStyle='rgba(89,243,255,.06)';ctx.lineWidth=1;for(let i=-10;i<11;i++){ctx.beginPath();ctx.moveTo(width/2+i*70,horizon);ctx.lineTo(width/2+i*190,height);ctx.stroke();}for(let y=horizon;y<height;y+=34){ctx.globalAlpha=.06+((y-horizon)/(height-horizon))*.08;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}ctx.globalAlpha=1;if(!reduced)requestAnimationFrame(draw);}
  addEventListener('resize',resize);addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth;pointer.y=e.clientY/innerHeight;document.documentElement.style.setProperty('--mx',pointer.x);document.documentElement.style.setProperty('--my',pointer.y);});resize();requestAnimationFrame(draw);
  const cards=[...document.querySelectorAll('.cab[data-name]')],lockName=document.getElementById('lock-name');cards.forEach(card=>{const update=()=>{if(lockName){lockName.textContent=card.dataset.name;lockName.closest('.lock-panel')?.querySelector('small').textContent='TARGET LOCKED / '+card.dataset.tag;}};card.addEventListener('pointerenter',update);card.addEventListener('focus',update);});
  const filters=[...document.querySelectorAll('.filter')],signals=[...document.querySelectorAll('.signal-card')],empty=document.querySelector('.empty');filters.forEach(filter=>filter.addEventListener('click',()=>{const value=filter.dataset.filter;filters.forEach(x=>x.classList.toggle('active',x===filter));let visible=0;signals.forEach(card=>{const show=value==='全部'||card.dataset.category===value;card.hidden=!show;if(show)visible++;});empty.hidden=visible>0;document.getElementById('signals-title').textContent=value==='全部'?'全部游戏信号':value+' · 信号';}));
})();
</script>
</body>
</html>
"""
html = html.replace('__HERO_URL__', hero['url']).replace('__HERO_CATEGORY__', hero['category']).replace('__RELAYS__', relays).replace('__FILTERS__', filters).replace('__CATALOG__', catalog)
(ROOT / 'arcade.html').write_text(html)
print(f'generated holographic arcade with {len(games)} signals and {len(categories)} frequencies')
