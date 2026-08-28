// ===== 像素乱斗 PIXEL BRAWL =====
'use strict';

// ---------- 基础 ----------
const W = 480, H = 270, GROUND = 226;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));

// ---------- 背景音乐（chipTune 音序器） ----------
// 旋律/低音用半音索引表达：C4=0, D4=2, E4=4, F4=5, G4=7, A4=9, B4=11, C5=12…；-1=休止
const BGM = {
  menu: {
    bpm: 92,
    mel:  [0,4,7,4, 9,7,4,2, 0,4,7,11, 9,7,4,-1, 0,4,7,4, 9,12,11,9, 7,9,7,4, 2,-1,-1,-1],
    bass: [0,-3,-1,-1, 0,-3,-1,-1, 0,-3,-1,-1, 7,-1,9,-1, 0,-3,-1,-1, 0,-3,-1,-1, 5,-1,4,-1, 2,-1,-1,-1]
  },
  battle: {
    bpm: 140,
    mel:  [0,0,3,5, 7,5,3,0, 7,7,8,7, 5,3,5,7, 10,10,12,10, 9,7,5,3, 5,5,7,8, 9,8,7,5],
    bass: [0,-1,-1,-1, 0,-1,-1,-1, 5,-1,-1,-1, 3,-1,-1,-1, 0,-1,-1,-1, 0,-1,-1,-1, 5,-1,4,-1, 3,-1,2,-1]
  },
  boss: {
    bpm: 168,
    mel:  [0,0,3,4, 7,7,10,12, 7,7,8,7, 5,3,5,0, 0,0,3,4, 7,7,10,12, 14,12,10,7, 10,9,7,5],
    bass: [0,-1,-1,-1, 0,-1,-1,-1, 7,-1,-1,-1, 5,-1,-1,-1, 12,-1,-1,-1, 10,-1,-1,-1, 5,-1,4,-1, 3,-1,2,-1]
  }
};
const BGM_STATE = { timer: null, step: 0, nextT: 0, song: null, on: false };
function freqOf(semi) { return Math.pow(2, semi / 12) * 261.63; }
function bgmNote(semi, t, dur, type, vol) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freqOf(semi);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function bgmTick() {
  if (!BGM_STATE.on || !BGM_STATE.song || !AC) return;
  const s = BGM[BGM_STATE.song], spb = 60 / s.bpm / 4;
  while (BGM_STATE.nextT < AC.currentTime + 0.15) {
    const m = s.mel[BGM_STATE.step % s.mel.length];
    const b = s.bass[BGM_STATE.step % s.bass.length];
    if (m >= 0) bgmNote(m, BGM_STATE.nextT, spb * 0.92, 'square', 0.045);
    if (b >= 0) bgmNote(m + b, BGM_STATE.nextT, spb * 0.92, 'triangle', 0.07);
    BGM_STATE.nextT += spb; BGM_STATE.step++;
  }
}
function startBGM(song) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { return; }
  BGM_STATE.song = song; BGM_STATE.step = 0; BGM_STATE.nextT = AC.currentTime + 0.05;
  BGM_STATE.on = true;
  if (!BGM_STATE.timer) BGM_STATE.timer = setInterval(bgmTick, 30);
}
function stopBGM() {
  BGM_STATE.on = false;
  if (BGM_STATE.timer) { clearInterval(BGM_STATE.timer); BGM_STATE.timer = null; }
}

// ---------- 音效（WebAudio 极简合成） ----------
let AC = null;
function sfx(kind) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    if (kind === 'hit')      { o.type='square';   o.frequency.setValueAtTime(160,t); o.frequency.exponentialRampToValueAtTime(60,t+.1); g.gain.setValueAtTime(.15,t); g.gain.exponentialRampToValueAtTime(.001,t+.12); o.start(t); o.stop(t+.13); }
    else if (kind === 'kick'){ o.type='square';   o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(40,t+.14); g.gain.setValueAtTime(.18,t); g.gain.exponentialRampToValueAtTime(.001,t+.16); o.start(t); o.stop(t+.17); }
    else if (kind === 'shot'){ o.type='sine';     o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(900,t+.18); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.2); o.start(t); o.stop(t+.21); }
    else if (kind === 'jump'){ o.type='sine';     o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(440,t+.1); g.gain.setValueAtTime(.08,t); g.gain.exponentialRampToValueAtTime(.001,t+.12); o.start(t); o.stop(t+.13); }
    else if (kind === 'block'){ o.type='triangle';o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(740,t+.06); g.gain.setValueAtTime(.10,t); g.gain.exponentialRampToValueAtTime(.001,t+.09); o.start(t); o.stop(t+.1); }
    else if (kind === 'super'){ o.type='sawtooth'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(820,t+.4); g.gain.setValueAtTime(.16,t); g.gain.exponentialRampToValueAtTime(.001,t+.45); o.start(t); o.stop(t+.46); }
    else if (kind === 'win')  { o.type='square';   o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(660,t+.09); o.frequency.setValueAtTime(880,t+.18); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.start(t); o.stop(t+.31); }
    else if (kind === 'alarm'){ o.type='sawtooth'; o.frequency.setValueAtTime(120,t); o.frequency.setValueAtTime(110,t+.15); o.frequency.setValueAtTime(120,t+.3); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.45); o.start(t); o.stop(t+.46); }
    else if (kind === 'ko')  { o.type='sawtooth'; o.frequency.setValueAtTime(400,t); o.frequency.exponentialRampToValueAtTime(50,t+.5); g.gain.setValueAtTime(.2,t); g.gain.exponentialRampToValueAtTime(.001,t+.55); o.start(t); o.stop(t+.56); }
  } catch(e) {}
}

// ---------- 输入 ----------
const input = { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };
const input2 = { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };
// 每个输入源独立记录按下帧，避免1P/2P/AI互相覆盖
let GFRAME = 0;
const pressFrame1 = { punch: -999, kick: -999, special: -999 };
const pressFrame2 = { punch: -999, kick: -999, special: -999 };
const pressFrameAI = { punch: -999, kick: -999, special: -999 };
// 1P：ASDW + J/K/L；2P：方向键 + 4/5/6
const KEYMAP = {
  a:'left', d:'right', w:'jump', s:'block',
  j:'punch', k:'kick', l:'special'
};
const KEYMAP2 = {
  arrowleft:'left', arrowright:'right', arrowup:'jump', arrowdown:'block',
  '4':'punch', '5':'kick', '6':'special'
};
function dispatchKey(e, isDown) {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { input[KEYMAP[k]] = isDown; if (isDown) pressFrame1[KEYMAP[k]] = GFRAME; e.preventDefault(); }
  if (KEYMAP2[k]) { input2[KEYMAP2[k]] = isDown; if (isDown) pressFrame2[KEYMAP2[k]] = GFRAME; e.preventDefault(); }
}
addEventListener('keydown', e => { dispatchKey(e, true); });
addEventListener('keyup', e => { dispatchKey(e, false); });

addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'p' && G.state !== 'title' && G.state !== 'result') {
    togglePause();
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'r' && G.training && G.state !== 'paused') {
    resetTrainingPosition();
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'm') {
    toggleMute();
    e.preventDefault();
  }
});

// 静音开关（音乐 + 音效）
function toggleMute() {
  const btn = document.getElementById('btn-mute');
  if (!btn) return;
  const isMuted = btn.dataset.muted === '1';
  if (!isMuted) { stopBGM(); AC && AC.suspend(); }
  else { if (G.state === 'title') startBGM('menu'); else if (G.state !== 'result') { startBGM(G.training ? 'menu' : 'battle'); AC && AC.resume(); } }
  btn.dataset.muted = isMuted ? '0' : '1';
  btn.textContent = isMuted ? '♪' : '×';
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  } catch (e) {
    // iOS Safari 不支持标准 Fullscreen API：页面本身仍按横向布局可玩
  }
}

// ===== 触屏输入：容器级事件委托（1P/2P 共用）=====
// - 多点独立跟踪（每根手指/指针独立）
// - 滑动联动：按住方向键滑到攻击键 → 边移动边出招（多点不可用的兜底）
function bindKeys(containerSel, keySel, target, pressFrames) {
  const touchEl = document.querySelector(containerSel);
  if (!touchEl) return;
  const keys = () => Array.from(touchEl.querySelectorAll(keySel));

  const hitKey = (x, y) => {
    for (const el of keys()) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el.dataset.k;
    }
    return null;
  };

  // 活动指针：id -> { cur: 当前键, pressed: 按过的一组键 }
  const active = new Map();

  function press(id, k) {
    if (!k) return;
    if (active.has(id)) {
      const p = active.get(id);
      if (p.cur === k) {
        // 同 id 再次按下：视为新触点（iOS 快速连点偶发丢 pointerup，防卡键）
        for (const kk of p.pressed) target[kk] = false;
        active.delete(id);
      } else {
        target[k] = true; 
        if (pressFrames && pressFrames[k] !== undefined) pressFrames[k] = GFRAME;
        p.pressed.add(k); p.cur = k;
        return;
      }
    }
    target[k] = true;
    if (pressFrames && pressFrames[k] !== undefined) pressFrames[k] = GFRAME;
    active.set(id, { cur: k, pressed: new Set([k]) });
  }
  function moveTo(id, k) {
    const p = active.get(id);
    if (!p || !k || k === p.cur) return;
    // 滑入新键：按下并保持此前所有键（滑动联动：左→拳 = 边移动边出拳）
    target[k] = true; 
    if (pressFrames && pressFrames[k] !== undefined) pressFrames[k] = GFRAME;
    p.pressed.add(k); p.cur = k;
  }
  function release(id) {
    const p = active.get(id);
    if (!p) return;
    for (const k of p.pressed) target[k] = false;
    active.delete(id);
  }

  // —— 轨道1：Pointer Events（iOS13+ / 现代内核，天然多指针）——
  if (window.PointerEvent) {
    touchEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      press(e.pointerId, hitKey(e.clientX, e.clientY));
    }, { passive: false });
    touchEl.addEventListener('pointermove', e => {
      moveTo(e.pointerId, hitKey(e.clientX, e.clientY));
    }, { passive: true });
    touchEl.addEventListener('pointerup', e => { release(e.pointerId); });
    touchEl.addEventListener('pointercancel', e => { release(e.pointerId); });
  }

  // —— 轨道2：Touch Events（iOS Safari 始终绑定：WebKit 以 touch 序列识别双击/双指手势，
  //    双轨幂等绑定保证两条路径都能驱动输入；相同触摸在双轨各触发一次，置位/清位幂等无害）——
  if (window.TouchEvent) {
    const touchesToIds = new Map();   // identifier -> 自增 id（与 pointerId 域隔离，互不冲突）
    let nextId = 1000;
    const idOf = (t) => {
      if (!touchesToIds.has(t.identifier)) touchesToIds.set(t.identifier, nextId++);
      return touchesToIds.get(t.identifier);
    };
    touchEl.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) press(idOf(t), hitKey(t.clientX, t.clientY));
    }, { passive: false });
    touchEl.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) moveTo(idOf(t), hitKey(t.clientX, t.clientY));
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) { release(idOf(t)); touchesToIds.delete(t.identifier); }
    };
    touchEl.addEventListener('touchend', end);
    touchEl.addEventListener('touchcancel', end);
  }
}

// 触摸手势拦截：只覆盖触屏键区域（.tk/.tk2 已各自 touch-action:none + preventDefault）。
// 切勿全局 preventDefault touchstart——iOS Safari 会因此不再生成 click，标题按钮将失灵。
// 此处兜底：触屏键容器内的 touchmove 也不允许滚动（键区外的滚动由页面本身禁止）。
bindKeys('#touch', '.tk', input, pressFrame1);   // 1P：下半区
bindKeys('#touch', '.tk2', input2, pressFrame2); // 2P：上半区
// 触屏层仅在真正的触屏设备显示（防桌面 Chrome 误判）
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
function showTouch() { if (IS_TOUCH) document.getElementById('touch').classList.remove('hidden'); }
function hideTouch() { document.getElementById('touch').classList.add('hidden'); }

// ---------- 招式表 ----------
const ATTACKS = {
  // cancelFrom：命中帧后可被其他攻击取消（参考街霸引擎的可中断窗口）
  // hitStop：受击顿帧（大厂手感分级：轻攻短顿/重攻长顿/超必杀最强顿）
  punch:   { dmg:6,  total:.28, activeFrom:.06, activeTo:.14, reach:26, h:14,  kb:70,  stun:.28, cd:.30, oy:-26, combo:true, cancelFrom:.14, hitStop:.045 },
  punch2:  { dmg:7,  total:.24, activeFrom:.04, activeTo:.10, reach:30, h:14,  kb:90,  stun:.30, cd:.02, oy:-28, combo:true, cancelFrom:.10, hitStop:.05 },
  kick3:   { dmg:12, total:.36, activeFrom:.10, activeTo:.20, reach:34, h:16,  kb:150, stun:.48, cd:.02, oy:-14, last:true, cancelFrom:.20, hitStop:.075 },
  kick:    { dmg:10, total:.40, activeFrom:.12, activeTo:.24, reach:32, h:16,  kb:120, stun:.42, cd:.55, oy:-16, cancelFrom:.24, hitStop:.06 },
  airpunch:{ dmg:8,  total:.30, activeFrom:.06, activeTo:.14, reach:28, h:14,  kb:90,  stun:.35, cd:.02, oy:-26, air:true, hitStop:.05 },
  special: { dmg:14, total:.50, activeFrom:.22, activeTo:.30, cd:2.2, projectile:true, hitStop:.08 },
  super:   { dmg:30, total:.70, activeFrom:.25, activeTo:.35, cd:3.0, projectile:true, super:true, hitStop:.14 }
};
const COMBO_NEXT = { punch: 'punch2', punch2: 'kick3' };

