/* =========================================================================
   霓虹幸存者 NEON SURVIVORS  —  星港游戏厅 旗舰机台
   单文件 Canvas 2D 生存 Roguelite：自动攻击 / 升级构筑 / BOSS 战 / 元进度
   ========================================================================= */
(() => {
'use strict';

/* ---------------------------------------------------------------- utils */
const TAU = Math.PI * 2;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const len = (x, y) => Math.hypot(x, y);
const now = () => performance.now();
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const $ = id => document.getElementById(id);

/* ------------------------------------------------------------- storage */
const SAVE_KEY = 'neonSurvivors.v1';
const defaultSave = { credits: 0, bestTime: 0, bestKills: 0, bestLevel: 0, runs: 0, meta: { hp: 0, dmg: 0, magnet: 0, revive: 0, speed: 0 }, muted: false };
let save = (() => {
  try { return Object.assign({}, defaultSave, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch (e) { return Object.assign({}, defaultSave); }
})();
save.meta = Object.assign({}, defaultSave.meta, save.meta || {});
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

const META = [
  { id: 'hp',     name: '合金骨架', desc: lv => `最大生命 +${lv * 15}`,      max: 5, cost: lv => 60 + lv * 70 },
  { id: 'dmg',    name: '过载核心', desc: lv => `全武器伤害 +${lv * 6}%`,    max: 5, cost: lv => 80 + lv * 90 },
  { id: 'speed',  name: '推进器',   desc: lv => `移动速度 +${lv * 4}%`,      max: 5, cost: lv => 50 + lv * 60 },
  { id: 'magnet', name: '引力线圈', desc: lv => `拾取范围 +${lv * 18}%`,     max: 5, cost: lv => 45 + lv * 45 },
  { id: 'revive', name: '备用意识', desc: lv => `复活次数 +${lv}`,           max: 2, cost: lv => 320 + lv * 480 }
];

/* --------------------------------------------------------------- audio */
const Audio_ = {
  ctx: null, master: null, musicGain: null, sfxGain: null, muted: save.muted, started: false, step: 0, nextNote: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.55; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.24; this.musicGain.connect(this.master);
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setMuted(m) { this.muted = m; save.muted = m; persist(); if (this.master) this.master.gain.value = m ? 0 : 0.9; },
  blip(freq = 440, dur = 0.08, type = 'square', vol = 0.3, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.2, vol = 0.35, freq = 900, q = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start();
  },
  shoot()   { this.blip(rnd(620, 760), 0.05, 'square', 0.10, -260); },
  hit()     { this.blip(rnd(180, 240), 0.04, 'triangle', 0.10, -60); },
  kill()    { this.noise(0.16, 0.18, rnd(500, 900), 0.9); },
  boom()    { this.noise(0.42, 0.42, 180, 0.6); this.blip(90, 0.32, 'sine', 0.32, -50); },
  hurt()    { this.blip(150, 0.22, 'sawtooth', 0.24, -90); this.noise(0.18, 0.2, 320, 0.7); },
  gem()     { this.blip(rnd(880, 1180), 0.045, 'sine', 0.07); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.22), i * 70)); },
  bossHorn(){ [110, 138, 82].forEach((f, i) => setTimeout(() => this.blip(f, 0.7, 'sawtooth', 0.22), i * 180)); this.noise(1.0, 0.2, 120, 0.4); },
  ui()      { this.blip(680, 0.05, 'square', 0.13); },
  music(dt, intensity) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t < this.nextNote) return;
    const bpm = 124 + intensity * 26, beat = 60 / bpm / 2;
    this.nextNote = (this.nextNote || t) + beat; if (this.nextNote < t) this.nextNote = t + beat;
    const s = this.step++;
    const scale = [0, 3, 5, 7, 10, 12, 15, 10];
    const root = 55 * Math.pow(2, ((s >> 4) % 3 === 2 ? 3 : 0) / 12);
    // bass
    if (s % 2 === 0) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = root * Math.pow(2, scale[(s >> 2) % 8] / 12);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300 + intensity * 900;
      g.gain.setValueAtTime(0.0001, this.nextNote); g.gain.exponentialRampToValueAtTime(0.5, this.nextNote + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, this.nextNote + beat * 1.6);
      o.connect(f); f.connect(g); g.connect(this.musicGain); o.start(this.nextNote); o.stop(this.nextNote + beat * 2);
    }
    // arp
    const o2 = this.ctx.createOscillator(), g2 = this.ctx.createGain();
    o2.type = 'square'; o2.frequency.value = root * 4 * Math.pow(2, scale[s % 8] / 12);
    g2.gain.setValueAtTime(0.0001, this.nextNote); g2.gain.exponentialRampToValueAtTime(0.10 + intensity * 0.1, this.nextNote + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, this.nextNote + beat * 0.9);
    o2.connect(g2); g2.connect(this.musicGain); o2.start(this.nextNote); o2.stop(this.nextNote + beat);
    // hat
    if (s % 2 === 1 && intensity > 0.15) {
      const n = this.ctx.createBufferSource(), sr = this.ctx.sampleRate, b = this.ctx.createBuffer(1, sr * 0.05, sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      n.buffer = b; const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
      const g3 = this.ctx.createGain(); g3.gain.value = 0.14;
      n.connect(hp); hp.connect(g3); g3.connect(this.musicGain); n.start(this.nextNote);
    }
  }
};

/* --------------------------------------------------------------- input */
const keys = Object.create(null);
const Input = { mx: 0, my: 0, joy: { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0 }, dashPressed: false };
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  Audio_.resume();
  if (e.key === ' ') Input.dashPressed = true;
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') Game.togglePause();
  if (Game.state === 'levelup') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= Game.cards.length) Game.chooseCard(n - 1);
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* ------------------------------------------------------------- canvas */
const cv = $('game'), ctx = cv.getContext('2d', { alpha: false });
let W = 960, H = 540, DPR = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  W = Math.max(320, Math.round(r.width)); H = Math.max(240, Math.round(r.height));
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
addEventListener('resize', resize);

/* ------------------------------------------------------- sprite cache */
const sprites = {};
function makeSprite(key, size, drawFn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.translate(size / 2, size / 2); drawFn(g, size / 2);
  sprites[key] = c; return c;
}
function glowSprite(key, size, color, core = '#fff') {
  return makeSprite(key, size, (g, r) => {
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, core); grd.addColorStop(0.28, color);
    grd.addColorStop(0.65, color.replace('rgb', 'rgba').replace(')', ',0.35)'));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  });
}
function buildSprites() {
  glowSprite('glowCyan',   64, 'rgb(90,220,255)');
  glowSprite('glowPink',   64, 'rgb(255,90,190)');
  glowSprite('glowGold',   64, 'rgb(255,205,80)');
  glowSprite('glowGreen',  64, 'rgb(110,255,170)');
  glowSprite('glowViolet', 64, 'rgb(180,140,255)');
  glowSprite('glowRed',    64, 'rgb(255,90,90)');
  glowSprite('glowWhite',  64, 'rgb(230,245,255)');
  makeSprite('vignette', 512, (g, r) => {
    const grd = g.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = grd; g.fillRect(-r, -r, r * 2, r * 2);
  });
}

/* ------------------------------------------------------------ camera */
const cam = { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0, flash: 0, flashColor: '255,80,80' };
function addShake(v) { cam.shake = Math.min(26, cam.shake + v); }