// ---------- 连段挑战（训练模式教学关卡） ----------
const TRIALS = [
  { seq: ['punch', 'punch2', 'kick3'], name: '三段连击（快速连按 J）' },
  { seq: ['punch', 'kick'],            name: '拳→脚取消（J·K）' },
  { seq: ['punch', 'super'],           name: '拳→超必杀（满能量 J·L）' },
  { seq: ['airpunch'],                 name: '空中拳（跳起按 J）' },
  { seq: ['super'],                    name: '超必杀（满能量按 L）' }
];
function endsWithSeq(arr, seq) {
  if (arr.length < seq.length) return false;
  for (let i = 0; i < seq.length; i++) {
    if (arr[arr.length - seq.length + i] !== seq[i]) return false;
  }
  return true;
}
function initTrials() {
  G.trials = TRIALS.map(t => ({ seq: t.seq, name: t.name, done: false }));
  renderTrialPanel();
}
// 帧数据面板（SF6 训练房简化版）：实时显示当前招式的启动/判定/总帧
function updateFrameData() {
  const el = document.getElementById('frame-data');
  if (!el) return;
  const p = G.p1;
  if (!p || !p.attack) {
    if (el.dataset.empty !== '1') { el.dataset.empty = '1'; el.innerHTML = '空闲 · 出招查看帧数'; }
    return;
  }
  const a = ATTACKS[p.attack];
  const F = (s) => Math.round(s * 60);
  el.dataset.empty = '0';
  el.innerHTML = '<b>' + attackLabel(p.attack) + '</b> 启动 ' + F(a.activeFrom) + 'f 判定 ' + F(a.activeTo) + 'f 总 ' + F(a.total) + 'f';
}
function attackLabel(name) {
  const map = { punch:'直拳', punch2:'快拳', kick3:'上踢', kick:'回旋踢', airpunch:'空中拳', special:'波动拳', super:'超必杀' };
  return map[name] || name;
}

function updateTrials() {
  if (!G.trials || !G.p1 || G.trials.every(t => t.done)) return;
  const log = G.p1.atkLog;
  let changed = false;
  for (const t of G.trials) {
    if (!t.done && endsWithSeq(log, t.seq)) { t.done = true; changed = true; sfx('win'); }
  }
  if (changed) {
    renderTrialPanel();
    if (G.trials.every(t => t.done) && !G.trialsAllDone) {
      G.trialsAllDone = true;
      document.getElementById('trial-status').textContent = '全部达成！';
    }
  }
}
function renderTrialPanel() {
  const list = document.getElementById('trial-list');
  if (!list) return;
  list.innerHTML = '';
  for (const t of G.trials) {
    const row = document.createElement('div');
    row.className = 'trial-row' + (t.done ? ' done' : '');
    row.innerHTML = '<span class="trial-mark">' + (t.done ? '✓' : '·') + '</span><span class="trial-name">' + t.name + '</span>';
    list.appendChild(row);
  }
  const st = document.getElementById('trial-status');
  if (st) st.textContent = G.trials.filter(t => t.done).length + ' / ' + G.trials.length;
}
        
// 可用角色参数表（胜负手差异：速度/血量/伤害倍率）
const CHARACTERS = {
  fighter: { name:'小烈', hp:100, speed:105, dmg:1.00, desc:'均衡 · 速度型', side:'H' },
  blob:    { name:'阿蓝', hp:125, speed:88,  dmg:1.25, desc:'重装 · 血厚攻高', side:'H' },
  miko:    { name:'小桃', hp:108, speed:97,  dmg:1.12, desc:'迅捷 · 连打型', side:'H' },
  monkey:  { name:'大圣', hp:95,  speed:115, dmg:1.15, desc:'齐天 · 高速棍', side:'H' },
  nezha:   { name:'哪吒', hp:105, speed:100, dmg:1.06, desc:'三太子 · 火尖枪', side:'H' },
  gourd:   { name:'娃',   hp:118, speed:92,  dmg:1.22, desc:'葫芦娃 · 硬碰硬', side:'H' },
  demon:   { name:'黑煞', hp:130, speed:84,  dmg:1.32, desc:'魔尊 · 重锤', side:'V' },
  viper:   { name:'蛇姬', hp:110, speed:108, dmg:1.18, desc:'蛊惑 · 高机动', side:'V' }
};
// 通用人形角色外观配置（英雄/反派统一模板，各带特色装饰）
const ROSTER = ['fighter', 'blob', 'miko', 'monkey', 'nezha', 'gourd', 'demon', 'viper'];

const CAST_CFG = {
  monkey: { hair:'#d8a020', style:'topknot', gi:'#ffcf5a', belt:'#e04828', face:'#ffcf9e', deco:'staff',  deco2:'#ffe95c' },
  nezha:  { hair:'#3a2a3a', style:'buns',    gi:'#e83838', belt:'#e0e0e0', face:'#ffe2d0', deco:'spear',  deco2:'#ffd8a0' },
  gourd:  { hair:'#1c1c22', style:'gourd',   gi:'#3a8a3a', belt:'#d8d8d8', face:'#ffd8b0', deco:'gourd',  deco2:'#ff9d2e' },
  demon:  { hair:'#14141c', style:'horns',   gi:'#3a2a52', belt:'#7a5ae8', face:'#b98a6a', deco:'cape',   deco2:'#d83858' },
  viper:  { hair:'#4a9a4a', style:'flow',    gi:'#6a3a8a', belt:'#d8a030', face:'#d8b898', deco:'scales', deco2:'#8ae05a' }
};

// AI 难度参数（反应间隔 / 格挡概率 / 后撤倾向）
const DIFFICULTY = {
  easy:   { react: [0.28, 0.55], guard: 0.18, retreat: 0.45 },
  normal: { react: [0.15, 0.40], guard: 0.42, retreat: 0.60 },
  hard:   { react: [0.07, 0.22], guard: 0.60, retreat: 0.72 }
};

// AI 行为性格（概率分布，读取时逐项累计成阈值）
const AI_PERSONAS = {
  rush:    { jump: .20, punch: .45, kick: .15, special: .08, retreat: .10, guard: .26, approach: .72 },
  guard:   { jump: .06, punch: .22, kick: .08, special: .10, retreat: .42, guard: .64, approach: .34 },
  balance: { jump: .12, punch: .30, kick: .14, special: .10, retreat: .26, guard: .44, approach: .56 },
  bossRush:{ jump: .24, punch: .50, kick: .18, special: .10, retreat: .06, guard: .30, approach: .78 }
};

// ---------- 战士 ----------
class Fighter {
  constructor(opts) {
    const cfg = CHARACTERS[opts.type] || CHARACTERS.fighter;
    const setHp = ('hp' in opts) ? opts.hp : 100;
    Object.assign(this, {
      x: 0, y: GROUND, vx: 0, vy: 0, facing: 1,
      type: 'blob', name: '???',
      hp: setHp, maxHp: setHp,
      dmg: cfg.dmg, speed: cfg.speed,
      state: 'idle',        // idle|walk|jump|attack|hit|block|ko|win
      stateT: 0,
      attack: null,         // 当前招式名
      hitDone: false,       // 本次攻击是否已命中
      cd: { punch:0, kick:0, special:0 },
      meter: 50, maxMeter: 100,
      blocking: false,
      lowWarned: false,
      squash: 0,
      flash: 0,
      isAI: false,
      aiTimer: 0, aiMove: 0, aiAct: null,
      aiScale: 1,        // 街机模式逐层强化系数
      persona: 'balance',  // rush | guard | balance（AI 行为性格）
      combo: 0, comboDmg: 0,
      walkPhase: 0,
      aiGuard: 0,
      buf: { punch: 0, kick: 0, special: 0 },
      prev: { punch: false, kick: false, special: false },
      atkLog: []               // 连段挑战用：最近攻击名序列
    }, opts);
  }

  get onGround() { return this.y >= GROUND - 0.5; }
  get hurtbox() {
    const slim = this.type === 'fighter' || this.type === 'miko' ||
    this.type === 'monkey' || this.type === 'nezha' || this.type === 'gourd' ||
    this.type === 'demon' || this.type === 'viper';
    const w = slim ? 22 : 30;
    return { x: this.x - w/2, y: this.y - (slim ? 48 : 46), w: w, h: slim ? 48 : 46 };
  }

  // 攻击输入捕获：帧号按下判定（消费式，快速连按不丢，无需"仍按住"）
  captureAttackInput(inp, pf) {
    for (const k of ['punch', 'kick', 'special']) {
      // 核心修复：只要帧号记录有效（<=1帧前按下），就算当前已松手也消费
      if (pf[k] >= 0 && GFRAME - pf[k] <= 1) {
        this.buf[k] = 25;
        pf[k] = -999;   // 消费本次按下
      }
    }
  }

  startAttack(name) {
    const a = ATTACKS[name];
    if (!a) return false;

    // 连招链：连续输入 punch 推进到下一段（punch → punch2 → kick3）
    if (this.state === 'attack' && name === 'punch' && this.attack && ATTACKS[this.attack].combo) {
      const next = COMBO_NEXT[this.attack];
      if (next) {
        // 启动下一段：继承首次输入的进攻意志，重置攻击状态
        this.attack = next; this.stateT = 0; this.hitDone = false;
        this.atkLog.push(next);
        if (this.atkLog.length > 8) this.atkLog.shift();
        return true;
      }
    }
    if (this.cd[name] > 0 || this.state === 'attack' || this.state === 'hit' || this.state === 'ko') return false;

    // 空中攻击
    if (name === 'punch' && !this.onGround) name = 'airpunch';

    // 超必杀：能量满时波动拳升级
    let isSuper = false;
    if (name === 'special' && this.meter >= 100) { name = 'super'; isSuper = true; }

    if (name === 'special' && this.meter < 35) return false;
    this.blocking = false;
    this.state = 'attack'; this.stateT = 0;
    this.attack = name; this.hitDone = false;
      this.atkLog.push(name);
    if (this.atkLog.length > 8) this.atkLog.shift();
    this.cd[name] = ATTACKS[name].cd;
    if (name === 'special' || name === 'super') {
      this.meter -= (isSuper ? 100 : 35);
      sfx(isSuper ? 'super' : 'shot');
      if (isSuper) goldenFlash();
    }
    return true;
  }

  takeHit(dmg, dir, kb, stun, attacker) {
    if (this.state === 'ko') return;
    const foeInFront = Math.sign(attacker.x - this.x) === this.facing;
    const guarded = this.blocking && this.onGround && foeInFront && this.state !== 'attack';
    const finalDmg = guarded ? Math.max(1, Math.ceil(dmg * 0.28)) : dmg;
    this.hp = Math.max(0, this.hp - finalDmg);
    // 低血量警示（每回合首次跌破 25% 播一次）
    if (this.hp > 0 && this.hp < this.maxHp * 0.25 && !this.lowWarned) {
      this.lowWarned = true;
      sfx('alarm');
    }
    hitNums.push({
      x: this.x + rand(-8, 8), y: this.y - 48, vy: -32, t: 0, life: guarded ? .55 : .7,
      txt: guarded ? 'GUARD ' + finalDmg : '-' + finalDmg,
      color: guarded ? '#7ad8ff' : (finalDmg >= 20 ? '#ffe95c' : '#ff8b2e')
    });
    attacker.meter = clamp(attacker.meter + (guarded ? 5 : 14), 0, attacker.maxMeter);
    this.meter = clamp(this.meter + (guarded ? 9 : 5), 0, this.maxMeter);

    if (guarded) {
      this.state = 'block'; this.stateT = 0;
      this.vx = dir * kb * 0.18;
      this.flash = .08;
      G.hitStop = .02; G.shake = 1;
      this.squash = .07;
      spawnSparks(this.x, this.y - 30, dir, true);
      sfx('block');
      if (this.hp <= 0) {
        this.blocking = false;
        this.state = 'ko'; this.stateT = 0;
        this.vx = dir * 80; this.vy = -90;
        onKO(attacker, this);
      }
      return;
    }

    this.blocking = false;
    this.state = 'hit'; this.stateT = 0;
    this.attack = null; this.hitDone = true;
    this.vx = dir * kb;
    if (!this.onGround) this.vy = -80;
    this.flash = .12;
    attacker.combo++;
    attacker.comboDmg += finalDmg;
    // 分级顿帧（大厂手感：轻/重/必杀各不同时长）+ 受击挤压
    const attAtk = attacker.attack ? ATTACKS[attacker.attack] : null;
    G.hitStop = Math.min(.18, (attAtk && attAtk.hitStop) || .05);
    this.squash = .16;
    G.shake = attAtk && attAtk.hitStop > .1 ? 5 : 3;
    spawnSparks(this.x, this.y - 30, dir, false, finalDmg >= 20);
    sfx(dmg >= 10 ? 'kick' : 'hit');
    if (this.hp <= 0) {
      this.state = 'ko'; this.stateT = 0;
      this.vx = dir * 160; this.vy = -140;
      onKO(attacker, this);
    }
  }

  update(dt, foe, inp, pf) {
    pf = pf || { punch: -999, kick: -999, special: -999 };
    // 冷却与能量自然恢复
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.meter = clamp(this.meter + dt * 5, 0, this.maxMeter);
    this.flash = Math.max(0, this.flash - dt);
    this.squash = Math.max(0, this.squash - dt * 2.6);   // 受击挤压衰减

    // 胜利姿势：动作展示，不受输入影响
    if (this.state === 'win') {
      this.stateT += dt;
      return;
    }

    // KO 倒地
    if (this.state === 'ko') {
      this.vy += 500 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.y > GROUND) { this.y = GROUND; this.vy = 0; this.vx *= .8; }
      this.x = clamp(this.x, 16, W - 16);
      return;
    }

    // 受击硬直
    if (this.state === 'hit') {
      this.captureAttackInput(inp, pf);
      this.stateT += dt;
      this.vy += 500 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.y > GROUND) { this.y = GROUND; this.vy = 0; }
      this.vx *= Math.pow(.02, dt);
      this.x = clamp(this.x, 16, W - 16);
      if (this.stateT > .32 && this.onGround) { this.state = 'idle'; this.stateT = 0; }
      return;
    }

    // 格挡：仅地面可用，按住期间持续减伤
    if (this.state === 'block') {
      this.stateT += dt;
      this.blocking = !!inp.block && this.onGround;
      this.vy += 500 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.y > GROUND) { this.y = GROUND; this.vy = 0; }
      this.vx *= Math.pow(.01, dt);
      this.x = clamp(this.x, 16, W - 16);
      if (!this.blocking) { this.state = 'idle'; this.stateT = 0; }
      return;
    }

    // 攻击进行中
    if (this.state === 'attack') {
      this.stateT += dt;
      const a = ATTACKS[this.attack];

      // —— 可取消窗口（街霸引擎取消语义）：activeTo 之后可按其他攻击/波动取消 ——
      if (a.cancelFrom !== undefined && this.stateT >= a.cancelFrom) {
        // 边沿检测：只判定帧号，不要求"仍按住"（手机快点已松手）
        const edge = (k) => {
          if (pf[k] >= 0 && GFRAME - pf[k] <= 1) {
            pf[k] = -999;   // 消费本次按下（取消路径）
            return true;
          }
          return false;
        };
        const kickP = edge('kick') && this.cd.kick <= 0;
        const specialP = edge('special') && this.meter >= 35;
        const punchP = edge('punch');
        if (kickP) { this.attack = 'kick'; this.stateT = 0; this.hitDone = false; this.cd.kick = ATTACKS.kick.cd; sfx('block'); this.atkLog.push('kick'); }
        else if (specialP) {
          const sup = this.meter >= 100;
          this.attack = sup ? 'super' : 'special'; this.stateT = 0; this.hitDone = false;
          this.cd.special = ATTACKS[this.attack].cd;
          this.meter -= sup ? 100 : 35;
          sfx(sup ? 'super' : 'shot');
          if (sup) goldenFlash();
          this.atkLog.push(this.attack);
        }
        else if (punchP && this.attack === 'punch') {   // 拳→拳→上踢 连段链
          const next = COMBO_NEXT.punch;
          if (next) { this.attack = next; this.stateT = 0; this.hitDone = false; this.atkLog.push(next); }
        }
        else if (punchP && this.attack === 'punch2') {  // 第二段接终结踢
          this.attack = 'kick3'; this.stateT = 0; this.hitDone = false; this.atkLog.push('kick3');
        }
        else if (punchP && ATTACKS[this.attack].combo !== true && this.attack !== 'kick' && this.attack !== 'airpunch') {
          this.attack = 'punch'; this.stateT = 0; this.hitDone = false; this.atkLog.push('punch'); // 其他攻击可用拳重置
        }
      } else {
        // 未到取消窗口：提前按下先进缓冲，帧期结束自动出手
        this.captureAttackInput(inp, pf);
      }

      if (!this.hitDone && this.stateT >= a.activeFrom && this.stateT <= a.activeTo) {
        if (a.projectile) {
          if (!this.hitDone) {
            this.hitDone = true;
            const superShot = !!a.super;
            G.projectiles.push({ x: this.x + this.facing*20, y: this.y - 26,
              vx: this.facing * (superShot ? 320 : 220),
              dmg: Math.round(a.dmg * this.dmg), owner: this, life: 1.6,
              r: superShot ? 13 : 7, super: superShot });
            if (superShot) G.shake = 4;
          }
        } else {
          const hx = this.x + this.facing * a.reach;
          const hb = { x: Math.min(hx, this.x), y: this.y + a.oy - a.h/2, w: Math.abs(hx - this.x), h: a.h };
          const fb = foe.hurtbox;
          if (hb.x < fb.x + fb.w && hb.x + hb.w > fb.x && hb.y < fb.y + fb.h && hb.y + hb.h > fb.y) {
            this.hitDone = true;
            const dmg = Math.round(a.dmg * this.dmg);
            foe.takeHit(dmg, this.facing, a.kb, a.stun, this);
            if (a.last && foe.state !== 'ko') { foe.vy = -90; foe.vx = this.facing * 110; } // 终结踢上挑
          }
        }
      }
      if (this.stateT >= a.total) { this.state = this.onGround ? 'idle' : 'jump'; this.stateT = 0; this.attack = null; }
      // 攻击时轻微前移
      if (this.onGround) this.vx *= Math.pow(.01, dt);
      this.x = clamp(this.x + this.vx * dt, 16, W - 16);
      return;
    }

    // ---- 常规控制（玩家输入 或 AI 虚拟输入）----
    const JUMP = -215;
    let move = 0;
    if (inp.left) move -= 1;
    if (inp.right) move += 1;

    if (inp.block && this.onGround) {
      this.blocking = true;
      this.state = 'block'; this.stateT = 0;
      this.vx = 0;
      return;
    }
    this.blocking = false;
    if (inp.jump && this.onGround) { this.vy = JUMP; sfx('jump'); }

    // 攻击输入：边沿捕获 + 缓冲消费（可行动立即出手，不可行则暂存）
    this.captureAttackInput(inp, pf);
    for (const k of ['punch', 'kick', 'special']) {
      if (this.buf[k] > 0) {
        if (this.startAttack(k)) { this.buf[k] = 0; return; }  // 攻击建立，本帧结束（防后续覆盖 state）
        this.buf[k]--;
      }
    }

    this.vy += 500 * dt;
    this.x += move * this.speed * dt;
    this.y += this.vy * dt;
    if (this.y > GROUND) { this.y = GROUND; this.vy = 0; }
    if (move !== 0 && this.onGround) { this.state = 'walk'; this.walkPhase += dt * 10; }
    else if (this.onGround) this.state = 'idle';
    else this.state = 'jump';

    // 面向对手
    if (foe && this.state !== 'attack') this.facing = foe.x >= this.x ? 1 : -1;
    this.x = clamp(this.x, 16, W - 16);

    // 身体碰撞推挤
    if (foe) {
      const dx = this.x - foe.x;
      if (Math.abs(dx) < 22 && Math.abs(this.y - foe.y) < 40 && dx !== 0) {
        const push = (22 - Math.abs(dx)) / 2 * Math.sign(dx);
        this.x = clamp(this.x + push, 16, W - 16);
      }
    }
  }

  // ---------- AI ----------
  aiInput(dt, foe) {
    const out = { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };
    if (this.state === 'ko' || foe.state === 'ko') return out;
    if (this.aiGuard > 0) {
      this.aiGuard -= dt;
      out.block = true;
      return out;
    }
    this.aiTimer -= dt;
    const diff = DIFFICULTY[G.difficulty] || DIFFICULTY.normal;
    const per = AI_PERSONAS[this.persona] || AI_PERSONAS.balance;
    const dist = Math.abs(foe.x - this.x);
    if (this.aiTimer <= 0) {
      this.aiTimer = rand(diff.react[0], diff.react[1]) / this.aiScale;
      this.aiMove = 0; this.aiAct = null;
      const r = Math.random();
      // 行为概率：性格权重累积成阈值（approach / jump / special / retreat）
      const seek = per.approach, sp = seek + per.special, jp = sp + per.jump;
      if (dist > 110) {
        if (r < seek) this.aiMove = Math.sign(foe.x - this.x);
        else if (r < sp) this.aiAct = 'special';
        else if (r < jp) { this.aiMove = Math.sign(foe.x - this.x); this.aiAct = 'jump'; }
      } else if (dist > 46) {
        const rp = jp + per.retreat;
        if (r < seek * .85) this.aiMove = Math.sign(foe.x - this.x);
        else if (r < sp + per.jump * .5) this.aiAct = 'jump';
        else if (r < jp + per.special * .4) this.aiAct = 'special';
        else if (r < rp) this.aiMove = -Math.sign(foe.x - this.x); // 后撤
      } else {
        const gScale = Math.min(.8, per.guard + (this.aiScale - 1) * .18); // 性格+街机层数决定格挡概率
        const pp = per.punch, kp = pp + per.kick, rp = kp + per.retreat;
        if (foe.state === 'attack' && r < gScale) this.aiGuard = rand(.18, .42);
        else if (r < pp) this.aiAct = 'punch';
        else if (r < kp) this.aiAct = 'kick';
        else if (r < rp) this.aiMove = -Math.sign(foe.x - this.x);
        else if (r < rp + per.jump) this.aiAct = 'jump';
      }
    }
    if (this.aiMove === 1) out.right = true;
    if (this.aiMove === -1) out.left = true;
    if (this.aiAct === 'jump') { out.jump = true; this.aiAct = null; }
    if (this.aiAct === 'punch') { out.punch = true; pressFrameAI.punch = GFRAME; this.aiAct = null; }
    if (this.aiAct === 'kick') { out.kick = true; pressFrameAI.kick = GFRAME; this.aiAct = null; }
    if (this.aiAct === 'special') { out.special = true; pressFrameAI.special = GFRAME; this.aiAct = null; }
    return out;
  }
}

// ---------- 特效 ----------
let particles = [];
let hitNums = [];   // 浮动伤害数字：{x,y,vy,txt,life,t,color}
function spawnSparks(x, y, dir, guarded = false, heavy = false) {
  // Sakurai 式分级反馈：重击火花更多/更大/飞更远
  const n = heavy ? 22 : 10;
  for (let i = 0; i < n; i++) {
    particles.push({ x, y: y + rand(-6,6)*(heavy?2:1),
      vx: dir * rand(30, heavy?230:160) + rand(-40,40), vy: rand(-150,40),
      life: rand(.18, heavy?.55:.35), t: 0,
      c: guarded ? (Math.random() < .5 ? '#b8f6ff' : '#5ccfff') : (Math.random() < .5 ? '#ffe95c' : '#ff8b2e'),
      s: irand(2,4) * (heavy ? 2 : 1) });
  }
}

// 超必杀命中爆发
function spawnSuperBurst(x, y) {
  const colors = ['#ffe95c', '#ffd83a', '#fff8d0', '#ff9d2e'];
  for (let i = 0; i < 26; i++) {
    particles.push({ x: x + rand(-6,6), y: y + rand(-6,6),
      vx: rand(-190,190), vy: rand(-190,60),
      life: rand(.25,.5), t: 0,
      c: colors[irand(0, colors.length-1)], s: irand(3,6) });
  }
  G.shake = Math.max(G.shake, 5);
}

// 超必杀释放金光
// KO 白闪（全屏白闪 0.3s，GGST/SF6 KO 演出风格）
function whiteFlash() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:31;pointer-events:none;background:#fff;animation:wfade .3s ease-out forwards;';
  document.head.appendChild(document.createElement('style')).textContent =
    '@keyframes wfade{from{opacity:.9}to{opacity:0}}';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 320);
}

function goldenFlash() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;' +
    'background:radial-gradient(ellipse at center,rgba(255,240,150,.85),rgba(255,180,40,.35) 45%,transparent 75%);' +
    'animation:goldfade .5s ease-out forwards;';
  document.head.appendChild(document.createElement('style')).textContent =
    '@keyframes goldfade{from{opacity:1}to{opacity:0}}';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 520);
}

// ---------- 全局游戏状态 ----------
const G = {
  state: 'title',       // title|vs|intro|fight|ko|timeup|training-ko|paused|result
  pausedFrom: null,
  training: false,
  mode: 'vsai',         // vsai | pvp | train | arcade
  scene: 'day',
  vsTimer: 0,
  playerType: 'fighter',
  difficulty: 'normal',
  time: 60,
  koTimer: 0,
  introT: 0,
  winner: null,         // 当前回合胜者
  matchWinner: null,
  round: 1,
  wins: { p1: 0, p2: 0 },
  roundCause: '',
  shake: 0,
  hitStop: 0,
  projectiles: [],
  comboShow: 0, comboSide: 1, comboT: 0,
  p1: null, p2: null
};

const NO_INPUT = Object.freeze({ left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false });
const NO_PRESS_FRAME = Object.freeze({ punch: -999, kick: -999, special: -999 });
function clearInput() { for (const k in input) input[k] = false; for (const k in input2) input2[k] = false; }
function show2P() { if (IS_TOUCH) document.getElementById('tc-2p').classList.remove('hidden'); }
function hide2P() { document.getElementById('tc-2p').classList.add('hidden'); }

function startMatch(mode) {
  G.mode = mode || 'vsai';       // vsai | pvp | train | arcade
  G.training = (G.mode === 'train');
  if (G.mode === 'pvp') show2P(); else hide2P();
  if (G.mode === 'arcade') {
    G.arcade = {
      stage: 1,
      score: 0,
      boss: false,
      best: parseInt(localStorage.getItem('pixelbrawl_best') || '0', 10) || 0
    };
  }
  startBGM(G.mode === 'train' ? 'menu' : 'battle');
  G.round = 1;
  G.wins = { p1: 0, p2: 0 };
  G.matchWinner = null;
  startRound();
}

function startTraining() {
  startMatch('train');
  initTrials();
  G.trialsAllDone = false;
  document.getElementById('trial-panel').classList.remove('hidden');
}