/* ---------------------------------------------------------- particles */
const MAXP = 900;
const parts = []; for (let i = 0; i < MAXP; i++) parts.push({ dead: true });
let partHead = 0;
function spawnParticle(x, y, vx, vy, life, size, color, kind = 'dot', drag = 0.92) {
  for (let i = 0; i < 24; i++) {
    const p = parts[partHead = (partHead + 1) % MAXP];
    if (p.dead || i === 23) {
      p.dead = false; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life;
      p.size = size; p.color = color; p.kind = kind; p.drag = drag; return p;
    }
  }
}
function burst(x, y, n, color, speed = 220, life = 0.5, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), s = rnd(speed * 0.35, speed);
    spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(life * 0.5, life), rnd(size * 0.6, size * 1.4), color);
  }
}
function ring(x, y, color, r0, r1, life = 0.42, w = 4) {
  const p = spawnParticle(x, y, 0, 0, life, r0, color, 'ring'); if (p) { p.r0 = r0; p.r1 = r1; p.w = w; }
}
function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    const p = parts[i]; if (p.dead) continue;
    p.life -= dt; if (p.life <= 0) { p.dead = true; continue; }
    if (p.kind === 'dot' || p.kind === 'spark') {
      p.x += p.vx * dt; p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d;
    }
  }
}
function drawParticles() {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < MAXP; i++) {
    const p = parts[i]; if (p.dead) continue;
    const t = p.life / p.max, sx = p.x - cam.x, sy = p.y - cam.y;
    if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
    ctx.globalAlpha = t;
    if (p.kind === 'ring') {
      const r = lerp(p.r0, p.r1, 1 - t);
      ctx.strokeStyle = p.color; ctx.lineWidth = p.w * t; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size * t;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 0.02, sy - p.vy * 0.02); ctx.stroke();
    } else {
      ctx.fillStyle = p.color; const s = p.size * (0.4 + t * 0.6);
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* -------------------------------------------------------- damage text */
const texts = [];
function dmgText(x, y, str, color = '#ffffff', size = 14, vy = -60) {
  if (texts.length > 90) texts.shift();
  texts.push({ x, y, str, color, size, life: 0.75, max: 0.75, vy, vx: rnd(-24, 24) });
}
function updateTexts(dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]; t.life -= dt; if (t.life <= 0) { texts.splice(i, 1); continue; }
    t.x += t.vx * dt; t.y += t.vy * dt; t.vy += 90 * dt;
  }
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    const k = t.life / t.max;
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.font = `900 ${t.size * (0.7 + k * 0.4)}px system-ui, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(2,6,16,0.85)';
    ctx.strokeText(t.str, t.x - cam.x, t.y - cam.y);
    ctx.fillStyle = t.color; ctx.fillText(t.str, t.x - cam.x, t.y - cam.y);
  }
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------- pools */
function poolFactory(n, make) {
  const arr = []; for (let i = 0; i < n; i++) { const o = make(); o.dead = true; arr.push(o); }
  let head = 0;
  return {
    arr,
    get() { for (let i = 0; i < arr.length; i++) { const o = arr[head = (head + 1) % arr.length]; if (o.dead) { o.dead = false; return o; } } const o = arr[head]; o.dead = false; return o; }
  };
}
const bullets = poolFactory(360, () => ({}));
const ebullets = poolFactory(260, () => ({}));
const gems = poolFactory(420, () => ({}));

/* ------------------------------------------------------------ weapons */
const WEAPONS = {
  pulse: {
    name: '脉冲枪', icon: '✦', color: '#7fe8ff', maxLv: 6,
    desc: lv => lv === 0 ? '向最近敌人发射脉冲弹' : `弹数 ${1 + Math.floor(lv / 2)} · 伤害 ${Math.round(14 + lv * 8)}`,
    cd: lv => 0.55 - lv * 0.05,
    fire(p, lv, st) {
      const targets = nearestEnemies(p.x, p.y, 1 + Math.floor(lv / 2), 620);
      const count = 1 + Math.floor(lv / 2);
      for (let i = 0; i < count; i++) {
        const t = targets[i % Math.max(1, targets.length)];
        let a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.aim;
        if (!t) a += (i - count / 2) * 0.22;
        fireBullet(p.x, p.y, a, 660, (14 + lv * 8) * st.dmg, 6, '#7fe8ff', { pierce: lv >= 4 ? 2 : lv >= 2 ? 1 : 0 });
      }
      Audio_.shoot();
    }
  },
  blades: {
    name: '环刃', icon: '❉', color: '#ff7bc7', maxLv: 6,
    desc: lv => lv === 0 ? '环绕身周的等离子刃' : `刀刃 ${1 + lv} · 伤害 ${Math.round(9 + lv * 5)}`,
    orbit: true
  },
  arc: {
    name: '电弧', icon: '⚡', color: '#ffe45e', maxLv: 6,
    desc: lv => lv === 0 ? '链式闪电，在敌群间跳跃' : `跳跃 ${2 + lv} 次 · 伤害 ${Math.round(14 + lv * 7)}`,
    cd: lv => 1.7 - lv * 0.14,
    fire(p, lv, st) {
      let src = p, hit = [], jumps = 2 + lv, dmg = (14 + lv * 7) * st.dmg;
      for (let j = 0; j < jumps; j++) {
        const t = nearestEnemies(src.x, src.y, 1, j === 0 ? 420 : 260, hit)[0];
        if (!t) break;
        hit.push(t);
        lightning(src.x, src.y, t.x, t.y, '#ffe45e');
        damageEnemy(t, dmg * Math.pow(0.88, j), false, 0, 0);
        src = t;
      }
      if (hit.length) Audio_.blip(1200, 0.09, 'sawtooth', 0.12, -700);
    }
  },
  nova: {
    name: '新星', icon: '◎', color: '#b98cff', maxLv: 6,
    desc: lv => lv === 0 ? '周期性释放冲击波' : `半径 ${Math.round(120 + lv * 26)} · 伤害 ${Math.round(20 + lv * 10)}`,
    cd: lv => 3.4 - lv * 0.28,
    fire(p, lv, st) {
      const r = 120 + lv * 26, dmg = (20 + lv * 10) * st.dmg;
      ring(p.x, p.y, 'rgba(185,140,255,0.9)', 20, r, 0.45, 7);
      ring(p.x, p.y, 'rgba(255,255,255,0.7)', 10, r * 0.75, 0.3, 3);
      for (const e of enemies) {
        if (e.dead) continue;
        const d = len(e.x - p.x, e.y - p.y);
        if (d < r + e.r) { damageEnemy(e, dmg, false, (e.x - p.x) / (d || 1) * 320, (e.y - p.y) / (d || 1) * 320); }
      }
      addShake(4); Audio_.blip(220, 0.3, 'sine', 0.2, 260);
    }
  },
  seeker: {
    name: '追猎导弹', icon: '➤', color: '#ff9f5c', maxLv: 6,
    desc: lv => lv === 0 ? '发射追踪爆破导弹' : `导弹 ${1 + Math.floor(lv * 0.7)} · 爆伤 ${Math.round(26 + lv * 12)}`,
    cd: lv => 2.6 - lv * 0.22,
    fire(p, lv, st) {
      const n = 1 + Math.floor(lv * 0.7);
      for (let i = 0; i < n; i++) {
        const b = fireBullet(p.x, p.y, p.aim + rnd(-1, 1), 260, (26 + lv * 12) * st.dmg, 7, '#ff9f5c', { homing: 4.5, explode: 66 + lv * 5, life: 3.2, accel: 480, trail: true });
      }
      Audio_.blip(360, 0.12, 'sawtooth', 0.12, 180);
    }
  },
  laser: {
    name: '相位光束', icon: '≡', color: '#6dffc2', maxLv: 6,
    desc: lv => lv === 0 ? '扫射高能光束，穿透一切' : `持续 ${(0.7 + lv * 0.16).toFixed(1)}s · 每秒 ${Math.round(46 + lv * 24)}`,
    cd: lv => 4.6 - lv * 0.35,
    fire(p, lv, st) {
      p.laser = { t: 0, dur: 0.7 + lv * 0.16, dps: (46 + lv * 24) * st.dmg, w: 16 + lv * 3, a: p.aim, spin: rnd(-1, 1) > 0 ? 1.5 : -1.5 };
      Audio_.blip(180, 0.5, 'sawtooth', 0.16, 900);
    }
  },
  mines: {
    name: '磁暴地雷', icon: '✹', color: '#ff5c8a', maxLv: 6,
    desc: lv => lv === 0 ? '沿途布下感应地雷' : `地雷 ${1 + Math.floor(lv / 2)} · 爆伤 ${Math.round(34 + lv * 16)}`,
    cd: lv => 2.4 - lv * 0.2,
    fire(p, lv, st) {
      const n = 1 + Math.floor(lv / 2);
      for (let i = 0; i < n; i++) {
        const a = rnd(TAU), d = rnd(20, 70);
        mines.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 10, t: 0, arm: 0.5, dmg: (34 + lv * 16) * st.dmg, blast: 86 + lv * 8, life: 12 });
      }
    }
  }
};
const WEAPON_IDS = Object.keys(WEAPONS);

const PASSIVES = {
  power:  { name: '过载核心', icon: '⬆', color: '#ff7b7b', maxLv: 5, desc: lv => `全部伤害 +${(lv + 1) * 12}%` },
  haste:  { name: '超频芯片', icon: '⏱', color: '#7fe8ff', maxLv: 5, desc: lv => `攻击冷却 -${(lv + 1) * 9}%` },
  boots:  { name: '磁悬浮靴', icon: '»',  color: '#6dffc2', maxLv: 5, desc: lv => `移动速度 +${(lv + 1) * 8}%` },
  armor:  { name: '装甲板',   icon: '❤', color: '#ff6ea8', maxLv: 5, desc: lv => `最大生命 +${(lv + 1) * 22} 并治疗` },
  magnet: { name: '引力线圈', icon: '◉', color: '#b98cff', maxLv: 5, desc: lv => `拾取范围 +${(lv + 1) * 30}%` },
  crit:   { name: '弱点扫描', icon: '✧', color: '#ffe45e', maxLv: 5, desc: lv => `暴击率 +${(lv + 1) * 8}%` },
  regen:  { name: '纳米修复', icon: '✚', color: '#8dffb0', maxLv: 5, desc: lv => `每秒回复 ${((lv + 1) * 0.7).toFixed(1)} 生命` },
  shield: { name: '相位护盾', icon: '⛨', color: '#9fd8ff', maxLv: 3, desc: lv => `每 ${(14 - lv * 3)}s 抵挡一次伤害` },
  xpup:   { name: '数据挖掘', icon: '★', color: '#ffd45c', maxLv: 5, desc: lv => `经验获取 +${(lv + 1) * 15}%` }
};
const PASSIVE_IDS = Object.keys(PASSIVES);

/* ------------------------------------------------------------ enemies */
const ENEMY_TYPES = {
  drone:   { r: 13, hp: 14, speed: 96,  dmg: 8,  xp: 1, color: '#7fe8ff', glow: 'glowCyan',   shape: 'tri',  from: 0 },
  dart:    { r: 11, hp: 11, speed: 178, dmg: 7,  xp: 1, color: '#ff7bc7', glow: 'glowPink',   shape: 'dart', from: 45 },
  hulk:    { r: 24, hp: 72, speed: 62,  dmg: 17, xp: 5, color: '#b98cff', glow: 'glowViolet', shape: 'hex',  from: 95 },
  turret:  { r: 15, hp: 30, speed: 74,  dmg: 9,  xp: 3, color: '#ffe45e', glow: 'glowGold',   shape: 'sq',   from: 150, ranged: true, keep: 280, fireCd: 2.1 },
  splitter:{ r: 20, hp: 42, speed: 80,  dmg: 12, xp: 3, color: '#6dffc2', glow: 'glowGreen',  shape: 'blob', from: 210, split: 3 },
  wraith:  { r: 14, hp: 34, speed: 132, dmg: 12, xp: 4, color: '#ff9f5c', glow: 'glowGold',   shape: 'dart', from: 240, dash: true }
};
const BOSSES = [
  { name: '巨像 · 泰坦壳', hp: 2600, r: 48, speed: 132, dmg: 26, color: '#ff5c8a', pattern: 'radial' },
  { name: '织网者 · 蛛型', hp: 4200, r: 52, speed: 152, dmg: 28, color: '#b98cff', pattern: 'spiral' },
  { name: '湮灭者 · 终末', hp: 6800, r: 58, speed: 168, dmg: 32, color: '#ffe45e', pattern: 'laserSweep' }
];

let enemies = [], mines = [], pickups = [], orbits = [], beams = [];

/* --------------------------------------------------------------- game */
const Game = {
  state: 'menu',        // menu | playing | levelup | paused | dead | shop
  t: 0, dt: 0, kills: 0, credits: 0, cards: [], hitStop: 0, timeScale: 1,
  spawnTimer: 0, bossIndex: 0, nextBoss: 120, boss: null, wave: 0,
  player: null, difficulty: 1,

  start(attract) {
    if (!attract) Audio_.resume();
    const m = save.meta;
    this.player = {
      x: 0, y: 0, vx: 0, vy: 0, r: 15, aim: 0,
      hp: 100 + m.hp * 15, maxhp: 100 + m.hp * 15,
      speed: 232 * (1 + m.speed * 0.04),
      level: 1, xp: 0, xpNeed: 6,
      dashCd: 0, dashT: 0, invuln: 0, dashDir: 0,
      weapons: { pulse: 1 }, passives: {}, cooldowns: { pulse: 0 },
      revives: m.revive, shieldT: 0, shieldReady: false,
      laser: null, hurtFlash: 0, trailT: 0
    };
    enemies.length = 0; mines.length = 0; pickups.length = 0; orbits.length = 0; texts.length = 0; beams.length = 0;
    for (const b of bullets.arr) b.dead = true;
    for (const b of ebullets.arr) b.dead = true;
    for (const g of gems.arr) g.dead = true;
    for (const p of parts) p.dead = true;
    this.t = 0; this.kills = 0; this.credits = 0; this.spawnTimer = 0; this.bossIndex = 0; this.nextBoss = 120;
    this.boss = null; this.hitStop = 0; this.timeScale = 1; this.difficulty = 1;
    cam.x = -W / 2; cam.y = -H / 2; cam.shake = 0; cam.flash = 0;
    if (attract) {
      this.state = 'attract';
      this.player.weapons = { pulse: 4, blades: 3, arc: 2 };
      this.player.cooldowns = { pulse: 0, blades: 0, arc: 0 };
      this.player.passives = { power: 3, haste: 3, boots: 2 };
      this.player.invuln = 1e9;
      this.t = 26;
      syncOrbits();
      // pre-populate the screen so the attract mode reads instantly
      const kinds = ['drone', 'drone', 'dart', 'hulk', 'drone', 'dart'];
      for (let i = 0; i < 46; i++) {
        const a = rnd(TAU), d = rnd(150, Math.max(W, H) * 0.62);
        spawnEnemy(pick(kinds), this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d);
      }
      return;
    }
    this.state = 'playing';
    UI.hideAll(); UI.hud.classList.remove('hidden');
    syncOrbits();
    save.runs++; persist();
  },

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; UI.pause.classList.remove('hidden'); UI.renderPauseBuild(); }
    else if (this.state === 'paused') { this.state = 'playing'; UI.pause.classList.add('hidden'); }
  },

  stats() {
    const p = this.player, ps = p.passives;
    const dmg = (1 + (ps.power ? ps.power * 0.12 : 0)) * (1 + save.meta.dmg * 0.06);
    const cdr = 1 - Math.min(0.62, (ps.haste ? ps.haste * 0.09 : 0));
    const spd = p.speed * (1 + (ps.boots ? ps.boots * 0.08 : 0));
    const mag = 132 * (1 + (ps.magnet ? ps.magnet * 0.30 : 0)) * (1 + save.meta.magnet * 0.18);
    const crit = (ps.crit ? ps.crit * 0.08 : 0.02);
    const xpm = 1 + (ps.xpup ? ps.xpup * 0.15 : 0);
    return { dmg, cdr, spd, mag, crit, xpm };
  },

  gainXp(v) {
    if (this.state === 'attract') return;
    const p = this.player; p.xp += v;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed; p.level++;
      p.xpNeed = Math.round(5 + p.level * 2.6 + Math.pow(p.level, 1.42));
      this.levelUp();
    }
  },

  levelUp() {
    Audio_.levelup();
    ring(this.player.x, this.player.y, 'rgba(255,220,120,0.9)', 20, 200, 0.6, 6);
    burst(this.player.x, this.player.y, 26, '#ffe45e', 300, 0.7, 3);
    this.cards = rollCards();
    this.state = 'levelup';
    UI.showCards(this.cards);
  },

  chooseCard(i) {
    const c = this.cards[i]; if (!c) return;
    const p = this.player;
    Audio_.ui();
    if (c.kind === 'weapon') {
      p.weapons[c.id] = (p.weapons[c.id] || 0) + 1;
      if (p.cooldowns[c.id] === undefined) p.cooldowns[c.id] = 0;
      if (c.id === 'blades') syncOrbits();
    } else if (c.kind === 'passive') {
      p.passives[c.id] = (p.passives[c.id] || 0) + 1;
      if (c.id === 'armor') { p.maxhp += 22; p.hp = Math.min(p.maxhp, p.hp + 22); }
      if (c.id === 'shield') p.shieldReady = true;
    } else if (c.kind === 'heal') {
      p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.4); dmgText(p.x, p.y - 30, '+HP', '#8dffb0', 20);
    } else if (c.kind === 'bomb') {
      screenClear();
    }
    UI.cardWrap.classList.add('hidden');
    this.state = 'playing';
  },

  die() {
    const p = this.player;
    if (p.revives > 0) {
      p.revives--; p.hp = p.maxhp; p.invuln = 3;
      screenClear(); dmgText(p.x, p.y - 40, '意识重构!', '#7fe8ff', 26);
      Audio_.levelup(); return;
    }
    this.state = 'dead';
    Audio_.boom(); addShake(24); cam.flash = 1; cam.flashColor = '255,60,60';
    burst(p.x, p.y, 60, '#7fe8ff', 400, 1.1, 5);
    const earned = Math.round(this.credits * 0.35 + this.t * 0.6 + this.kills * 0.1);
    save.credits += earned;
    save.bestTime = Math.max(save.bestTime, this.t);
    save.bestKills = Math.max(save.bestKills, this.kills);
    save.bestLevel = Math.max(save.bestLevel, p.level);
    persist();
    UI.showDead(earned);
  }
};

/* ------------------------------------------------------------ helpers */
function nearestEnemies(x, y, n, maxDist = 9999, exclude = null) {
  const out = [];
  for (const e of enemies) {
    if (e.dead) continue;
    if (exclude && exclude.indexOf(e) >= 0) continue;
    const d = len(e.x - x, e.y - y);
    if (d > maxDist) continue;
    out.push([d, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map(p => p[1]);
}

function fireBullet(x, y, a, sp, dmg, r, color, opt = {}) {
  const b = bullets.get();
  b.x = x; b.y = y; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  b.dmg = dmg; b.r = r; b.color = color; b.life = opt.life || 1.8;
  b.pierce = opt.pierce || 0; b.homing = opt.homing || 0; b.explode = opt.explode || 0;
  b.accel = opt.accel || 0; b.trail = !!opt.trail; b.hitList = null; b.a = a;
  return b;
}
function fireEBullet(x, y, a, sp, dmg, r, color) {
  const b = ebullets.get();
  b.x = x; b.y = y; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  b.dmg = dmg; b.r = r; b.color = color; b.life = 5.5;
  return b;
}
function lightning(x1, y1, x2, y2, color) {
  beams.push({ x1, y1, x2, y2, color, life: 0.18, max: 0.18, seed: Math.random() * 1000 });
}
function spawnGem(x, y, value, big = false) {
  const g = gems.get();
  g.x = x; g.y = y; g.vx = rnd(-70, 70); g.vy = rnd(-70, 70); g.value = value; g.big = big; g.t = 0; g.pulled = false;
}
function screenClear() {
  cam.flash = 0.8; cam.flashColor = '180,240,255'; addShake(16); Audio_.boom();
  const p = Game.player;
  ring(p.x, p.y, 'rgba(160,230,255,0.9)', 30, 900, 0.7, 10);
  for (const e of enemies) { if (!e.dead && !e.boss) damageEnemy(e, 9999, false, 0, 0); else if (!e.dead) damageEnemy(e, 400, false, 0, 0); }
  for (const b of ebullets.arr) b.dead = true;
}

function syncOrbits() {
  const lv = Game.player.weapons.blades || 0;
  orbits.length = 0;
  const n = lv ? 1 + lv : 0;
  for (let i = 0; i < n; i++) orbits.push({ a: (i / n) * TAU, hitT: 0 });
}

function damageEnemy(e, dmg, canCrit = true, kx = 0, ky = 0) {
  if (e.dead) return;
  const st = Game.stats();
  let crit = canCrit && Math.random() < st.crit;
  let d = dmg * (crit ? 2.2 : 1);
  e.hp -= d; e.flash = 0.12;
  if (kx || ky) { e.vx += kx / (e.boss ? 8 : 1); e.vy += ky / (e.boss ? 8 : 1); }
  dmgText(e.x + rnd(-8, 8), e.y - e.r - 4, String(Math.round(d)), crit ? '#ffe45e' : '#ffffff', crit ? 20 : 13);
  if (crit) burst(e.x, e.y, 4, '#ffe45e', 200, 0.3, 3);
  Audio_.hit();
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true; Game.kills++;
  burst(e.x, e.y, e.boss ? 70 : 12, e.color, e.boss ? 460 : 240, e.boss ? 1.2 : 0.5, e.boss ? 5 : 3);
  ring(e.x, e.y, e.color.replace(')', ',0.8)').replace('#', 'rgba(') === e.color ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.55)', e.r, e.r * 3.2, 0.35, 3);
  Audio_.kill();
  const xpv = e.xp * (e.elite ? 4 : 1);
  const chunks = e.boss ? 26 : e.elite ? 4 : 1;
  for (let i = 0; i < chunks; i++) spawnGem(e.x + rnd(-16, 16), e.y + rnd(-16, 16), Math.max(1, Math.round(xpv / chunks * (e.boss ? 12 : 1))), e.boss || e.elite);
  Game.credits += e.boss ? 60 : e.elite ? 8 : 1;
  if (e.split && !e.elite) {
    for (let i = 0; i < e.split; i++) {
      const a = rnd(TAU);
      spawnEnemy('drone', e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22);
    }
  }
  if (e.boss) {
    Game.boss = null; addShake(22); cam.flash = 0.7; cam.flashColor = '255,200,120'; Audio_.boom();
    pickups.push({ x: e.x, y: e.y, type: 'chest', r: 16, t: 0 });
    for (let i = 0; i < 5; i++) pickups.push({ x: e.x + rnd(-70, 70), y: e.y + rnd(-70, 70), type: 'hp', r: 11, t: 0 });
  } else if (Math.random() < 0.014) pickups.push({ x: e.x, y: e.y, type: 'hp', r: 11, t: 0 });
  else if (Math.random() < 0.008) pickups.push({ x: e.x, y: e.y, type: 'bomb', r: 12, t: 0 });
  else if (Math.random() < 0.006) pickups.push({ x: e.x, y: e.y, type: 'magnet', r: 12, t: 0 });
}

function spawnEnemy(typeId, x, y, opt = {}) {
  const T = ENEMY_TYPES[typeId];
  const scale = Game.difficulty;
  const e = {
    type: typeId, x, y, vx: 0, vy: 0, r: T.r, color: T.color, glow: T.glow, shape: T.shape,
    hp: T.hp * scale * (opt.elite ? 3.4 : 1), maxhp: T.hp * scale * (opt.elite ? 3.4 : 1),
    speed: T.speed * (opt.elite ? 0.88 : 1) * (1 + Math.min(0.55, Game.t / 400)),
    dmg: T.dmg * (1 + Math.min(1.2, Game.t / 300)), xp: T.xp, dead: false, flash: 0,
    elite: !!opt.elite, ranged: T.ranged, keep: T.keep, fireCd: T.fireCd, fireT: rnd(0, 1.5),
    split: T.split, dash: T.dash, dashT: rnd(1, 3), dashing: 0, wob: rnd(TAU), touchCd: 0
  };
  if (opt.elite) { e.r *= 1.45; e.xp *= 3; }
  enemies.push(e);
  return e;
}

function spawnBoss() {
  const def = BOSSES[Math.min(Game.bossIndex, BOSSES.length - 1)];
  const cyc = Math.floor(Game.bossIndex / BOSSES.length);
  const a = rnd(TAU), d = Math.max(W, H) * 0.62;
  const p = Game.player;
  const e = {
    type: 'boss', name: def.name, boss: true, pattern: def.pattern,
    x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: 0, vy: 0,
    r: def.r, color: def.color, glow: 'glowRed', shape: 'boss',
    hp: def.hp * (1 + cyc * 1.4) * Math.max(1, Game.difficulty * 0.5),
    speed: def.speed, dmg: def.dmg, xp: 60, dead: false, flash: 0,
    fireT: 2, phase: 0, spin: 0, summonT: 5, touchCd: 0
  };
  e.maxhp = e.hp;
  enemies.push(e); Game.boss = e;
  Audio_.bossHorn(); cam.flash = 0.5; cam.flashColor = '255,90,120'; addShake(14);
  UI.bossBar.classList.remove('hidden'); UI.bossName.textContent = def.name;
  Game.bossIndex++;
}

/* ------------------------------------------------------------- update */
function update(dt) {
  const g = Game, p = g.player, st = g.stats();
  g.t += dt;
  g.difficulty = 1 + Math.pow(g.t / 62, 1.30);

  /* --- input / movement --- */
  let ix = 0, iy = 0;
  if (g.state === 'attract') {
    // ---- autopilot: drift in a wide arc, steer away from the densest threat ----
    let fx = Math.cos(g.t * 0.55), fy = Math.sin(g.t * 0.42);
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 62500) { const d = Math.sqrt(d2) || 1; fx += dx / d * (250 - d) / 250 * 1.6; fy += dy / d * (250 - d) / 250 * 1.6; }
    }
    const fl = len(fx, fy) || 1; ix = fx / fl; iy = fy / fl;
  }
  if (keys['a'] || keys['arrowleft'])  ix -= 1;
  if (keys['d'] || keys['arrowright']) ix += 1;
  if (keys['w'] || keys['arrowup'])    iy -= 1;
  if (keys['s'] || keys['arrowdown'])  iy += 1;
  if (Input.joy.active) { ix += Input.joy.x; iy += Input.joy.y; }
  const il = len(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  if (il > 0.06) p.aim = Math.atan2(iy, ix);

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = Math.cos(p.dashDir) * 900; p.vy = Math.sin(p.dashDir) * 900;
    p.trailT -= dt;
    if (p.trailT <= 0) { p.trailT = 0.02; spawnParticle(p.x, p.y, 0, 0, 0.3, 16, 'rgba(130,220,255,0.5)'); }
  } else {
    const target = st.spd;
    p.vx = lerp(p.vx, ix * target, 1 - Math.pow(0.0008, dt));
    p.vy = lerp(p.vy, iy * target, 1 - Math.pow(0.0008, dt));
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.dashCd -= dt; p.invuln -= dt; p.hurtFlash -= dt;

  const dashKey = keys['shift'] || Input.dashPressed;
  if (dashKey && p.dashCd <= 0 && p.dashT <= 0) {
    p.dashCd = 1.5; p.dashT = 0.16; p.invuln = 0.38;
    p.dashDir = il > 0.06 ? Math.atan2(iy, ix) : p.aim;
    Audio_.blip(520, 0.12, 'sine', 0.16, 420); burst(p.x, p.y, 12, 'rgba(130,220,255,0.8)', 200, 0.4, 3);
  }
  Input.dashPressed = false;

  /* --- passives over time --- */
  if (p.passives.regen) p.hp = Math.min(p.maxhp, p.hp + p.passives.regen * 0.7 * dt);
  if (p.passives.shield) {
    p.shieldT -= dt;
    if (p.shieldT <= 0 && !p.shieldReady) { p.shieldReady = true; Audio_.blip(880, 0.14, 'sine', 0.1); }
  }

  /* --- weapons --- */
  for (const id in p.weapons) {
    const lv = p.weapons[id], Wp = WEAPONS[id];
    if (!Wp || Wp.orbit) continue;
    p.cooldowns[id] = (p.cooldowns[id] || 0) - dt;
    if (p.cooldowns[id] <= 0) {
      p.cooldowns[id] = Math.max(0.12, Wp.cd(lv) * st.cdr);
      Wp.fire(p, lv, st);
    }
  }
  // orbit blades
  if (p.weapons.blades) {
    const lv = p.weapons.blades, rad = 82 + lv * 6, spd = (2.1 + lv * 0.16) / st.cdr * 0.85, dmg = (9 + lv * 5) * st.dmg;
    for (const o of orbits) {
      o.a += spd * dt; o.hitT -= dt;
      const ox = p.x + Math.cos(o.a) * rad, oy = p.y + Math.sin(o.a) * rad;
      o.x = ox; o.y = oy;
      if (Math.random() < 0.25) spawnParticle(ox, oy, 0, 0, 0.25, 5, 'rgba(255,123,199,0.7)');
      if (o.hitT <= 0) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (len(e.x - ox, e.y - oy) < e.r + 15) {
            damageEnemy(e, dmg, true, (e.x - p.x) * 1.6, (e.y - p.y) * 1.6);
            o.hitT = 0.18; break;
          }
        }
      }
    }
  }
  // laser
  if (p.laser) {
    const L = p.laser; L.t += dt; L.a += L.spin * dt;
    if (L.t >= L.dur) p.laser = null;
    else {
      const dmg = L.dps * dt;
      const dx = Math.cos(L.a), dy = Math.sin(L.a);
      for (const e of enemies) {
        if (e.dead) continue;
        const rx = e.x - p.x, ry = e.y - p.y;
        const proj = rx * dx + ry * dy;
        if (proj < 0 || proj > 1400) continue;
        const perp = Math.abs(-rx * dy + ry * dx);
        if (perp < L.w / 2 + e.r) damageEnemy(e, dmg, false, 0, 0);
      }
      if (Math.random() < 0.6) spawnParticle(p.x + dx * rnd(60, 700), p.y + dy * rnd(60, 700), rnd(-40, 40), rnd(-40, 40), 0.3, 4, 'rgba(109,255,194,0.9)');
    }
  }

  /* --- bullets --- */
  for (const b of bullets.arr) {
    if (b.dead) continue;
    b.life -= dt; if (b.life <= 0) { if (b.explode) explodeBullet(b); b.dead = true; continue; }
    if (b.homing) {
      const t = nearestEnemies(b.x, b.y, 1, 520)[0];
      if (t) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        let cur = Math.atan2(b.vy, b.vx);
        let diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
        cur += clamp(diff, -b.homing * dt, b.homing * dt);
        const sp = len(b.vx, b.vy) + (b.accel || 0) * dt;
        b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.trail && Math.random() < 0.9) spawnParticle(b.x, b.y, rnd(-30, 30), rnd(-30, 30), 0.3, 4, 'rgba(255,159,92,0.8)');
    for (const e of enemies) {
      if (e.dead) continue;
      if (len(e.x - b.x, e.y - b.y) < e.r + b.r) {
        if (b.hitList && b.hitList.indexOf(e) >= 0) continue;
        if (b.explode) { explodeBullet(b); b.dead = true; break; }
        damageEnemy(e, b.dmg, true, b.vx * 0.35, b.vy * 0.35);
        burst(b.x, b.y, 4, b.color, 150, 0.25, 3);
        if (b.pierce > 0) { b.pierce--; (b.hitList || (b.hitList = [])).push(e); }
        else { b.dead = true; break; }
      }
    }
    if (Math.abs(b.x - p.x) > 1600 || Math.abs(b.y - p.y) > 1200) b.dead = true;
  }

  /* --- enemy bullets --- */
  for (const b of ebullets.arr) {
    if (b.dead) continue;
    b.life -= dt; if (b.life <= 0) { b.dead = true; continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (len(b.x - p.x, b.y - p.y) < p.r + b.r) { hurtPlayer(b.dmg); b.dead = true; burst(b.x, b.y, 8, b.color, 180, 0.35, 3); }
    if (Math.abs(b.x - p.x) > 1600 || Math.abs(b.y - p.y) > 1200) b.dead = true;
  }

  /* --- mines --- */
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i]; m.t += dt; m.life -= dt;
    if (m.life <= 0) { mines.splice(i, 1); continue; }
    if (m.t < m.arm) continue;
    let boom = false;
    for (const e of enemies) { if (!e.dead && len(e.x - m.x, e.y - m.y) < e.r + m.r + 12) { boom = true; break; } }
    if (boom) {
      ring(m.x, m.y, 'rgba(255,92,138,0.9)', 10, m.blast, 0.35, 6);
      burst(m.x, m.y, 16, '#ff5c8a', 300, 0.5, 4);
      for (const e of enemies) if (!e.dead && len(e.x - m.x, e.y - m.y) < m.blast + e.r) damageEnemy(e, m.dmg, true, (e.x - m.x) * 3, (e.y - m.y) * 3);
      addShake(3); Audio_.noise(0.2, 0.25, 260, 0.7);
      mines.splice(i, 1);
    }
  }

  /* --- enemies --- */
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue; }
    e.flash -= dt; e.touchCd -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = len(dx, dy) || 1;
    let ax = dx / d, ay = dy / d;

    if (e.boss) {
      updateBoss(e, dt, p, d, ax, ay);
    } else if (e.ranged) {
      const want = e.keep;
      const dir = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
      e.vx = lerp(e.vx, ax * e.speed * dir, 0.08);
      e.vy = lerp(e.vy, ay * e.speed * dir, 0.08);
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 640) {
        e.fireT = e.fireCd * (e.elite ? 0.6 : 1);
        const a = Math.atan2(dy, dx);
        const n = e.elite ? 3 : 1;
        for (let k = 0; k < n; k++) fireEBullet(e.x, e.y, a + (k - (n - 1) / 2) * 0.18, 250, e.dmg, 6, '#ffe45e');
        Audio_.blip(300, 0.08, 'square', 0.07, -120);
      }
    } else if (e.dash) {
      e.dashT -= dt;
      if (e.dashing > 0) {
        e.dashing -= dt;
      } else if (e.dashT <= 0 && d < 420) {
        e.dashT = rnd(2.4, 4); e.dashing = 0.45;
        e.vx = ax * e.speed * 4.2; e.vy = ay * e.speed * 4.2;
        burst(e.x, e.y, 6, e.color, 140, 0.3, 3);
      } else {
        e.vx = lerp(e.vx, ax * e.speed, 0.05); e.vy = lerp(e.vy, ay * e.speed, 0.05);
      }
    } else {
      e.wob += dt * 2;
      const wob = Math.sin(e.wob) * 0.28;
      const ca = Math.cos(wob), sa = Math.sin(wob);
      const rx = ax * ca - ay * sa, ry = ax * sa + ay * ca;
      e.vx = lerp(e.vx, rx * e.speed, 0.06); e.vy = lerp(e.vy, ry * e.speed, 0.06);
    }

    e.x += e.vx * dt; e.y += e.vy * dt;
    e.vx *= Math.pow(0.86, dt * 60 / 60); e.vy *= Math.pow(0.86, dt * 60 / 60);

    // separation (cheap)
    if (!e.boss && (i & 1) === (frameCount & 1)) {
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        const o = enemies[j]; if (o.dead || o.boss) continue;
        const ox = e.x - o.x, oy = e.y - o.y, od = len(ox, oy);
        const min = e.r + o.r;
        if (od > 0.01 && od < min) {
          const push = (min - od) * 0.5;
          e.x += ox / od * push; e.y += oy / od * push;
          o.x -= ox / od * push; o.y -= oy / od * push;
        }
      }
    }

    if (d < e.r + p.r && e.touchCd <= 0) {
      hurtPlayer(e.dmg * (e.boss ? 1 : 1)); e.touchCd = 0.55;
      e.vx -= ax * 260; e.vy -= ay * 260;
    }

    if (!e.boss && Math.abs(e.x - p.x) > 2200) e.x = p.x - Math.sign(e.x - p.x) * 1200;
    if (!e.boss && Math.abs(e.y - p.y) > 1800) e.y = p.y - Math.sign(e.y - p.y) * 1000;
  }

  /* --- gems / pickups --- */
  for (const gm of gems.arr) {
    if (gm.dead) continue;
    gm.t += dt;
    const dx = p.x - gm.x, dy = p.y - gm.y, d = len(dx, dy) || 1;
    if (d < st.mag || gm.pulled) {
      gm.pulled = true;
      const pull = 260 + (st.mag - d) * 3.2;
      gm.vx = lerp(gm.vx, dx / d * pull, 0.2); gm.vy = lerp(gm.vy, dy / d * pull, 0.2);
    } else if (gm.t > 3) {           // stragglers home in so no XP is ever lost
      const chase = Math.min(430, 150 + (gm.t - 3) * 110);
      gm.vx = lerp(gm.vx, dx / d * chase, 0.09); gm.vy = lerp(gm.vy, dy / d * chase, 0.09);
    } else { gm.vx *= 0.9; gm.vy *= 0.9; }
    gm.x += gm.vx * dt; gm.y += gm.vy * dt;
    if (d < p.r + 10) {
      gm.dead = true; Game.gainXp(gm.value * st.xpm); Audio_.gem();
      spawnParticle(gm.x, gm.y, 0, 0, 0.25, 8, 'rgba(160,255,220,0.8)');
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i]; k.t += dt;
    const d = len(p.x - k.x, p.y - k.y);
    if (d < p.r + k.r + 6) {
      pickups.splice(i, 1);
      if (k.type === 'hp') { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.22); dmgText(p.x, p.y - 30, '+生命', '#8dffb0', 17); Audio_.blip(760, 0.12, 'sine', 0.16); }
      else if (k.type === 'bomb') screenClear();
      else if (k.type === 'magnet') { for (const gm of gems.arr) if (!gm.dead) gm.pulled = true; Audio_.blip(1000, 0.2, 'sine', 0.14, -500); }
      else if (k.type === 'chest') { Game.credits += 40; Game.levelUp(); }
    }
  }

  /* --- beams fade --- */
  for (let i = beams.length - 1; i >= 0; i--) { beams[i].life -= dt; if (beams[i].life <= 0) beams.splice(i, 1); }

  /* --- spawn director --- */
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0 && enemies.length < 150) {
    const rate = clamp(0.82 - g.t / 300, 0.16, 0.82);
    g.spawnTimer = rate;
    const avail = Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].from <= g.t);
    const count = Math.min(12, 2 + Math.floor(g.t / 25) + (Math.random() < 0.3 ? 1 : 0));
    const groupSpawn = Math.random() < 0.35;
    const ga = rnd(TAU);
    for (let i = 0; i < count; i++) {
      const a = groupSpawn ? ga + rnd(-0.5, 0.5) : rnd(TAU);
      const dist = Math.max(W, H) * 0.62 + rnd(0, 140);
      const x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
      const elite = Math.random() < clamp(0.012 + g.t / 9000, 0, 0.09);
      spawnEnemy(pick(avail), x, y, { elite });
    }
  }
  if (g.t > 55 && g.t - (g.lastHunt || 0) > 42) { g.lastHunt = g.t; huntWave(); }
  if (g.t >= g.nextBoss && !g.boss) { spawnBoss(); g.nextBoss += 130; }
  if (!g.boss) UI.bossBar.classList.add('hidden');

  /* --- camera --- */
  const tx = p.x - W / 2 + clamp(p.vx * 0.16, -70, 70);
  const ty = p.y - H / 2 + clamp(p.vy * 0.16, -70, 70);
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.0015, dt));
  cam.y = lerp(cam.y, ty, 1 - Math.pow(0.0015, dt));
  cam.shake *= Math.pow(0.03, dt);
  cam.shakeX = rnd(-cam.shake, cam.shake); cam.shakeY = rnd(-cam.shake, cam.shake);
  cam.flash = Math.max(0, cam.flash - dt * 2.2);

  updateParticles(dt); updateTexts(dt);
  if (g.state === 'attract') { g.t = 26 + (g.t % 1); return; }
  UI.updateHud();
  Audio_.music(dt, clamp(g.t / 300 + (g.boss ? 0.4 : 0), 0, 1));
}

function huntWave() {
  const p = Game.player;
  const kind = ENEMY_TYPES.wraith.from <= Game.t ? 'wraith' : 'dart';
  const n = Math.min(16, 5 + Math.floor(Game.t / 70));
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), d = Math.max(W, H) * rnd(0.42, 0.58);
    const e = spawnEnemy(kind, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { elite: Math.random() < 0.18 });
    e.speed *= 1.22;
    ring(e.x, e.y, 'rgba(255,159,92,0.7)', 6, 46, 0.5, 3);
  }
  UI.announce('警报 · 猎杀者接近');
  Audio_.blip(180, 0.5, 'sawtooth', 0.18, 120); Audio_.noise(0.5, 0.16, 200, 0.5);
}

function explodeBullet(b) {
  ring(b.x, b.y, 'rgba(255,159,92,0.9)', 8, b.explode, 0.35, 6);
  burst(b.x, b.y, 18, '#ff9f5c', 320, 0.55, 4);
  for (const e of enemies) if (!e.dead && len(e.x - b.x, e.y - b.y) < b.explode + e.r) damageEnemy(e, b.dmg, true, (e.x - b.x) * 2.4, (e.y - b.y) * 2.4);
  addShake(3.5); Audio_.noise(0.22, 0.22, 220, 0.7);
}

function updateBoss(e, dt, p, d, ax, ay) {
  e.spin += dt;
  e.chargeT = (e.chargeT || rnd(5, 8)) - dt;
  if (e.charging > 0) {
    e.charging -= dt;
    if (Math.random() < 0.6) spawnParticle(e.x, e.y, rnd(-60, 60), rnd(-60, 60), 0.4, 7, 'rgba(255,120,160,0.7)');
  } else if (e.chargeT <= 0 && d < 700) {
    e.chargeT = rnd(6, 9); e.charging = 0.75;
    e.vx = ax * e.speed * 4.4; e.vy = ay * e.speed * 4.4;
    ring(e.x, e.y, 'rgba(255,90,120,0.85)', 20, 150, 0.4, 5);
    Audio_.blip(90, 0.35, 'sawtooth', 0.2, 60);
  } else {
    e.vx = lerp(e.vx, ax * e.speed, 0.03); e.vy = lerp(e.vy, ay * e.speed, 0.03);
  }
  e.fireT -= dt; e.summonT -= dt;
  const hpr = e.hp / e.maxhp;
  if (e.fireT <= 0) {
    e.fireT = hpr < 0.4 ? 1.5 : 2.4;
    const a0 = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.pattern === 'radial') {
      const n = hpr < 0.5 ? 20 : 14;
      for (let i = 0; i < n; i++) fireEBullet(e.x, e.y, a0 + i / n * TAU, 200, e.dmg * 0.5, 8, '#ff5c8a');
    } else if (e.pattern === 'spiral') {
      for (let k = 0; k < 3; k++) setTimeout(() => {
        if (e.dead || Game.state !== 'playing') return;
        for (let i = 0; i < 8; i++) fireEBullet(e.x, e.y, e.spin * 2 + i / 8 * TAU, 230, e.dmg * 0.42, 7, '#b98cff');
      }, k * 180);
    } else {
      for (let i = 0; i < 5; i++) fireEBullet(e.x, e.y, a0 + (i - 2) * 0.16, 320, e.dmg * 0.5, 9, '#ffe45e');
      ring(e.x, e.y, 'rgba(255,228,94,0.7)', 20, 140, 0.4, 5);
    }
    Audio_.blip(140, 0.24, 'sawtooth', 0.16, -60);
  }
  if (e.summonT <= 0) {
    e.summonT = 9;
    const avail = Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].from <= Game.t);
    for (let i = 0; i < 4; i++) {
      const a = rnd(TAU);
      spawnEnemy(pick(avail), e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
    }
    ring(e.x, e.y, 'rgba(255,120,160,0.8)', 30, 160, 0.5, 4);
  }
}

function hurtPlayer(dmg) {
  const p = Game.player;
  if (Game.state === 'attract') return;
  if (p.invuln > 0 || p.dashT > 0) return;
  if (p.shieldReady) {
    p.shieldReady = false; p.shieldT = 14 - (p.passives.shield || 1) * 3;
    ring(p.x, p.y, 'rgba(159,216,255,0.9)', 20, 90, 0.4, 5);
    dmgText(p.x, p.y - 32, '格挡', '#9fd8ff', 16); Audio_.blip(500, 0.2, 'sine', 0.2, 400);
    p.invuln = 0.5; return;
  }
  p.hp -= dmg; p.invuln = 0.45; p.hurtFlash = 0.35;
  cam.flash = Math.min(0.7, 0.22 + dmg / 90); cam.flashColor = '255,70,70';
  addShake(4 + dmg * 0.12); Audio_.hurt();
  dmgText(p.x, p.y - 26, '-' + Math.round(dmg), '#ff7b7b', 16);
  burst(p.x, p.y, 8, '#ff7b7b', 200, 0.4, 3);
  if (p.hp <= 0) { p.hp = 0; Game.die(); }
}

/* ------------------------------------------------------------- cards */
function rollCards() {
  const p = Game.player, out = [], poolW = [], poolP = [];
  const ownedW = Object.keys(p.weapons).length;
  for (const id of WEAPON_IDS) {
    const lv = p.weapons[id] || 0;
    if (lv >= WEAPONS[id].maxLv) continue;
    if (lv === 0 && ownedW >= 6) continue;
    poolW.push({ kind: 'weapon', id, lv });
  }
  for (const id of PASSIVE_IDS) {
    const lv = p.passives[id] || 0;
    if (lv >= PASSIVES[id].maxLv) continue;
    poolP.push({ kind: 'passive', id, lv });
  }
  const all = poolW.concat(poolP);
  const shuffled = all.sort(() => Math.random() - 0.5);
  for (const c of shuffled) {
    if (out.length >= 3) break;
    if (out.some(o => o.id === c.id)) continue;
    const def = c.kind === 'weapon' ? WEAPONS[c.id] : PASSIVES[c.id];
    out.push({
      kind: c.kind, id: c.id, lv: c.lv, name: def.name, icon: def.icon, color: def.color,
      desc: def.desc(c.lv), tag: c.lv === 0 ? 'NEW' : `Lv ${c.lv} → ${c.lv + 1}`,
      rarity: c.lv === 0 ? 'new' : c.lv >= 4 ? 'epic' : 'norm'
    });
  }
  while (out.length < 3) {
    out.push(Math.random() < 0.5
      ? { kind: 'heal', id: 'heal' + out.length, name: '维生舱', icon: '✚', color: '#8dffb0', desc: '立即回复 40% 生命', tag: '补给', rarity: 'norm' }
      : { kind: 'bomb', id: 'bomb' + out.length, name: '轨道轰炸', icon: '☢', color: '#ffd45c', desc: '清空屏幕上的敌人', tag: '补给', rarity: 'epic' });
  }
  return out;
}

/* -------------------------------------------------------------- draw */
let frameCount = 0;
const stars = [], debris = [];
function initStars() {
  stars.length = 0; debris.length = 0;
  for (let i = 0; i < 240; i++) stars.push({ x: rnd(-2000, 2000), y: rnd(-2000, 2000), z: rnd(0.25, 1), s: rnd(0.6, 2.1) });
  for (let i = 0; i < 26; i++) debris.push({ x: rnd(-2400, 2400), y: rnd(-1800, 1800), z: rnd(0.35, 0.8), r: rnd(14, 46), a: rnd(TAU), spin: rnd(-0.25, 0.25) });
}
let bgGrad = null, bgGradH = 0;
function drawBackground() {
  if (!bgGrad || bgGradH !== H) {
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a1226'); bgGrad.addColorStop(0.45, '#0b1530'); bgGrad.addColorStop(1, '#05070f');
    bgGradH = H;
  }
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

  // nebula blobs
  ctx.globalCompositeOperation = 'lighter';
  const t = Game.t;
  for (let i = 0; i < 3; i++) {
    const px = ((-cam.x * (0.06 + i * 0.03) + i * 700 + Math.sin(t * 0.05 + i) * 60) % (W + 900) + W + 900) % (W + 900) - 450;
    const py = ((-cam.y * (0.06 + i * 0.03) + i * 420 + Math.cos(t * 0.04 + i) * 50) % (H + 700) + H + 700) % (H + 700) - 350;
    const col = ['rgba(60,120,255,0.10)', 'rgba(255,70,170,0.09)', 'rgba(80,255,220,0.07)'][i];
    const grd = ctx.createRadialGradient(px, py, 0, px, py, 420);
    grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(px - 420, py - 420, 840, 840);
  }
  ctx.globalCompositeOperation = 'source-over';

  // parallax stars
  for (const s of stars) {
    const px = ((s.x - cam.x * s.z) % 2400 + 2400) % 2400 - 200;
    const py = ((s.y - cam.y * s.z) % 1800 + 1800) % 1800 - 200;
    if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue;
    ctx.fillStyle = `rgba(190,225,255,${0.25 + s.z * 0.5})`;
    ctx.fillRect(px, py, s.s, s.s);
  }

  // drifting debris (parallax)
  for (const d of debris) {
    const px = ((d.x - cam.x * d.z) % 2600 + 2600) % 2600 - 300;
    const py = ((d.y - cam.y * d.z) % 2000 + 2000) % 2000 - 300;
    if (px < -40 || py < -40 || px > W + 40 || py > H + 40) continue;
    ctx.save(); ctx.translate(px, py); ctx.rotate(d.a + Game.t * d.spin);
    ctx.strokeStyle = `rgba(120,180,255,${0.05 + d.z * 0.12})`; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const t = i / 5 * TAU; const rr = d.r * (0.7 + ((i * 37) % 10) / 22); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * rr, Math.sin(t) * rr); }
    ctx.closePath(); ctx.stroke(); ctx.restore();
  }

  // ground grid
  const step = 96;
  ctx.strokeStyle = 'rgba(96,160,250,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath();
  const ox = -(cam.x % step), oy = -(cam.y % step);
  for (let x = ox; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function drawGlow(key, x, y, size, alpha = 1) {
  const s = sprites[key]; if (!s) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

function drawEnemy(e) {
  const x = e.x - cam.x, y = e.y - cam.y;
  if (x < -80 || y < -80 || x > W + 80 || y > H + 80) return;
  ctx.save(); ctx.translate(x, y);
  const a = Math.atan2(e.vy, e.vx);
  const flash = e.flash > 0;
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(e.glow, 0, 0, e.r * (e.boss ? 6 : 4.2), e.boss ? 0.7 : 0.42);
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(a + Math.PI / 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  ctx.fillStyle = flash ? 'rgba(255,255,255,0.9)' : 'rgba(10,16,32,0.85)';
  const r = e.r;
  ctx.beginPath();
  if (e.shape === 'tri') { ctx.moveTo(0, -r); ctx.lineTo(r * 0.86, r * 0.7); ctx.lineTo(0, r * 0.35); ctx.lineTo(-r * 0.86, r * 0.7); }
  else if (e.shape === 'dart') { ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.62, r * 0.8); ctx.lineTo(0, r * 0.3); ctx.lineTo(-r * 0.62, r * 0.8); }
  else if (e.shape === 'hex') { for (let i = 0; i < 6; i++) { const t = i / 6 * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * r, Math.sin(t) * r); } }
  else if (e.shape === 'sq') { ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); }
  else if (e.shape === 'blob') { for (let i = 0; i < 9; i++) { const t = i / 9 * TAU; const rr = r * (0.82 + Math.sin(t * 3 + e.wob) * 0.18); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * rr, Math.sin(t) * rr); } }
  else { // boss
    ctx.lineWidth = 4;
    ctx.fillStyle = flash ? 'rgba(255,255,255,0.92)' : 'rgba(22,10,26,0.9)';
    for (let i = 0; i < 10; i++) { const t = i / 10 * TAU + e.spin * 0.4; const rr = r * (i % 2 ? 0.66 : 1.12); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * rr, Math.sin(t) * rr); }
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (e.boss) {
    // armoured core + charge tell
    ctx.strokeStyle = e.charging > 0 ? '#ffffff' : e.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.56, e.spin * 1.6, e.spin * 1.6 + 4.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.36, -e.spin * 2.1, -e.spin * 2.1 + 3.4); ctx.stroke();
    ctx.fillStyle = e.charging > 0 ? '#ffffff' : e.color;
    ctx.beginPath(); ctx.arc(0, 0, r * (0.17 + Math.sin(Game.t * 6) * 0.02), 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const t = e.spin * 0.9 + i / 4 * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(t) * r * 1.1, Math.sin(t) * r * 1.1);
      ctx.lineTo(Math.cos(t) * r * 1.45, Math.sin(t) * r * 1.45); ctx.lineWidth = 3; ctx.stroke();
    }
  }
  if (e.elite) { ctx.strokeStyle = 'rgba(255,215,120,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, TAU); ctx.stroke(); }
  ctx.restore();
  // hp bar for tough units
  if (!e.boss && e.maxhp > 40 && e.hp < e.maxhp) {
    const w = e.r * 2.2, hpr = clamp(e.hp / e.maxhp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - e.r - 12, w, 4);
    ctx.fillStyle = e.elite ? '#ffd45c' : '#ff6b8a'; ctx.fillRect(x - w / 2, y - e.r - 12, w * hpr, 4);
  }
}

function drawPlayer() {
  const p = Game.player, x = p.x - cam.x, y = p.y - cam.y;
  // shadow / aura
  ctx.globalCompositeOperation = 'lighter';
  drawGlow('glowCyan', x, y, 120, 0.42 + Math.sin(Game.t * 4) * 0.05);
  ctx.globalCompositeOperation = 'source-over';

  // pickup radius hint
  const st = Game.stats();
  ctx.strokeStyle = 'rgba(120,220,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, st.mag, 0, TAU); ctx.stroke();

  ctx.save(); ctx.translate(x, y); ctx.rotate(p.aim + Math.PI / 2);
  const hurt = p.hurtFlash > 0, inv = p.invuln > 0;
  ctx.globalAlpha = inv ? 0.55 + Math.sin(Game.t * 40) * 0.3 : 1;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = hurt ? '#ffffff' : '#9ff0ff';
  ctx.fillStyle = hurt ? 'rgba(255,140,140,0.9)' : 'rgba(16,40,64,0.92)';
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(12, 10); ctx.lineTo(5, 6); ctx.lineTo(0, 13); ctx.lineTo(-5, 6); ctx.lineTo(-12, 10);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(0, -3, 4, 0, TAU); ctx.fill();
  // thruster
  const thr = len(p.vx, p.vy) / 260;
  if (thr > 0.1) {
    ctx.fillStyle = `rgba(120,220,255,${0.5 * Math.min(1, thr)})`;
    ctx.beginPath(); ctx.moveTo(-5, 11); ctx.lineTo(5, 11); ctx.lineTo(0, 11 + 16 * Math.min(1.4, thr) + rnd(0, 5)); ctx.closePath(); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;

  if (p.shieldReady) {
    ctx.strokeStyle = `rgba(159,216,255,${0.4 + Math.sin(Game.t * 5) * 0.18})`;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, p.r + 12, 0, TAU); ctx.stroke();
  }
  // laser beam
  if (p.laser) {
    const L = p.laser, k = 1 - L.t / L.dur;
    const dx = Math.cos(L.a), dy = Math.sin(L.a);
    ctx.globalCompositeOperation = 'lighter';
    const grd = ctx.createLinearGradient(x, y, x + dx * 1400, y + dy * 1400);
    grd.addColorStop(0, 'rgba(109,255,194,0.95)'); grd.addColorStop(1, 'rgba(109,255,194,0)');
    ctx.strokeStyle = grd; ctx.lineWidth = L.w * (0.6 + k * 0.6); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 1400, y + dy * 1400); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = L.w * 0.28;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 1400, y + dy * 1400); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // orbit blades
  for (const o of orbits) {
    if (o.x === undefined) continue;
    const ox = o.x - cam.x, oy = o.y - cam.y;
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(o.a * 3);
    ctx.globalCompositeOperation = 'lighter'; drawGlow('glowPink', 0, 0, 44, 0.6); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ff9fd6'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
    ctx.restore();
  }
}

function drawWorld() {
  // mines
  for (const m of mines) {
    const x = m.x - cam.x, y = m.y - cam.y;
    const pulse = 0.5 + Math.sin(m.t * 8) * 0.5;
    ctx.globalCompositeOperation = 'lighter'; drawGlow('glowPink', x, y, 40 + pulse * 14, 0.5); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,92,138,${0.4 + pulse * 0.5})`; ctx.beginPath(); ctx.arc(x, y, m.r * 0.45, 0, TAU); ctx.fill();
  }
  // gems
  ctx.globalCompositeOperation = 'lighter';
  for (const g of gems.arr) {
    if (g.dead) continue;
    const x = g.x - cam.x, y = g.y - cam.y;
    if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
    const s = g.big ? 26 : 16;
    drawGlow(g.big ? 'glowGold' : 'glowGreen', x, y, s * 2, 0.85);
    ctx.fillStyle = g.big ? '#ffe45e' : '#8dffc9';
    ctx.save(); ctx.translate(x, y); ctx.rotate(g.t * 3);
    ctx.fillRect(-s / 5, -s / 5, s / 2.5, s / 2.5); ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  // pickups
  for (const k of pickups) {
    const x = k.x - cam.x, y = k.y - cam.y;
    const bob = Math.sin(k.t * 3) * 4;
    const map = { hp: ['glowGreen', '#8dffb0', '✚'], bomb: ['glowGold', '#ffd45c', '☢'], magnet: ['glowViolet', '#c4a6ff', '◉'], chest: ['glowGold', '#ffd45c', '★'] };
    const m = map[k.type];
    ctx.globalCompositeOperation = 'lighter'; drawGlow(m[0], x, y + bob, 56, 0.75); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = m[1]; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m[2], x, y + bob);
  }
  // enemy bullets
  ctx.globalCompositeOperation = 'lighter';
  for (const b of ebullets.arr) {
    if (b.dead) continue;
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
    drawGlow('glowRed', x, y, b.r * 6, 0.7);
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(x, y, b.r * 0.6, 0, TAU); ctx.fill();
  }
  // player bullets
  for (const b of bullets.arr) {
    if (b.dead) continue;
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    drawGlow('glowWhite', x, y, b.r * 5, 0.55);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = b.color;
    ctx.fillRect(-b.r * 1.6, -b.r * 0.42, b.r * 3.2, b.r * 0.84);
    ctx.restore();
  }
  // lightning beams
  for (const bm of beams) {
    const k = bm.life / bm.max;
    ctx.strokeStyle = bm.color; ctx.globalAlpha = k; ctx.lineWidth = 3 * k + 1;
    ctx.beginPath();
    const x1 = bm.x1 - cam.x, y1 = bm.y1 - cam.y, x2 = bm.x2 - cam.x, y2 = bm.y2 - cam.y;
    ctx.moveTo(x1, y1);
    const segs = 6;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const nx = lerp(x1, x2, t) + Math.sin(bm.seed + i * 3.1) * 14;
      const ny = lerp(y1, y2, t) + Math.cos(bm.seed + i * 2.3) * 14;
      ctx.lineTo(nx, ny);
    }
    ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save();
  ctx.translate(cam.shakeX, cam.shakeY);
  drawBackground();
  if (Game.player) {
    drawWorld();
    for (const e of enemies) drawEnemy(e);
    drawPlayer();
    drawParticles();
    drawTexts();
  }
  ctx.restore();

  // vignette
  ctx.drawImage(sprites.vignette, 0, 0, W, H);
  // damage flash
  if (cam.flash > 0.01) { ctx.fillStyle = `rgba(${cam.flashColor},${cam.flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
  // scanlines
  ctx.globalAlpha = 0.05; ctx.fillStyle = '#8fd5ff';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;
}

/* --------------------------------------------------------------- loop */
let last = 0, acc = 0;
const STEP = 1 / 60;
let touchable = false, lastState = '';
function loop(ts) {
  requestAnimationFrame(loop);
  if (Game.state !== lastState) {
    lastState = Game.state;
    const t = $('touch');
    if (t) t.classList.toggle('hidden', !touchable || Game.state !== 'playing');
  }
  if (!last) last = ts;
  let dt = (ts - last) / 1000; last = ts;
  dt = Math.min(dt, 0.1);
  frameCount++;

  if (Game.state === 'playing' || Game.state === 'attract') {
    const mode = Game.state;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 5) { update(STEP); acc -= STEP; if (Game.state !== mode) break; }
  } else if (Game.state === 'levelup' || Game.state === 'paused') {
    // slow ambient motion
    updateParticles(dt * 0.25);
    cam.shake *= 0.9;
  }
  render();
}

/* ----------------------------------------------------------------- UI */
const UI = {
  hud: $('hud'), menu: $('menu'), cardWrap: $('cards'), pause: $('pause'), dead: $('dead'), shop: $('shop'),
  bossBar: $('bossbar'), bossName: $('bossname'), bossFill: $('bossfill'),
  hideAll() { [this.menu, this.cardWrap, this.pause, this.dead, this.shop].forEach(e => e.classList.add('hidden')); this.hud.classList.add('hidden'); },
  announce(text) {
    const el = $('announce');
    el.textContent = text; el.classList.remove('show');
    void el.offsetWidth; el.classList.add('show');
  },
  updateHud() {
    const p = Game.player, g = Game;
    $('hpfill').style.width = clamp(p.hp / p.maxhp * 100, 0, 100) + '%';
    $('hptext').textContent = `${Math.ceil(p.hp)} / ${p.maxhp}`;
    $('xpfill').style.width = clamp(p.xp / p.xpNeed * 100, 0, 100) + '%';
    $('lvl').textContent = 'Lv ' + p.level;
    $('timer').textContent = fmtTime(g.t);
    $('kills').textContent = g.kills;
    $('credits').textContent = g.credits;
    const dcd = Math.max(0, p.dashCd);
    $('dashbtn').style.setProperty('--cd', (1 - dcd / 1.5) * 100 + '%');
    if (g.boss) {
      this.bossFill.style.width = clamp(g.boss.hp / g.boss.maxhp * 100, 0, 100) + '%';
    }
    if (frameCount % 12 === 0) this.renderLoadout();
  },
  renderLoadout() {
    const p = Game.player, el = $('loadout');
    let html = '';
    for (const id in p.weapons) {
      const w = WEAPONS[id];
      html += `<div class="slot" style="--c:${w.color}"><span>${w.icon}</span><i>${p.weapons[id]}</i></div>`;
    }
    for (const id in p.passives) {
      const w = PASSIVES[id];
      html += `<div class="slot pass" style="--c:${w.color}"><span>${w.icon}</span><i>${p.passives[id]}</i></div>`;
    }
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  },
  showCards(cards) {
    const wrap = $('cardlist');
    wrap.innerHTML = cards.map((c, i) => `
      <button class="card ${c.rarity}" data-i="${i}" style="--c:${c.color}">
        <div class="ckey">${i + 1}</div>
        <div class="cicon">${c.icon}</div>
        <div class="cname">${c.name}</div>
        <div class="ctag">${c.tag}</div>
        <div class="cdesc">${c.desc}</div>
      </button>`).join('');
    wrap.querySelectorAll('.card').forEach(b => b.onclick = () => Game.chooseCard(+b.dataset.i));
    this.cardWrap.classList.remove('hidden');
  },
  renderPauseBuild() {
    const p = Game.player;
    let html = '';
    for (const id in p.weapons) html += `<li><b style="color:${WEAPONS[id].color}">${WEAPONS[id].icon} ${WEAPONS[id].name}</b><span>Lv ${p.weapons[id]}</span></li>`;
    for (const id in p.passives) html += `<li><b style="color:${PASSIVES[id].color}">${PASSIVES[id].icon} ${PASSIVES[id].name}</b><span>Lv ${p.passives[id]}</span></li>`;
    $('buildlist').innerHTML = html;
  },
  showDead(earned) {
    $('d-time').textContent = fmtTime(Game.t);
    $('d-kills').textContent = Game.kills;
    $('d-level').textContent = Game.player.level;
    $('d-credits').textContent = '+' + earned;
    $('d-best').textContent = fmtTime(save.bestTime);
    this.dead.classList.remove('hidden');
  },
  showMenu() {
    this.hideAll(); this.menu.classList.remove('hidden');
    Game.start(true);
    $('m-best').textContent = fmtTime(save.bestTime);
    $('m-kills').textContent = save.bestKills;
    $('m-credits').textContent = save.credits;
  },
  renderShop() {
    $('s-credits').textContent = save.credits;
    $('shoplist').innerHTML = META.map(m => {
      const lv = save.meta[m.id] || 0, maxed = lv >= m.max, cost = m.cost(lv);
      return `<div class="srow ${maxed ? 'maxed' : ''}">
        <div class="sinfo"><b>${m.name}</b><span>${m.desc(lv + (maxed ? 0 : 1))}</span>
        <div class="pips">${Array.from({ length: m.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
        <button data-id="${m.id}" ${maxed || save.credits < cost ? 'disabled' : ''}>${maxed ? '已满级' : `${cost} ¤`}</button>
      </div>`;
    }).join('');
    $('shoplist').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => {
      const m = META.find(x => x.id === b.dataset.id), lv = save.meta[m.id] || 0, cost = m.cost(lv);
      if (lv >= m.max || save.credits < cost) return;
      save.credits -= cost; save.meta[m.id] = lv + 1; persist(); Audio_.levelup(); UI.renderShop();
    });
  }
};

/* --------------------------------------------------------- ui binding */
function bindUI() {
  $('btn-play').onclick = () => { Audio_.resume(); Game.start(); };
  $('btn-shop').onclick = () => { Audio_.ui(); UI.hideAll(); UI.shop.classList.remove('hidden'); UI.renderShop(); };
  $('btn-shop-back').onclick = () => { Audio_.ui(); UI.showMenu(); };
  $('btn-howto').onclick = () => { $('howto').classList.toggle('open'); Audio_.ui(); };
  $('btn-resume').onclick = () => Game.togglePause();
  $('btn-quit').onclick = () => { Audio_.ui(); UI.showMenu(); };
  $('btn-again').onclick = () => Game.start();
  $('btn-menu').onclick = () => { Audio_.ui(); UI.showMenu(); };
  $('btn-dead-shop').onclick = () => { Audio_.ui(); UI.hideAll(); UI.shop.classList.remove('hidden'); UI.renderShop(); };
  $('btn-pause').onclick = () => Game.togglePause();
  const mute = $('btn-mute');
  const syncMute = () => { mute.textContent = Audio_.muted ? '🔇' : '🔊'; mute.classList.toggle('off', Audio_.muted); };
  mute.onclick = () => { Audio_.resume(); Audio_.setMuted(!Audio_.muted); syncMute(); };
  syncMute();

  // joystick (mobile)
  const stick = $('stick'), knob = $('knob');
  const startJoy = (id, x, y) => {
    const r = stick.getBoundingClientRect();
    Input.joy.active = true; Input.joy.id = id; Input.joy.bx = r.left + r.width / 2; Input.joy.by = r.top + r.height / 2;
    moveJoy(x, y);
  };
  const moveJoy = (x, y) => {
    const dx = x - Input.joy.bx, dy = y - Input.joy.by, d = len(dx, dy), max = 52;
    const k = d > max ? max / d : 1;
    Input.joy.x = clamp(dx / max, -1, 1); Input.joy.y = clamp(dy / max, -1, 1);
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const endJoy = () => { Input.joy.active = false; Input.joy.id = -1; Input.joy.x = Input.joy.y = 0; knob.style.transform = 'translate(0,0)'; };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); stick.setPointerCapture(e.pointerId); Audio_.resume(); startJoy(e.pointerId, e.clientX, e.clientY); });
  stick.addEventListener('pointermove', e => { if (Input.joy.active && e.pointerId === Input.joy.id) moveJoy(e.clientX, e.clientY); });
  stick.addEventListener('pointerup', endJoy);
  stick.addEventListener('pointercancel', endJoy);
  $('dashbtn').addEventListener('pointerdown', e => { e.preventDefault(); Input.dashPressed = true; Audio_.resume(); });

  cv.addEventListener('pointerdown', () => Audio_.resume());
  document.querySelectorAll('[data-hall]').forEach(b => b.onclick = () => { location.href = 'index.html'; });
}

/* --------------------------------------------------------------- boot */
function boot() {
  resize(); buildSprites(); initStars(); bindUI();
  touchable = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  $('touch').classList.add('hidden');
  UI.showMenu();
  requestAnimationFrame(loop);
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();

window.__NS__ = { Game, save, enemies, WEAPONS, PASSIVES };
})();