function startRound() {
  const p1c = CHARACTERS[G.playerType];
  const heroes = ROSTER.filter(t => CHARACTERS[t].side === 'H' && t !== G.playerType);
  let p2Type = heroes[0] || 'blob';
  let aiScale = 1, hpBoost = 0, persona = 'balance';
  if (G.mode === 'arcade') {
    // 街机剧本：前4战英雄轮换（平衡→侵略→龟壳→侵略），第5战反派黑煞 Boss
    const personaOrder = ['balance', 'rush', 'guard', 'rush', 'bossRush'];
    const stage = G.arcade.stage;
    G.arcade.boss = stage === 5;
    p2Type = G.arcade.boss ? 'demon' : heroes[(stage - 1) % heroes.length];
    aiScale = G.arcade.boss ? 1.95 : (1 + (stage - 1) * 0.22);
    hpBoost = Math.min(80, (stage - 1) * 12);
    persona = personaOrder[Math.min(4, stage - 1)];
    if (G.arcade.boss) startBGM('boss');
    else startBGM('battle');
  }
  const p2c = CHARACTERS[p2Type];
  G.p1 = new Fighter({ x: 140, facing: 1, type: G.playerType, name: p1c.name, hp: p1c.hp, isAI: false });
  G.p2 = new Fighter({ x: 340, facing: -1, type: p2Type, name: p2c.name, hp: p2c.hp + hpBoost, isAI: true, aiScale, persona });
  G.projectiles = []; particles = []; hitNums = [];
  G.time = G.training ? Infinity : 60;
  G.winner = null; G.roundCause = '';
  G.pausedFrom = null;
  G.shake = 0; G.hitStop = 0; G.comboShow = 0; G.comboT = 0;
  G.introT = 0;
  G.scene = pickScene();
  G.vsTimer = 0;
  G.trialsAllDone = false;
  if (G.training && G.trials) initTrials();   // 每轮复位连段挑战
  G.state = G.training ? 'fight' : ((G.mode === 'vsai' || G.mode === 'arcade') ? 'vs' : 'intro');
  if (!G.training) document.getElementById('trial-panel').classList.add('hidden');
  clearInput();
  document.getElementById('result').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  showTouch();
  document.getElementById('btn-pause').classList.remove('hidden');
}

function resetTrainingPosition() {
  if (!G.training) return;
  startRound();
}

function togglePause() {
  if (G.state === 'paused') {
    G.state = G.pausedFrom || (G.training ? 'fight' : 'intro');
    G.pausedFrom = null;
    document.getElementById('pause').classList.add('hidden');
    showTouch();
    if (G.mode === 'pvp') show2P();
    document.getElementById('btn-pause').classList.remove('hidden');
    if (AC && AC.state === 'suspended') AC.resume();
    return;
  }
  if (G.state === 'fight' || G.state === 'intro') {
    G.pausedFrom = G.state;
    G.state = 'paused';
    clearInput();
    hideTouch();
    document.getElementById('pause').classList.remove('hidden');
    document.getElementById('btn-pause').classList.add('hidden');
    if (AC && AC.state === 'running') AC.suspend();
  }
}

function quitToTitle() {
  G.state = 'title';
  G.training = false;
  G.pausedFrom = null;
  clearInput();
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('btn-pause').classList.add('hidden');
  document.getElementById('trial-panel').classList.add('hidden');
  hideTouch();
  hide2P();
  document.getElementById('result').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
  startBGM('menu');
}

function finishRound(winner, cause) {
  if (G.state !== 'fight') return;
  G.winner = winner;
  if (winner) { winner.state = 'win'; winner.stateT = 0; sfx('win'); }
  if (G.training) {
    G.roundCause = cause;
    G.koTimer = 0;
    G.state = 'training-ko';
    sfx('ko'); G.shake = 6; G.hitStop = .16; whiteFlash();
    return;
  }
  G.roundCause = cause;
  G.koTimer = 0;
  if (winner === G.p1) G.wins.p1++;
  if (winner === G.p2) G.wins.p2++;
  if (cause === 'ko') {
    G.state = 'ko';
    sfx('ko'); G.shake = 6; G.hitStop = .16; whiteFlash();
  } else {
    G.state = 'timeup';
    G.shake = 2;
  }
}

function onKO(winner, loser) {
  finishRound(winner, 'ko');
}

function advanceAfterRound() {
  if (G.training) {
    resetTrainingPosition();
    return;
  }
  if (G.mode === 'arcade') {
    if (!G.winner) { startRound(); return; }            // 平局重赛
    if (G.winner === G.p2) {                   // 挑战失败
      G.matchWinner = G.p2;
      endMatch();
      return;
    }
    G.arcade.score += 1000 + Math.round(G.p1.hp) * 10;
    if (G.arcade.stage >= 5) {                 // 通关
      G.arcade.score += 5000;
      G.matchWinner = G.p1;
      endMatch();
      return;
    }
    G.arcade.stage++;
    G.p1.hp = G.p1.maxHp;                      // 每战回满
    startRound();
    return;
  }
  if (G.wins.p1 >= 2 || G.wins.p2 >= 2) {
    G.matchWinner = G.wins.p1 >= 2 ? G.p1 : G.p2;
    endMatch();
    return;
  }
  // 时间耗尽且血量相等：本回合重赛，不消耗赛点
  if (!G.winner) {
    startRound();
    return;
  }
  G.round++;
  startRound();
}

function endMatch() {
  G.state = 'result';
  document.getElementById('btn-pause').classList.add('hidden');
  hideTouch();
  hide2P();
  stopBGM();
  const rt = document.getElementById('result-text');
  const rd = document.getElementById('result-detail');
  const winner = G.matchWinner;
  if (!winner) {
    rt.textContent = 'DRAW';
    rd.textContent = '平局 — 本局重赛！';
  } else if (G.mode === 'arcade') {
    const cleared = G.matchWinner === G.p1;          // 通关看胜者，不看舞台编号
    if (cleared) G.arcade.score += Math.round(G.p1.hp) * 2;
    if (G.arcade.score > G.arcade.best) {
      G.arcade.best = G.arcade.score;
      try { localStorage.setItem('pixelbrawl_best', String(G.arcade.best)); } catch (e) {}
    }
    const pct = Math.round(G.p1.hp / G.p1.maxHp * 100);
    const grade = pct >= 90 ? 'S' : (pct >= 70 ? 'A' : (pct >= 45 ? 'B' : 'C'));
    rt.textContent = cleared ? 'CLEAR!' : 'GAME OVER';
    const bestTxt = G.arcade.score >= G.arcade.best && G.arcade.score > 0 ? ' · 新纪录!' : '';
    rd.textContent = (cleared ? '街机通关！' : '到达第 ' + Math.max(1, G.arcade.stage) + ' 战') +
      (cleared ? ' · 评级 ' + grade + ' · 幸存 ' + pct + '%' : '') +
      ' · 得分 ' + G.arcade.score + bestTxt + ' · 最佳 ' + G.arcade.best;
  } else if (G.mode === 'pvp') {
    rt.textContent = 'MATCH WIN';
    rd.textContent = (winner === G.p1 ? '1P 获胜！' : '2P 获胜！') + ' · 比分 ' + G.wins.p1 + ' : ' + G.wins.p2;
  } else {
    rt.textContent = 'MATCH WIN';
    rd.textContent = (winner === G.p1 ? '你赢了！' : '阿蓝 获胜') + ' · 比分 ' + G.wins.p1 + ' : ' + G.wins.p2;
  }
  document.getElementById('result').classList.remove('hidden');
}

// ---------- 场景系统（5 套配色主题，街机按阶段切换） ----------
const SCENES = {
  day:     { sky:['#5a7ea6','#a8b89a','#c9b98a'], hill1:'#7d8a6a', hill2:'#96a37e', tree:'#4a7a3a', trunk:'#6b4a2a', ground:'#8a9a5a', ground2:'#7a8a4a', fence:'#8a6a42' },
  evening: { sky:['#3a4a6a','#c98a5a','#e8b07a'], hill1:'#5a6a5a', hill2:'#7a8a6a', tree:'#3a5a3a', trunk:'#5a3a2a', ground:'#9a8a5a', ground2:'#7a6a4a', fence:'#6a5a3a' },
  night:   { sky:['#0a0a2a','#1a1a3a','#0a1224'], hill1:'#2a3a4a', hill2:'#3a4a5a', tree:'#1a3a2a', trunk:'#3a2a1a', ground:'#3a4a3a', ground2:'#2a3a2a', fence:'#4a3a2a', stars:true },
  dojo:    { sky:['#3a2a1a','#5a4a2a','#7a6a3a'], hill1:'#4a3a2a', hill2:'#5a4a2a', tree:'#2a4a2a', trunk:'#4a2a1a', ground:'#6a5a3a', ground2:'#5a4a2a', fence:'#5a3a2a' },
  starry:  { sky:['#0a0a1a','#1a0a2a','#0a0a1a'], hill1:'#2a2a3a', hill2:'#3a2a3a', tree:'#1a2a1a', trunk:'#2a1a1a', ground:'#2a2a3a', ground2:'#1a1a2a', fence:'#3a2a2a', stars:true }
};
const ARCADE_SCENE_ORDER = ['day', 'evening', 'night', 'dojo', 'starry'];
function pickScene() {
  if (G.mode === 'arcade') return ARCADE_SCENE_ORDER[Math.min(4, G.arcade.stage - 1)];
  return 'day';
}
  // 场景画布缓存（每个主题预渲染一次）
const bgCanvasMap = {};
function buildBG(sceneKey) {
  const sc = SCENES[sceneKey] || SCENES.day;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const b = c.getContext('2d');
  // 天空
  const sky = b.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, sc.sky[0]); sky.addColorStop(.6, sc.sky[1]); sky.addColorStop(1, sc.sky[2]);
  b.fillStyle = sky; b.fillRect(0, 0, W, GROUND);
  // 云（白昼/黄昏）
  if (!sc.stars) {
    b.fillStyle = 'rgba(255,255,255,.45)';
    [[60,30,50],[200,22,40],[330,40,60],[420,26,36]].forEach(([x,y,w]) => {
      b.fillRect(x, y, w, 8); b.fillRect(x+8, y-5, w-16, 5);
    });
  }
  // 远山
  b.fillStyle = sc.hill1;
  b.beginPath(); b.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 40) b.lineTo(x, 150 - Math.abs(Math.sin(x*.013))*60);
  b.lineTo(W, GROUND); b.fill();
  b.fillStyle = sc.hill2;
  b.beginPath(); b.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 30) b.lineTo(x, 185 - Math.abs(Math.sin(x*.02+2))*35);
  b.lineTo(W, GROUND); b.fill();
  // 树
  function tree(x, y, s) {
    b.fillStyle = sc.trunk; b.fillRect(x-2*s, y-14*s, 4*s, 14*s);
    b.fillStyle = sc.tree;
    b.fillRect(x-10*s, y-24*s, 20*s, 10*s);
    b.fillRect(x-7*s, y-30*s, 14*s, 7*s);
  }
  tree(70, 200, 1.6); tree(410, 205, 2.1); tree(250, 198, 1.2);
  // 星光（夜场景）
  if (sc.stars) {
    let seed = 12345;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    b.fillStyle = '#e8e8ff';
    for (let i = 0; i < 60; i++) b.fillRect(Math.floor(rnd()*W), Math.floor(rnd()*120), 2, 2);
  }
  // 地面
  b.fillStyle = sc.ground; b.fillRect(0, GROUND, W, H-GROUND);
  b.fillStyle = sc.ground2;
  for (let x = 0; x < W; x += 8) b.fillRect(x, GROUND + ((x*7)%3)*2, 5, 2);
  b.fillRect(0, GROUND+10, W, 2);
  // 栅栏
  b.fillStyle = sc.fence;
  for (let x = 10; x < W; x += 26) b.fillRect(x, 196, 3, 14);
  b.fillRect(0, 199, W, 2); b.fillRect(0, 205, W, 2);
  return c;
}
function sceneCanvas() {
  const k = G.scene || 'day';
  if (!bgCanvasMap[k]) bgCanvasMap[k] = buildBG(k);
  return bgCanvasMap[k];
}

// ---------- 像素小人绘制 ----------
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

function drawFighter(f, time) {
  ctx.save();
  ctx.translate(Math.round(f.x), Math.round(f.y));
  // 受击挤压（Squash & Stretch）：横向拉宽+纵向压扁，随 squash 衰减回正
  if (f.squash > 0) ctx.scale(1 + f.squash * 1.4, 1 - f.squash * 0.75);
  ctx.scale(f.facing, 1);
  if (f.flash > 0) ctx.globalAlpha = .5 + Math.sin(time*60)*.4;

  const t = time;
  const bob = f.state === 'idle' ? Math.round(Math.sin(t*4)*1) : 0;
  const S = f.type;

  if (S === 'blob') drawBlob(f, t, bob);
  else if (S === 'miko') drawMiko(f, t, bob);
  else if (S === 'fighter') drawMartial(f, t, bob);
  else drawCast(f, t, bob, CAST_CFG[S] || CAST_CFG.monkey);

  if (f.state === 'win') {
    // 胜利姿势：双臂上举（按角色配色）
    const bounce = Math.round(Math.sin(time * 8) * 1) - 4;
    if (f.type === 'blob') {
      px(-12, -58 + bounce, 5, 24, '#3a8ad8'); px(-14, -60 + bounce, 8, 8, '#f4f4f0');
      px(7, -58 + bounce, 5, 24, '#3a8ad8');  px(6, -60 + bounce, 8, 8, '#f4f4f0');
    } else {
      px(-11, -56 + bounce, 5, 22, '#ff8b2e'); px(-13, -58 + bounce, 8, 8, '#ffcf9e');
      px(7, -56 + bounce, 5, 22, '#ff8b2e');  px(6, -58 + bounce, 8, 8, '#ffcf9e');
    }
  }

  if (f.blocking || f.state === 'block') {
    // 受击方向的像素护盾
    px(9, -47, 3, 32, 'rgba(130,235,255,.75)');
    px(12, -43, 2, 24, 'rgba(220,255,255,.9)');
  }

  ctx.restore();
}

function drawMiko(f, t, bob) {
  const ko = f.state === 'ko';
  ctx.save();
  if (ko) { ctx.rotate(-Math.PI/2 * Math.min(1, f.stateT*3)); ctx.translate(0, -8); }
  const SK = '#ffe2d0', HAIR = '#3a2a3a', GI = '#ff9ec4', GI_D = '#d86a9e', BELT = '#6a3ac8';

  const legSpread = f.state === 'walk' ? Math.sin(f.walkPhase)*3 : 0;
  // 腿（白袜）
  px(-8 + legSpread, -14, 6, 14, '#f4f0f0');
  px(2 - legSpread, -14, 6, 14, '#f4f0f0');
  px(-9 + legSpread, -3, 8, 3, '#d8382a');    // 红鞋
  px(1 - legSpread, -3, 8, 3, '#d8382a');
  // 躯干（桃色和服）
  px(-9, -34+bob, 18, 21, GI);
  px(-2, -34+bob, 4, 21, '#fff8f4');          // 白襟
  px(-9, -20+bob, 18, 3, BELT);               // 紫腰带
  px(-9, -34+bob, 18, 4, GI_D);               // 领阴影
  // 头
  px(-8, -50+bob, 16, 16, SK);
  // 丸子头（双丸）
  px(-11, -56+bob, 7, 7, HAIR);
  px(4, -56+bob, 7, 7, HAIR);
  px(-9, -54+bob, 18, 6, HAIR);
  // 眉眼
  if (f.state === 'hit' || f.state === 'ko') {
    px(-6, -44+bob, 5, 2, '#222'); px(1, -44+bob, 5, 2, '#222');
  } else if (f.state === 'attack') {
    px(-6, -46+bob, 12, 2, '#a03020');
    px(-6, -43+bob, 4, 3, '#222'); px(2, -43+bob, 4, 3, '#222');
  } else {
    px(-6, -44+bob, 4, 4, '#222'); px(2, -44+bob, 4, 4, '#222');
  }
  // 嘴
  px(-2, -38+bob, 5, 2, '#c86a5a');

  // 手臂
  if (f.state === 'attack' && f.attack === 'punch') {
    const ext = f.stateT > ATTACKS.punch.activeFrom ? 1 : 0;
    px(6, -30+bob, 12+10*ext, 5, GI);
    px(17+10*ext, -31+bob, 6, 6, SK);
  } else if (f.state === 'attack' && f.attack === 'special') {
    px(6, -30+bob, 12, 5, GI);
    px(16, -32+bob, 6, 8, SK);
    px(6, -26+bob, 12, 5, GI);
    px(16, -26+bob, 6, 6, SK);
  } else {
    px(-13, -32+bob, 5, 13, GI); px(9, -32+bob, 5, 13, GI);
    px(-14, -20+bob, 6, 5, SK);  px(9, -20+bob, 6, 5, SK);
  }
  // 踢腿
  if (f.state === 'attack' && f.attack === 'kick' && f.stateT > ATTACKS.kick.activeFrom) {
    px(2, -18, 22, 6, GI); px(22, -20, 7, 7, '#d8382a');
  }
  ctx.restore();
}

// 通用人形角色立绘模板（大圣/哪吒/娃/黑煞/蛇姬共用骨架 + 各自装饰）
function drawCast(f, t, bob, c) {
  const ko = f.state === 'ko';
  ctx.save();
  if (ko) { ctx.rotate(-Math.PI/2 * Math.min(1, f.stateT*3)); ctx.translate(0, -8); }

  // 背景装饰（在身体后）：金箍棒 / 火尖枪 / 披风
  if (c.deco === 'staff') {
    px(10, -64+bob, 3, 30, '#c89a30'); px(10, -64+bob, 3, 4, '#ffe95c'); px(10, -38+bob, 3, 4, '#ffe95c');
  } else if (c.deco === 'spear') {
    px(11, -60+bob, 2, 26, '#e83838'); px(10, -62+bob, 4, 4, '#ffd8a0');
  } else if (c.deco === 'cape') {
    px(-13, -34+bob, 26, 20, '#5a1a2a');
    px(-11, -18+bob, 22, 6, '#4a1220');
  }

  const legSpread = f.state === 'walk' ? Math.sin(f.walkPhase)*3 : 0;
  // 腿
  px(-8 + legSpread, -14, 6, 14, c.gi);
  px(2 - legSpread, -14, 6, 14, c.gi);
  px(-9 + legSpread, -3, 8, 3, '#2a1a10');
  px(1 - legSpread, -3, 8, 3, '#2a1a10');
  // 躯干 + 腰带
  px(-9, -34+bob, 18, 21, c.gi);
  px(-9, -20+bob, 18, 3, c.belt);
  if (c.deco === 'scales') { px(-6, -30+bob, 3, 3, c.deco2); px(0, -26+bob, 3, 3, c.deco2); px(3, -31+bob, 3, 3, c.deco2); }
  // 头
  px(-8, -50+bob, 16, 16, c.face);
  // 发型
  if (c.style === 'topknot') {
    px(-9, -56+bob, 18, 7, c.hair); px(-2, -60+bob, 4, 5, c.hair);
    px(-10, -52+bob, 2, 4, c.hair); px(8, -52+bob, 2, 4, c.hair);   // 猴耳
    px(-9, -55+bob, 18, 2, '#ffe95c');                              // 金箍
  } else if (c.style === 'buns') {
    px(-10, -58+bob, 6, 6, c.hair); px(4, -58+bob, 6, 6, c.hair);
    px(-9, -54+bob, 18, 6, c.hair);
    px(-11, -57+bob, 2, 4, '#e83838'); px(9, -57+bob, 2, 4, '#e83838'); // 红头绳
  } else if (c.style === 'gourd') {
    px(-9, -54+bob, 18, 6, c.hair);
    px(-3, -62+bob, 6, 7, '#ff9d2e'); px(-2, -64+bob, 4, 3, '#3a8a3a'); // 头顶葫芦
  } else if (c.style === 'horns') {
    px(-9, -55+bob, 18, 6, c.hair);
    px(-11, -60+bob, 3, 7, '#c8b8e8'); px(8, -60+bob, 3, 7, '#c8b8e8'); // 双角
    px(-6, -46+bob, 3, 2, '#d83858');                                    // 眼疤
  } else if (c.style === 'flow') {
    px(-12, -54+bob, 24, 8, c.hair);
    px(-12, -50+bob, 4, 14, c.hair); px(8, -50+bob, 4, 14, c.hair);     // 披肩发
  }
  // 眉眼
  if (f.state === 'hit' || f.state === 'ko') {
    px(-6, -44+bob, 5, 2, '#222'); px(1, -44+bob, 5, 2, '#222');
  } else if (f.state === 'attack') {
    px(-6, -46+bob, 12, 2, '#802020');
    px(-6, -43+bob, 4, 3, '#222'); px(2, -43+bob, 4, 3, '#222');
  } else {
    px(-6, -44+bob, 4, 4, '#222'); px(2, -44+bob, 4, 4, '#222');
  }
  px(-2, -38+bob, 5, 2, '#a05a40');
  // 手臂
  if (f.state === 'attack' && f.attack === 'punch') {
    const ext = f.stateT > ATTACKS.punch.activeFrom ? 1 : 0;
    px(6, -30+bob, 12+10*ext, 5, c.gi);
    px(17+10*ext, -31+bob, 6, 6, c.face);
  } else if (f.state === 'attack' && f.attack === 'special') {
    px(6, -30+bob, 12, 5, c.gi);  px(16, -32+bob, 6, 8, c.face);
    px(6, -26+bob, 12, 5, c.gi);  px(16, -26+bob, 6, 6, c.face);
  } else {
    px(-13, -32+bob, 5, 13, c.gi); px(9, -32+bob, 5, 13, c.gi);
    px(-14, -20+bob, 6, 5, c.face); px(9, -20+bob, 6, 5, c.face);
  }
  // 踢腿
  if (f.state === 'attack' && f.attack === 'kick' && f.stateT > ATTACKS.kick.activeFrom) {
    px(2, -18, 22, 6, c.gi); px(22, -20, 7, 7, '#2a1a10');
  }
  ctx.restore();
}

function drawBlob(f, t, bob) {
  const ko = f.state === 'ko';
  ctx.save();
  if (ko) { ctx.rotate(-Math.PI/2 * Math.min(1, f.stateT*3)); ctx.translate(0, -8); }
  const B = '#3a8ad8', BD = '#2a6aa8', WHT = '#f4f4f0', SK = '#ffcf9e';
  const wobble = f.state === 'walk' ? Math.sin(f.walkPhase)*2 : 0;

  // 脚
  px(-12 + wobble, -4, 10, 5, WHT);
  px(2 - wobble, -4, 10, 5, WHT);
  // 身体（圆胖）
  px(-14, -40+bob, 28, 36, B);
  px(-12, -42+bob, 24, 3, B);
  px(-14, -12, 28, 4, BD);
  // 白肚皮
  px(-8, -26+bob, 16, 20, WHT);
  px(-4, -18+bob, 8, 5, '#e8e8e0');  // 口袋
  // 红项圈
  px(-13, -42+bob, 26, 4, '#d8382a');
  px(9, -40+bob, 4, 4, '#ffe95c');   // 铃铛
  // 头部区域
  px(-13, -58+bob, 26, 18, B);
  // 眼睛
  const eyeY = -54+bob;
  if (f.state === 'hit' || f.state === 'ko') {
    px(-10, eyeY, 6, 2, '#222'); px(-1, eyeY, 6, 2, '#222'); // >< 眼
  } else {
    px(-10, eyeY-3, 8, 9, WHT); px(2, eyeY-3, 8, 9, WHT);
    px(-7, eyeY, 3, 5, '#222'); px(5, eyeY, 3, 5, '#222');
  }
  // 鼻子+胡须
  px(-2, eyeY+8, 5, 4, '#d8382a');
  px(-16, eyeY+7, 8, 1, '#333'); px(-16, eyeY+10, 8, 1, '#333');
  px(9, eyeY+7, 8, 1, '#333');  px(9, eyeY+10, 8, 1, '#333');
  // 嘴
  if (f.state === 'attack' && f.attack === 'special') {
    px(-4, eyeY+13, 9, 6, '#8a3a30'); // 张嘴发射
  } else {
    px(-4, eyeY+13, 9, 2, '#8a3a30');
  }

  // 手臂
  if (f.state === 'attack' && (f.attack === 'punch' || f.attack === 'special')) {
    const ext = f.stateT > .05 ? 1 : 0;
    px(10, -34+bob, 14*ext+6, 6, B);
    px(20+8*ext, -35+bob, 7, 8, WHT); // 拳头
  } else {
    px(-18, -34+bob, 6, 14, B); px(12, -34+bob, 6, 14, B);
    px(-19, -22+bob, 7, 6, WHT); px(12, -22+bob, 7, 6, WHT);
  }
  // 踢腿
  if (f.state === 'attack' && f.attack === 'kick' && f.stateT > .1) {
    px(8, -18, 18, 7, B); px(24, -19, 8, 8, WHT);
  }
  ctx.restore();
}

// 小烈：橙色武道服刺猬头
function drawMartial(f, t, bob) {
  const ko = f.state === 'ko';
  ctx.save();
  if (ko) { ctx.rotate(-Math.PI/2 * Math.min(1, f.stateT*3)); ctx.translate(0, -8); }
  const SK = '#ffcf9e', HAIR = '#22222a', GI = '#ff8b2e', GI_D = '#d86a18', BLUE = '#3a6ad8';

  const legSpread = f.state === 'walk' ? Math.sin(f.walkPhase)*3 : 0;
  // 腿
  px(-8 + legSpread, -14, 6, 14, GI);
  px(2 - legSpread, -14, 6, 14, GI);
  px(-9 + legSpread, -3, 8, 3, '#4a3020'); // 鞋
  px(1 - legSpread, -3, 8, 3, '#4a3020');
  // 躯干
  px(-9, -34+bob, 18, 21, GI);
  px(-9, -20+bob, 18, 3, BLUE);  // 腰带
  px(-9, -34+bob, 18, 4, GI_D);  // 领口阴影
  px(-2, -34+bob, 4, 14, BLUE);  // 内衬
  // 头
  px(-8, -50+bob, 16, 16, SK);
  // 刺猬头
  px(-9, -56+bob, 18, 8, HAIR);
  px(-11, -53+bob, 3, 5, HAIR);
  px(8, -53+bob, 3, 5, HAIR);
  px(-5, -58+bob, 4, 4, HAIR); px(1, -58+bob, 4, 4, HAIR);
  // 眉眼
  if (f.state === 'hit' || f.state === 'ko') {
    px(-6, -44+bob, 5, 2, '#222'); px(1, -44+bob, 5, 2, '#222');
  } else if (f.state === 'attack') {
    px(-6, -46+bob, 12, 2, '#a03020'); // 皱眉
    px(-6, -43+bob, 4, 3, '#222'); px(2, -43+bob, 4, 3, '#222');
  } else {
    px(-6, -44+bob, 4, 4, '#222'); px(2, -44+bob, 4, 4, '#222');
  }
  // 嘴
  px(-2, -38+bob, 5, 2, '#a05a40');

  // 手臂
  if (f.state === 'attack' && f.attack === 'punch') {
    const ext = f.stateT > ATTACKS.punch.activeFrom ? 1 : 0;
    px(6, -30+bob, 12+10*ext, 5, GI);
    px(17+10*ext, -31+bob, 6, 6, SK);
  } else if (f.state === 'attack' && f.attack === 'special') {
    // 双手推波
    px(6, -30+bob, 12, 5, GI);
    px(16, -32+bob, 6, 8, SK);
    px(6, -26+bob, 12, 5, GI);
    px(16, -26+bob, 6, 6, SK);
  } else {
    px(-13, -32+bob, 5, 13, GI); px(9, -32+bob, 5, 13, GI);
    px(-14, -20+bob, 6, 5, SK); px(9, -20+bob, 6, 5, SK);
  }
  // 踢腿
  if (f.state === 'attack' && f.attack === 'kick' && f.stateT > ATTACKS.kick.activeFrom) {
    px(2, -18, 22, 6, GI); px(22, -20, 7, 7, '#4a3020');
  }
  ctx.restore();
}

// ---------- HUD ----------
function drawBigPortrait(cx, cy, type) {
  px(cx - 34, cy - 40, 68, 84, '#1a2a44');
  px(cx - 30, cy - 36, 60, 76, '#101c34');
  px(cx - 28, cy - 52, 56, 16, '#22335a');
  ctx.save();
  ctx.translate(cx - 26, cy - 30);
  ctx.scale(2, 2);
  drawPortrait(0, 0, type);
  ctx.restore();
}

function drawVS() {
  ctx.fillStyle = 'rgba(6, 8, 20, .68)'; ctx.fillRect(0, 0, W, H);
  // 双方姓名牌
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(G.p1.name, W * 0.18, 132);
  ctx.fillText(G.p2.name, W * 0.82, 132);
  // 居中 VS 字样（脉动）
  const pulse = 1 + Math.sin(G.vsTimer * 10) * 0.05;
  ctx.save();
  ctx.translate(W / 2, 92); ctx.scale(pulse, pulse);
  ctx.font = 'bold 34px monospace';
  ctx.strokeStyle = '#5c0d00'; ctx.lineWidth = 7;
  ctx.strokeText('VS', 0, 0);
  ctx.fillStyle = '#ffe95c'; ctx.fillText('VS', 0, 0);
  ctx.restore();
  if (G.mode === 'arcade') {
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = G.arcade.boss ? '#ff4b2e' : '#9fd4ff';
    ctx.fillText(G.arcade.boss ? 'FINAL BOSS' : 'STAGE ' + G.arcade.stage + ' / 5', W / 2, 128);
  }
  ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#6a7d92';
  ctx.fillText('按任意键跳过', W / 2, 158);
}

function drawPortrait(x, y, type) {
  ctx.save();
  ctx.translate(x, y);
  if (type === 'blob') {
    px(0,0,26,26,'#2a3a55');
    px(3,3,20,20,'#3a8ad8');
    px(6,8,6,7,'#f4f4f0'); px(14,8,6,7,'#f4f4f0');
    px(8,10,3,4,'#222'); px(16,10,3,4,'#222');
    px(11,17,5,3,'#d8382a');
  } else if (CAST_CFG[type]) {
    const c = CAST_CFG[type];
    px(0,0,26,26,'#2a3a55');
    px(3,8,20,15,c.face);
    px(3,5,20,5,c.hair);
    if (c.style==='topknot') px(10,2,6,4,'#ffe95c');
    if (c.style==='buns'){ px(3,3,5,4,c.hair); px(18,3,5,4,c.hair); }
    if (c.style==='gourd'){ px(10,0,6,6,'#ff9d2e'); px(11,-1,4,2,'#3a8a3a'); }
    if (c.style==='horns'){ px(2,0,3,5,'#c8b8e8'); px(21,0,3,5,'#c8b8e8'); }
    if (c.style==='flow'){ px(2,4,4,9,c.hair); px(20,4,4,9,c.hair); }
    px(6,12,5,4,'#222'); px(15,12,5,4,'#222');
    px(10,19,6,3,c.gi);
  } else {
    px(0,0,26,26,'#2a3a55');
    px(3,6,20,17,'#ffcf9e');
    px(3,3,20,7,'#22222a');
    px(6,12,5,4,'#222'); px(15,12,5,4,'#222');
    px(10,19,6,2,'#a05a40');
  }
  ctx.restore();
}

function drawHUD() {
  const p1 = G.p1, p2 = G.p2;
  // 血条底
  function bar(x, w, pct, flip) {
    // 低血量预警：pct<0.25 时血条闪烁红色边框
    const low = pct < 0.25;
    const blink = low && Math.floor(gameTime * 6) % 2 === 0;
    px(x, 8, w, 10, low ? '#2a0f12' : '#1a1a22');
    px(x+1, 9, w-2, 8, '#3a1a10');
    const fw = Math.round((w-2) * pct);
    if (pct > .5) px(flip ? x+1+(w-2-fw) : x+1, 9, fw, 8, '#5ad83a');
    else if (pct > .25) px(flip ? x+1+(w-2-fw) : x+1, 9, fw, 8, '#ffd83a');
    else px(flip ? x+1+(w-2-fw) : x+1, 9, fw, 8, '#ff4b2e');
    if (low && blink) px(x, 8, w, 10, 'rgba(255,60,40,.55)');
    px(x, 8, w, 2, 'rgba(255,255,255,.25)');
  }
  bar(34, 170, p1.hp / p1.maxHp, false);
  bar(W-34-170, 170, p2.hp / p2.maxHp, true);
  // 头像框
  drawPortrait(4, 4, 'fighter');
  ctx.save(); ctx.translate(W-30, 0); ctx.scale(-1,1); drawPortrait(0, 4, 'blob'); ctx.restore();
  // 名字
  ctx.font = '8px monospace'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.fillText(G.mode === 'pvp' ? '1P ' + p1.name : p1.name, 36, 20);
  ctx.textAlign = 'right';
  ctx.fillText((G.mode === 'pvp' ? '2P ' : '') + p2.name, W-36, 20);
  // 能量条与赛点
  function meter(x, w, pct, flip) {
    px(x, 30, w, 4, '#15223a');
    const fw = Math.round((w - 2) * pct);
    const full = pct >= 1;
    px(flip ? x + w - 1 - fw : x + 1, 31, fw, 2, full ? '#ffe95c' : (pct >= .35 ? '#5ccfff' : '#6a70a8'));
    if (full) { px(x, 29, w, 6, 'rgba(255,233,92,.28)'); }
  }
  meter(34, 170, p1.meter / p1.maxMeter, false);
  meter(W-34-170, 170, p2.meter / p2.maxMeter, true);
  if (p1.meter >= p1.maxMeter) {
    ctx.font = 'bold 7px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffe95c';
    ctx.fillText('MAX!', 36, 36);
  }
  if (p2.meter >= p2.maxMeter) {
    ctx.font = 'bold 7px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffe95c';
    ctx.fillText('MAX!', W - 36, 36);
  }
  ctx.font = 'bold 8px monospace'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe95c'; ctx.textAlign = 'left';
  ctx.fillText('●'.repeat(G.wins.p1) + '○'.repeat(2 - G.wins.p1), 36, 40);
  ctx.textAlign = 'right';
  ctx.fillText('●'.repeat(G.wins.p2) + '○'.repeat(2 - G.wins.p2), W - 36, 40);

  // 中央计时（菱形）
  const tleft = Number.isFinite(G.time) ? Math.ceil(G.time) : null;
  ctx.save();
  ctx.translate(W/2, 16); ctx.rotate(Math.PI/4);
  px(-11, -11, 22, 22, '#2a3a55'); px(-9, -9, 18, 18, '#f4f4f0');
  ctx.restore();
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = tleft !== null && tleft <= 10 ? '#ff4b2e' : '#222';
  ctx.fillText(tleft === null ? '∞' : String(tleft).padStart(2,'0'), W/2, 17);
  if (G.training) {
    ctx.font = 'bold 7px monospace'; ctx.fillStyle = '#5ccfff';
    ctx.fillText('TRAINING', W / 2, 51);
  }
  // 连击显示
  if (G.comboShow >= 2 && G.comboT > 0) {
    ctx.save();
    ctx.font = 'bold 16px monospace'; ctx.textAlign = 'right';
    const cx = G.comboSide === 1 ? W - 40 : 40;
    ctx.textAlign = G.comboSide === 1 ? 'right' : 'left';
    ctx.fillStyle = '#ffe95c';
    ctx.strokeStyle = '#8a2a10'; ctx.lineWidth = 3;
    const txt = G.comboShow + ' HIT' + ' · ' + (G.comboSide === 1 ? G.p1.comboDmg : G.p2.comboDmg) + ' DMG';
    const sx = cx + (G.comboSide===1?-1:1) * Math.max(0, 4 - G.comboT*20);
    ctx.strokeText(txt, sx, 44);
    ctx.fillText(txt, sx, 44);
    ctx.restore();
  }
}

// ---------- 主循环 ----------
let lastT = 0, gameTime = 0;

function frame(now) {
  GFRAME++;
  const rawDt = Math.min(.05, (now - lastT) / 1000 || 0);
  lastT = now;
  gameTime += rawDt;

  if (G.state === 'title') { drawTitleBG(); return; }
  if (G.state === 'result') { render(rawDt); return; }
  if (G.state === 'paused') { render(0); return; }

  let dt = rawDt;
  if (G.hitStop > 0) { G.hitStop -= rawDt; dt = 0; } // 命中停帧

  if (G.state === 'vs') {
    G.vsTimer += rawDt;
    G.p1.update(dt, G.p2, NO_INPUT, NO_PRESS_FRAME);
    G.p2.update(dt, G.p1, NO_INPUT, NO_PRESS_FRAME);
    const skip = Object.values(input).some(v => v);
    if (G.vsTimer >= 1.6 || (skip && G.vsTimer > 0.25)) { G.state = 'intro'; G.introT = 0; }
  } else if (G.state === 'intro') {
    G.introT += rawDt;
    if (G.introT >= 1.35) G.state = 'fight';
    G.p1.update(dt, G.p2, NO_INPUT, NO_PRESS_FRAME);
    G.p2.update(dt, G.p1, NO_INPUT, NO_PRESS_FRAME);
  } else if (G.state === 'fight') {
    G.time -= dt;
    if (G.time <= 0) {
      G.time = 0;
      const winner = G.p1.hp === G.p2.hp ? null : (G.p1.hp > G.p2.hp ? G.p1 : G.p2);
      finishRound(winner, 'timeup');
    } else {
      G.p1.update(dt, G.p2, input, pressFrame1);
      G.p2.update(dt, G.p1, G.training ? NO_INPUT : (G.mode === 'pvp' ? input2 : G.p2.aiInput(dt, G.p1)), G.training ? pressFrameAI : (G.mode === 'pvp' ? pressFrame2 : pressFrameAI));
      if (G.training) { updateTrials(); updateFrameData(); }
    }
  } else if (G.state === 'ko' || G.state === 'training-ko' || G.state === 'timeup') {
    G.koTimer += rawDt;
    G.p1.update(dt, G.p2, NO_INPUT, NO_PRESS_FRAME);
    G.p2.update(dt, G.p1, NO_INPUT, NO_PRESS_FRAME);
    const settleTime = G.state === 'ko' ? 2.2 : (G.state === 'training-ko' ? 1.1 : 1.35);
    if (G.koTimer > settleTime) advanceAfterRound();
  }

  // 飞行道具
  for (const p of G.projectiles) {
    p.x += p.vx * dt; p.life -= dt;
    const foe = p.owner === G.p1 ? G.p2 : G.p1;
    const fb = foe.hurtbox;
    if (foe.state !== 'ko' && p.x + p.r > fb.x && p.x - p.r < fb.x + fb.w && p.y + p.r > fb.y && p.y - p.r < fb.y + fb.h) {
      if (p.super) spawnSuperBurst(fb.x + fb.w/2, fb.y + fb.h/2);
      foe.takeHit(p.dmg, Math.sign(p.vx), 130, .45, p.owner);
      p.life = 0;
    }
  }
  G.projectiles = G.projectiles.filter(p => p.life > 0 && p.x > -20 && p.x < W + 20);

  // 粒子
  for (const pt of particles) { pt.t += rawDt; pt.x += pt.vx*rawDt; pt.y += pt.vy*rawDt; pt.vy += 300*rawDt; }
  particles = particles.filter(pt => pt.t < pt.life);
  for (const n of hitNums) { n.t += rawDt; n.y += n.vy * rawDt; }
  hitNums = hitNums.filter(n => n.t < n.life);

  // 连击显示计时
  const lastCombo = Math.max(G.p1.combo, G.p2.combo);
  if (lastCombo >= 2) {
    if (lastCombo !== G.comboShow) { G.comboShow = lastCombo; G.comboT = 1.2; G.comboSide = G.p1.combo >= G.p2.combo ? 1 : 2; }
  }
  G.comboT -= rawDt;
  if (G.comboT <= 0) { G.comboShow = 0; G.p1.combo = 0; G.p2.combo = 0; G.p1.comboDmg = 0; G.p2.comboDmg = 0; }

  G.shake = Math.max(0, G.shake - rawDt * 20);
  render(rawDt);
}

function drawTitleBG() {
  ctx.drawImage(sceneCanvas(), 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0,0,W,H);
}

function render(dt) {
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));

  ctx.drawImage(sceneCanvas(), 0, 0);

  if (G.p1 && G.p2) {
    // 影子
    for (const f of [G.p1, G.p2]) {
      const sw = f.onGround ? 26 : 18;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(f.x, GROUND+3, sw, 4, 0, 0, 7); ctx.fill();
    }
    // 后画的在上
    drawFighter(G.p2, gameTime);
    drawFighter(G.p1, gameTime);
    // 飞行道具（波动拳 / 超必杀金波）
    for (const p of G.projectiles) {
      const r = p.r;
      if (p.super) {
        px(p.x - r, p.y - r - 1, r*2, r*2, '#ffd83a');
        px(p.x - r+2, p.y - r+1, r*2-4, r*2-4, '#ffe95c');
        px(p.x - r+4, p.y - r+3, (r*2-8), (r*2-8), '#fff8d0');
        // 金色拖尾
        ctx.fillStyle = 'rgba(255,220,80,.55)';
        ctx.fillRect(p.x - Math.sign(p.vx)*r*2 - r*1.5, p.y - 5, r*3, 10);
        ctx.fillRect(p.x - Math.sign(p.vx)*r*3 - r*2, p.y - 3, r*3, 6);
      } else {
        px(p.x - r, p.y - r, r*2, r*2, '#7ad8ff');
        px(p.x - r+2, p.y - r+2, r*2-4, r*2-4, '#c8ecff');
        px(p.x - r+4, p.y - r+4, r, r, '#ffffff');
        // 拖尾
        px(p.x - Math.sign(p.vx)*r*2 - r/2, p.y - 3, r, 6, 'rgba(122,216,255,.4)');
      }
    }
    // 粒子
    for (const pt of particles) {
      ctx.globalAlpha = 1 - pt.t/pt.life;
      px(pt.x, pt.y, pt.s, pt.s, pt.c);
      ctx.globalAlpha = 1;
    }
    // 浮动伤害 / 格挡提示
    ctx.save();
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of hitNums) {
      ctx.globalAlpha = Math.max(0, 1 - n.t / n.life);
      ctx.strokeStyle = '#1a1720'; ctx.lineWidth = 2;
      ctx.strokeText(n.txt, n.x, n.y);
      ctx.fillStyle = n.color; ctx.fillText(n.txt, n.x, n.y);
    }
    ctx.restore();
    drawHUD();
  }

  // 回合标识与倒计时提示
  ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText('ROUND ' + G.round + (G.mode === 'arcade' ? ' · STAGE ' + G.arcade.stage + (G.arcade.boss ? ' FINAL' : '/5') : ''), W / 2, 32);
  if (G.mode === 'arcade' && G.state !== 'intro') {
    ctx.fillStyle = '#9fd4ff';
    ctx.fillText('SCORE ' + G.arcade.score + ' · BEST ' + G.arcade.best, W / 2, 44);
  }
  if (G.state === 'intro') {
    const introText = G.introT < .7 ? 'READY' : 'FIGHT!';
    ctx.font = 'bold 24px monospace';
    ctx.strokeStyle = '#5c0d00'; ctx.lineWidth = 4; ctx.strokeText(introText, W / 2, 85);
    ctx.fillStyle = G.introT < .7 ? '#ffe95c' : '#ff6b2e';
    ctx.fillText(introText, W / 2, 85);
  }
  if (G.state === 'timeup') {
    ctx.font = 'bold 20px monospace'; ctx.strokeStyle = '#24344a'; ctx.lineWidth = 4;
    ctx.strokeText('TIME UP', W / 2, 90); ctx.fillStyle = '#fff'; ctx.fillText('TIME UP', W / 2, 90);
  }

  // VS 对决面板
  if (G.state === 'vs') { drawBigPortrait(W * 0.18, 60, G.p1.type); drawBigPortrait(W * 0.82, 60, G.p2.type); drawVS(); }

  // KO 大字
  if (G.state === 'ko' || G.state === 'training-ko') {
    const scale = Math.min(1, G.koTimer * 4);
    ctx.save();
    ctx.translate(W/2, H/2 - 20);
    ctx.scale(scale, scale);
    ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#5c0d00'; ctx.lineWidth = 8; ctx.strokeText('K.O.', 0, 0);
    ctx.fillStyle = '#ff4b2e'; ctx.fillText('K.O.', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

// ---------- 启动 ----------
// 按钮驱动：pointerup 优先（iOS 可用），click 兜底，250ms 去重防双触发
function tapDrive(el, fn) {
  if (!el) return;
  let last = 0;
  const go = () => { const n = Date.now(); if (n - last > 80) { last = n; fn(); } }; // 80ms 去重：合并 pointerup+click 双事件，真实连点（>80ms）不受影响
  el.addEventListener('pointerup', go);   // 现代环境主路径
  el.addEventListener('click', go);       // 无 PointerEvent 环境兜底（与 pointerup 去重）
}
tapDrive(document.getElementById('btn-start'), () => {
  document.getElementById('title').classList.add('hidden');
  startMatch('vsai');
});
tapDrive(document.getElementById('btn-pvp'), () => {
  document.getElementById('title').classList.add('hidden');
  startMatch('pvp');
});
tapDrive(document.getElementById('btn-arcade'), () => {
  document.getElementById('title').classList.add('hidden');
  startMatch('arcade');
});
tapDrive(document.getElementById('btn-training'), () => {
  document.getElementById('title').classList.add('hidden');
  startTraining();
});
tapDrive(document.getElementById('btn-rematch'), () => {
  if (G.mode === 'train') startTraining();
  else startMatch(G.mode);
});
tapDrive(document.getElementById('btn-mute'), toggleMute);
tapDrive(document.getElementById('btn-fullscreen'), toggleFullscreen);
tapDrive(document.getElementById('btn-resume'), togglePause);
tapDrive(document.getElementById('btn-restart'), () => {
  if (G.training) startTraining();
  else startRound();
});
tapDrive(document.getElementById('btn-quit'), quitToTitle);
tapDrive(document.getElementById('btn-pause'), togglePause);

// 角色选择
const SETTINGS_KEY = 'pixelbrawl_settings';
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ playerType: G.playerType, difficulty: G.difficulty })); } catch (e) {}
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (s.playerType && CHARACTERS[s.playerType]) selectCharacter(s.playerType);
    if (s.difficulty && DIFFICULTY[s.difficulty]) selectDifficulty(s.difficulty);
  } catch (e) {}
}
function selectCharacter(type) {
  if (!CHARACTERS[type]) type = 'fighter';
  G.playerType = type;
  ROSTER.forEach(k =>
    document.getElementById('char-' + k).classList.toggle('selected', k === type));
  saveSettings();
}
tapDrive(document.getElementById('char-fighter'), () => selectCharacter('fighter'));
tapDrive(document.getElementById('char-blob'), () => selectCharacter('blob'));
tapDrive(document.getElementById('char-miko'), () => selectCharacter('miko'));
tapDrive(document.getElementById('char-monkey'), () => selectCharacter('monkey'));
tapDrive(document.getElementById('char-nezha'), () => selectCharacter('nezha'));
tapDrive(document.getElementById('char-gourd'), () => selectCharacter('gourd'));
tapDrive(document.getElementById('char-demon'), () => selectCharacter('demon'));
tapDrive(document.getElementById('char-viper'), () => selectCharacter('viper'));
tapDrive(document.getElementById('char-random'), () => selectCharacter(ROSTER[Math.floor(Math.random()*ROSTER.length)]));

// 难度选择
function selectDifficulty(level) {
  G.difficulty = level;
  ['easy','normal','hard'].forEach(k =>
    document.getElementById('diff-'+k).classList.toggle('selected', k === level));
  saveSettings();
}
tapDrive(document.getElementById('diff-easy'), () => selectDifficulty('easy'));
tapDrive(document.getElementById('diff-normal'), () => selectDifficulty('normal'));
tapDrive(document.getElementById('diff-hard'), () => selectDifficulty('hard'));

// 循环启动：rAF 若不触发（部分 WebView 会挂起）自动降级 setInterval
(function startLoop() {
  let rafOk = false;
  try {
    requestAnimationFrame(() => { rafOk = true; });
  } catch(e) {}
  setTimeout(() => {
    if (rafOk) {
      const loop = now => { frame(now); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      console.log('loop: rAF');
    } else {
      let vt = performance.now();
      setInterval(() => { vt += 1000 / 30; frame(vt); }, 1000 / 30);
      console.log('loop: setInterval fallback');
    }
  }, 350);
})();

// 恢复上次设置（角色/难度）
loadSettings();

// 仅在显式 debug 查询参数下暴露测试句柄
if (location.search.includes('debug=1')) {
  window.G = G; window.input = input; window.input2 = input2;
  window.__PF1 = pressFrame1; window.__PF2 = pressFrame2; window.__PFAI = pressFrameAI;
  window.Fighter = Fighter;
  // 输入监视器：实时显示 1P/2P 各键的识别状态（帮助定位按键问题）
  const mon = document.getElementById('inp-monitor');
  if (mon) {
    mon.classList.remove('hidden');
    const K = [['left','◀'],['right','▶'],['jump','跳'],['block','防'],['punch','拳'],['kick','脚'],['special','波']];
    mon.innerHTML = '<span>1P</span>' + K.map(k => '<b id="im-' + k[0] + '">' + k[1] + '</b>').join(' ') +
      '<br><span>2P</span>' + K.map(k => '<b id="im2-' + k[0] + '">' + k[1] + '</b>').join(' ');
    const els = {}, els2 = {};
    K.forEach(k => { els[k[0]] = document.getElementById('im-' + k[0]); els2[k[0]] = document.getElementById('im2-' + k[0]); });
    setInterval(() => {
      K.forEach(k => { els[k[0]].className = input[k[0]] ? 'on' : ''; els2[k[0]].className = input2[k[0]] ? 'on' : ''; });
    }, 80);
  }
}

// ===== 内置自检：autotest=1 时自动跑双人断言，结果写入 document.title =====
if (location.search.includes('autotest=1')) {
  window.G = G; window.input = input; window.input2 = input2;
  (async function autoTest() {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const log = [];
    const mark = (name, ok, extra) => log.push((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' ' + extra : ''));
    window.onerror = (m, s, l, c) => { log.push('ERR ' + m + '@' + l + ':' + c); };
    try {
      let rafN = 0;
      const probe = () => { rafN++; requestAnimationFrame(probe); };
      requestAnimationFrame(probe);
      await wait(1000);
      mark('headless_fps', rafN >= 30, 'rAF=' + rafN + '/1s');
      await wait(400);
      document.getElementById('btn-pvp').click();
      await wait(400);
      mark('pvp_mode', G.mode === 'pvp', 'mode=' + G.mode);
      await wait(3200); // intro 1.35s 后 fight
      mark('fight_start', G.state === 'fight', 'state=' + G.state);

      // 2P 键盘：← 持续 700ms
      const x0 = Math.round(G.p2.x);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await wait(700);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
      mark('p2_move_left', G.p2.x < x0 - 3, x0 + '->' + Math.round(G.p2.x));

      // ===== 触屏攻击真实建立验证（修复"按了没反应"） =====
      // 1P 触屏拳键：模拟 pointerdown → 验证角色进入 attack 状态（非仅按钮亮）
      G.p1.state = 'idle'; G.p1.attack = null; G.p1.cd.punch = 0; G.p1.buf = { punch: 0, kick: 0, special: 0 }; G.p1.prev = { punch: false, kick: false, special: false };
      const punchBtn = document.querySelector('.tk[data-k="punch"]');
      const rc = punchBtn.getBoundingClientRect();
      punchBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rc.left + rc.width/2, clientY: rc.top + rc.height/2, pointerId: 9001 }));
      await wait(80);
      const touchPunchResult = { state: G.p1.state, attack: G.p1.attack };
      punchBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9001 }));
      mark('touch_punch_attack', touchPunchResult.state === 'attack' && touchPunchResult.attack === 'punch', 
        'st=' + touchPunchResult.state + ' atk=' + touchPunchResult.attack);

      // 2P 键盘：4=拳（断言攻击真实建立：state==='attack'）
      G.p2.state = 'idle'; G.p2.attack = null; G.p2.cd.punch = 0; G.p2.buf = { punch: 0, kick: 0, special: 0 }; G.p2.prev = { punch: false, kick: false, special: false };
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
      await wait(90);
      mark('p2_punch_key', G.p2.state === 'attack' && G.p2.attack === 'punch', 'atk=' + G.p2.attack + ' st=' + G.p2.state);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: '4', bubbles: true }));
      await wait(260);
      mark('p2_punch_done', G.p2.state !== 'attack', 'st=' + G.p2.state);

      // 1P 键盘：A 移动 + J 拳 联动（断言攻击真实建立）
      G.p1.state = 'idle'; G.p1.attack = null; G.p1.cd.punch = 0; G.p1.buf = { punch: 0, kick: 0, special: 0 }; G.p1.prev = { punch: false, kick: false, special: false };
      const p1x = Math.round(G.p1.x);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
      await wait(100);
      const p1React = { attack: G.p1.attack, state: G.p1.state };
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'j', bubbles: true }));
      await wait(250);
      mark('p1_move_punch', p1React.state === 'attack' && p1React.attack === 'punch', 'atk=' + p1React.attack + ' st=' + p1React.state);

      // —— BGM 音序器断言 ——
      mark('bgm_playing', BGM_STATE.on === true, 'song=' + BGM_STATE.song);
      const step0 = BGM_STATE.step;
      await wait(500);
      mark('bgm_advancing', BGM_STATE.step > step0, step0 + '->' + BGM_STATE.step + ' ac=' + (AC ? AC.state : 'none'));

      // 暂停 → 音频挂起；恢复 → 运行
      document.getElementById('btn-pause').click();
      await wait(150);
      mark('pause_audio', !AC || AC.state === 'suspended', AC ? AC.state : 'noAC');
      document.getElementById('btn-resume').click();
      await wait(150);
      mark('resume_audio', !AC || AC.state === 'running', AC ? AC.state : 'noAC');

      // 静音切换
      document.getElementById('btn-mute').click();
      await wait(200);
      mark('mute_off', BGM_STATE.on === false, 'muted=' + document.getElementById('btn-mute').dataset.muted);
      document.getElementById('btn-mute').click();
      await wait(200);
      mark('mute_on', BGM_STATE.on === true, 'muted=' + document.getElementById('btn-mute').dataset.muted);

      // 2P 触屏键：强制显示两层容器（桌面 IS_TOUCH=false 时隐藏，跳过环境限制测委托逻辑）
      document.getElementById('touch').classList.remove('hidden');
      document.getElementById('tc-2p').classList.remove('hidden');
      await wait(100);
      const kickEl = document.querySelector('.tk2[data-k="kick"]');
      const kr = kickEl ? kickEl.getBoundingClientRect() : null;
      mark('p2_touch_el', !!kickEl && !!kr && kr.width > 0 && kr.height > 0,
        'rect=' + (kr ? Math.round(kr.left) + ',' + Math.round(kr.top) + ',' + Math.round(kr.width) + 'x' + Math.round(kr.height) : 'null'));
      kickEl.dispatchEvent(
        new PointerEvent('pointerdown', { pointerId: 1, bubbles: true, cancelable: true,
          clientX: kr.left + kr.width / 2, clientY: kr.top + kr.height / 2 }));
      await wait(120);
      mark('p2_touch_bind', input2.kick === true, 'inp2.kick=' + input2.kick);
      kickEl.dispatchEvent(
        new PointerEvent('pointerup', { pointerId: 1, bubbles: true, cancelable: true }));

      // —— 触屏快速连点 / 双指独立断言 ——
      const tEl = document.getElementById('touch');
      const rc2 = (k) => { const r = tEl.querySelector('.tk[data-k="' + k + '"]').getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; };
      const pd = (id, k) => tEl.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, bubbles: true, cancelable: true, clientX: rc2(k).x, clientY: rc2(k).y }));
      const pu = (id) => tEl.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, bubbles: true, cancelable: true }));
      // 同 id 快速连打（模拟偶发丢失 pointerup 场景，每次按下都须生效）
      const pr = rc2('punch');
      mark('tap_rect', pr.x > 0 && pr.y > 0, Math.round(pr.x) + ',' + Math.round(pr.y));
      pd(77, 'punch'); const tap1 = input.punch;
      pd(77, 'punch'); const tap2 = input.punch;   // 无 up 直接再 down：应重置并保持 true
      pd(77, 'punch'); const tap3 = input.punch;
      mark('tap_same_id', tap1 && tap2 && tap3, [tap1, tap2, tap3].join(','));
      pu(77);
      mark('tap_release', !input.punch, 'p=' + input.punch);
      // 双指独立（id 71 左 + id 72 拳 同时）
      pd(71, 'left'); pd(72, 'punch');
      mark('two_fingers', input.left && input.punch, 'L=' + input.left + ' P=' + input.punch);
      pu(71); pu(72);
      mark('two_up', !input.left && !input.punch, 'L=' + input.left + ' P=' + input.punch);

      // —— 街机模式断言 ——
      document.getElementById('btn-quit').click();        // 回到标题
      await wait(300);
      document.getElementById('btn-arcade').click();
      await wait(400);
      mark('arcade_mode', G.mode === 'arcade' && G.arcade.stage === 1, 'stage=' + G.arcade.stage);
      mark('arcade_scale1', G.p2.aiScale === 1, 'scale=' + G.p2.aiScale + ' p2hp=' + G.p2.hp);
      mark('arcade_persona1', G.p2.persona === 'balance' && G.arcade.boss === false, 'p=' + G.p2.persona);
      mark('vs_state', G.state === 'vs', 'state=' + G.state);
      mark('vs_scene_day', G.scene === 'day', 'scene=' + G.scene);
      await wait(1900);                                    // VS 横幅 1.6s 后进 intro
      mark('vs_done', G.state === 'intro' || G.state === 'fight', 'state=' + G.state);

      // 前置工具：p2 被打倒 → 本战胜利
      const koP2 = () => {
        G.state = 'fight'; G.p1.x = 300; G.p2.x = 320; G.p1.facing = 1; G.p2.facing = -1;
        G.p1.state = 'idle'; G.p1.attack = null; G.p1.cd.kick = 0;
        G.p2.state = 'idle'; G.p2.attack = null; G.p2.hp = 1; G.p2.blocking = false;
        G.p1.startAttack('kick');
        for (let i = 0; i < 30; i++) G.p1.update(.02, G.p2, { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false }, NO_PRESS_FRAME);
        const s = G.state, w = G.p1.state;   // 记录 KO 态与胜利姿势（advance 前）
        G.koTimer = 2.3; advanceAfterRound();
        return { koAfter: s, winState: w };
      };

      // 打赢第一战 → 第二战且回满血、对手强化
      const r1 = koP2();
      mark('win_pose', r1.winState === 'win', 'p1state=' + r1.winState);
      mark('arcade_next_stage', r1.koAfter === 'ko' && G.arcade.stage === 2 && G.p1.hp === G.p1.maxHp,
        'stage=' + G.arcade.stage + ' hp=' + Math.round(G.p1.hp) + ' scale=' + G.p2.aiScale + ' p2hp=' + G.p2.hp);
      mark('arcade_scene2', G.scene === 'evening', 'scene=' + G.scene);
      mark('arcade_persona2', G.p2.persona === 'rush' && !G.arcade.boss, 'p=' + G.p2.persona + ' scale=' + G.p2.aiScale);

      // 推进 3/4/5 战：人格与 Boss 战验证
      koP2(); mark('arcade_persona3', G.arcade.stage === 3 && G.p2.persona === 'guard' && !G.arcade.boss,
        'stage=' + G.arcade.stage + ' p=' + G.p2.persona);
      koP2(); mark('arcade_persona4', G.arcade.stage === 4 && G.p2.persona === 'rush' && !G.arcade.boss,
        'stage=' + G.arcade.stage + ' p=' + G.p2.persona);
      koP2();
      mark('arcade_boss', G.arcade.stage === 5 && G.arcade.boss === true && G.p2.persona === 'bossRush' &&
        G.p2.type === 'demon' && G.p2.aiScale >= 1.9 && G.p2.hp === 178 && G.p2.maxHp === 178 && BGM_STATE.song === 'boss',
        'stage=' + G.arcade.stage + ' boss=' + G.arcade.boss + ' p=' + G.p2.type + '/' + G.p2.persona +
        ' scale=' + G.p2.aiScale + ' hp=' + G.p2.hp + '/' + G.p2.maxHp + ' song=' + BGM_STATE.song);

      // Boss 战失败 → GAME OVER 结算 + 最佳纪录保存
      G.state = 'fight'; G.p1.x = 300; G.p2.x = 320; G.p1.facing = 1; G.p2.facing = -1;
      G.p1.state = 'idle'; G.p1.attack = null; G.p1.hp = 1;
      G.p2.state = 'idle'; G.p2.attack = null; G.p2.hp = 180; G.p2.blocking = false; G.p2.cd.kick = 0;
      G.p2.startAttack('kick');
      for (let i = 0; i < 30; i++) G.p2.update(.02, G.p1, { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false }, NO_PRESS_FRAME);
      G.koTimer = 2.3; advanceAfterRound();
      mark('arcade_gameover', G.state === 'result' && document.getElementById('result-text').textContent === 'GAME OVER',
        document.getElementById('result-text').textContent + ' | ' + document.getElementById('result-detail').textContent);
      mark('arcade_best', G.arcade.best > 0, 'best=' + G.arcade.best + ' score=' + G.arcade.score);

      // —— 连段挑战断言（训练模式） ——
      const kd = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      const ku = (k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
      const resetP1 = () => { G.p1.state = 'idle'; G.p1.attack = null; G.p1.cd.punch = 0; G.p1.cd.kick = 0; G.p1.cd.special = 0;
        G.p1.buf = { punch: 0, kick: 0, special: 0 }; G.p1.prev = { punch: false, kick: false, special: false }; G.p1.atkLog = []; };
      document.getElementById('btn-quit').click();
      await wait(300);
      document.getElementById('btn-training').click();
      await wait(400);
      mark('trial_panel', !document.getElementById('trial-panel').classList.contains('hidden') && G.trials && G.trials.length === 5,
        'trials=' + (G.trials ? G.trials.length : 0));

      // 第一关：三段连击 J·J·J（时间线探针）
      resetP1();
      const tl = [];
      const tlId = setInterval(() => { if (tl.length < 16) tl.push(G.p1.attack + '@' + Math.round(G.p1.stateT * 1000) + ':' + G.p1.state); }, 30);
      kd('j'); await wait(170); ku('j'); await wait(10);
      kd('j'); await wait(170); ku('j'); await wait(10);
      kd('j'); await wait(200); ku('j'); await wait(420);
      clearInterval(tlId);
      mark('trial_combo1', G.trials[0].done === true, 'log=' + G.p1.atkLog.join('>'));

      // 第二关：拳→脚取消 J·K
      resetP1();
      kd('j'); await wait(200); ku('j'); await wait(90);
      kd('k'); await wait(260); ku('k'); await wait(340);
      mark('trial_cancel', G.trials[1].done === true, G.p1.atkLog.slice(-3).join('>'));

      // 第三关：拳→超必杀（满能量 J·L）
      resetP1(); G.p1.meter = 100;
      kd('j'); await wait(200); ku('j'); await wait(90);
      kd('l'); await wait(240); ku('l'); await wait(360);
      mark('trial_super', G.trials[2].done === true, G.p1.atkLog.slice(-3).join('>'));
      mark('trial_all', G.trials.slice(0,3).every(t => t.done), 'done=' + G.trials.filter(t => t.done).length);

      // —— 第三角色断言 ——
      document.getElementById('btn-quit').click();
      await wait(300);
      document.getElementById('char-miko').click();
      document.getElementById('btn-start').click();
      await wait(400);
      mark('miko_select', G.p1.type === 'miko' && G.p1.hp === 108 && G.p1.maxHp === 108 && G.p1.speed === 97,
        'hp=' + G.p1.hp + '/' + G.p1.maxHp + ' sp=' + G.p1.speed);
      mark('miko_foe', G.p2.type !== 'miko', 'p2=' + G.p2.type);
      G.state = 'fight'; G.p1.state = 'idle'; G.p1.attack = null; G.p1.cd.special = 0; G.p1.meter = 100;
      const mikoSuper = G.p1.startAttack('special');
      mark('miko_super', mikoSuper && G.p1.attack === 'super', 'atk=' + G.p1.attack);

      // —— 新阵容：英雄/反派 8 角色 ——
      document.getElementById('btn-quit').click();
      await wait(300);
      document.getElementById('char-monkey').click();
      document.getElementById('btn-start').click();
      await wait(400);
      mark('monkey_select', G.p1.type === 'monkey' && G.p1.hp === 95 && G.p1.speed === 115,
        'hp=' + G.p1.hp + ' sp=' + G.p1.speed);
      mark('monkey_foe', G.p2.type !== 'monkey', 'p2=' + G.p2.type);
      document.getElementById('btn-quit').click();
      await wait(300);
      document.getElementById('char-demon').click();
      document.getElementById('btn-start').click();
      await wait(400);
      mark('demon_select', G.p1.type === 'demon' && G.p1.hp === 130 && G.p1.speed === 84 && G.p1.dmg === 1.32,
        'hp=' + G.p1.hp + ' sp=' + G.p1.speed + ' dmg=' + G.p1.dmg);
      mark('demon_foe', G.p2.type !== 'demon', 'p2=' + G.p2.type);
      mark('roster_ui', ROSTER.length === 8 && document.querySelectorAll('.char-select .char-card').length >= 9,
        'cards=' + document.querySelectorAll('.char-select .char-card').length);

      // —— 低血量预警 / 设置记忆 / 旋转提示 ——
      G.p1.hp = 100; G.p1.maxHp = 100; G.p1.lowWarned = false;
      G.p1.takeHit(80, 1, 100, .3, G.p2);
      mark('low_warn', G.p1.hp < 25 && G.p1.lowWarned === true, 'hp=' + G.p1.hp + ' warned=' + G.p1.lowWarned);
      selectCharacter('miko'); selectDifficulty('hard');
      const saved = JSON.parse(localStorage.getItem('pixelbrawl_settings') || '{}');
      mark('settings_save', saved.playerType === 'miko' && saved.difficulty === 'hard', JSON.stringify(saved));
      mark('rotate_hint', !!document.getElementById('rotate-hint'), 'el=' + !!document.getElementById('rotate-hint'));

      // —— 大厂手感吸收断言：分级顿帧 / 受击挤压 / 帧数据面板 / 随机角色 ——
      const hs = ['punch','kick','special','super'].map(k => ATTACKS[k].hitStop);
      mark('hitstop_tiered', hs[3] > hs[2] && hs[2] > hs[0], 'p=' + hs[0] + ' k=' + hs[1] + ' s=' + hs[2] + ' U=' + hs[3]);
      G.p1.hp = 100; G.p1.squash = 0;
      G.p1.takeHit(10, 1, 100, .3, G.p2);
      mark('squash_flash', G.p1.squash > 0.1 && G.hitStop > 0, 'sq=' + G.p1.squash.toFixed(2) + ' hs=' + G.hitStop);
      document.getElementById('btn-quit').click();
      await wait(300);
      document.getElementById('btn-training').click();
      await wait(400);
      mark('frame_data', !!document.getElementById('frame-data'), 'el=' + !!document.getElementById('frame-data'));
      const rndBefore = G.playerType;
      document.getElementById('char-random').dispatchEvent(new PointerEvent('pointerup', { pointerId: 93, bubbles: true }));
      await wait(300);
      mark('char_random', ['fighter','blob','miko'].includes(G.playerType), rndBefore + '->' + G.playerType);

      // —— 标题按钮 pointerup 主路径（iOS Safari 无 click 时的驱动方式）——
      document.getElementById('btn-quit').click();
      await wait(300);
      document.getElementById('btn-start').dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
      await wait(350);
      mark('btn_pointerup', G.mode === 'vsai' && G.state === 'vs', 'mode=' + G.mode + ' state=' + G.state);
    } catch (e) { log.push('ERROR ' + e.message); }
    document.title = 'AUTOTEST|' + log.join('|');
  })();
}