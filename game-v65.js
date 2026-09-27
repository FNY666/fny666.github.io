// ===== 像素乱斗 PIXEL BRAWL =====
'use strict';

// ---------- v59 精灵资源（外部精灵图，替代程序化绘制） ----------
const SPR = (function () {
  const defs = {
    hunter:  { fs: 126, ax: 68, ay: 82,  sc: 0.62, anims: { idle: 10, run: 8, jump: 3, fall: 3, attack1: 7, takehit: 3, death: 11 } },
    warrior: { fs: 162, ax: 85, ay: 101, sc: 0.50, anims: { idle: 10, run: 8, jump: 3, fall: 3, attack1: 7, attack2: 7, attack3: 8, takehit: 3, death: 7 } },
    huntress:{ fs: 150, ax: 77, ay: 97,  sc: 0.52, anims: { idle: 8, run: 8, jump: 2, fall: 2, attack1: 5, takehit: 3, death: 8 } },
    wizard:  { fs: 250, ax: 136, ay: 167, sc: 0.33, anims: { idle: 8, run: 8, jump: 2, fall: 2, attack1: 8, attack2: 8, takehit: 3, death: 7 } },
  };
  const out = {};
  for (const c in defs) {
    out[c] = { meta: defs[c] };
    for (const a in defs[c].anims) {
      const img = new Image();
      img.src = 'sprites/' + c + '/' + a + '.png';
      out[c][a] = img;
    }
  }
  return out;
})();

// ---------- v60 头像：从 idle 第0帧裁 44x44 头部，缓存到离屏 canvas ----------
// 裁剪矩形经实际 PNG 目测确认：hunter 脸部居中带剑，warrior 白发铠甲脸清晰
const PORTRAIT_CROPS = { hunter: [43, 17, 44, 44], warrior: [60, 38, 44, 44], huntress: [58, 48, 44, 44], wizard: [112, 92, 44, 44] };
const portraitCache = {};
function getPortrait(char) {
  if (portraitCache[char]) return portraitCache[char];
  const c = document.createElement('canvas');
  c.width = 44; c.height = 44;
  const paint = () => {
    const img = SPR[char] && SPR[char].idle;
    if (!img || !img.naturalWidth) return;
    const b = c.getContext('2d');
    b.imageSmoothingEnabled = false;
    const r = PORTRAIT_CROPS[char];
    b.clearRect(0, 0, 44, 44);
    b.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, 44, 44);
  };
  const img0 = SPR[char] && SPR[char].idle;
  if (img0) {
    if (img0.complete && img0.naturalWidth) paint();
    else img0.addEventListener('load', paint);
  }
  portraitCache[char] = c;
  return c;
}

// v64 终结演出+细节打磨：KO 白闪→推近→黑场→K.O. / 回合胜负标记 / 呼吸 2.2% / 胜者锚色标题 / 场景破坏 / 解说大字 / 低血黄段呼吸
// v63 角色视觉锚（SF6 #12）：P1 暖橙红 / P2 冷蓝，杀死"换皮感"
const ANCHOR = { hunter: '#ff7a3c', warrior: '#4a9aff', huntress: '#7ae05c', wizard: '#b47aff' };
// v65：角色类型→精灵映射；charOf 改按 fighter 实际角色 key（修复 pvp 双人同色 bug）
const TYPE_SPRITE = {
  fighter:'hunter', blob:'warrior', huntress:'huntress', wizard:'wizard',
  miko:'huntress', monkey:'hunter', nezha:'huntress', gourd:'warrior',
  cat:'hunter', ultra:'wizard', demon:'warrior', viper:'huntress'
};
function charOf(f) { return f.charKey || 'hunter'; }

// v59 精灵绘制：P1=hunter，P2(warrior)。ctx 已做 translate/squash/facing/flash 变换。
// KO 不做旋转（death.png 本身已是倒地姿态）。
// v61：抽出 spriteFrame() 供轮廓光复用
function spriteFrame(f) {
  const char = f.charKey || 'hunter';
  const S = SPR[char], meta = S.meta;
  let anim = 'idle';
  switch (f.state) {
    case 'walk': anim = 'run'; break;
    case 'jump': anim = 'jump'; break;
    case 'hit': anim = 'takehit'; break;
    case 'ko': anim = 'death'; break;
    case 'attack':
      if (f.attack === 'punch') anim = 'attack1';
      else if (f.attack === 'kick') anim = meta.anims.attack2 ? 'attack2' : 'attack1';
      else anim = meta.anims.attack3 ? 'attack3' : 'attack1'; // special
      break;
    default: anim = 'idle'; break; // idle / block / win
  }
  const img = S[anim];
  if (!img || img.naturalWidth === 0) return null; // 图片未加载完成则跳过本帧
  const frames = meta.anims[anim] || 1;
  let idx;
  if (anim === 'idle' || anim === 'run') idx = Math.floor(f.stateT * 10) % frames;
  else if (anim === 'death') idx = Math.min(Math.floor(f.stateT * 10), frames - 1);
  else if (anim === 'takehit') {
    // v62 后果 pose：顿帧期间定格在冲击帧（idx=1），命中后不许立刻回 neutral（GG #9）
    idx = G.hitStop > 0 ? 1 : Math.min(1 + Math.floor(f.stateT * 12), frames - 1);
  }
  else idx = (f.state === 'attack' && f.attack) ? stepFrame(f.attack, f.stateT, frames)
                                               : Math.min(Math.floor(f.stateT * 14), frames - 1);
  const h = img.naturalHeight || meta.fs;
  return { char, anim, idx, img, fs: meta.fs, h, sc: meta.sc, ax: meta.ax, ay: meta.ay };
}
function drawSpriteFighter(f, time) {
  const fr = spriteFrame(f);
  if (!fr) return;
  ctx.drawImage(fr.img, fr.idx * fr.fs, 0, fr.fs, fr.h,
    -fr.ax * fr.sc, -fr.ay * fr.sc, fr.fs * fr.sc, fr.h * fr.sc);
}

// v61 轮廓光：当前帧剪影（source-in 上色）预渲染 + 缓存
// 深色 1.03x 垫底把人物从暗舞台剥离；暖色 1px 上边缘模拟落日轮廓光
const silCache = {};
function getSil(char, anim, idx, fw, fh, color) {
  const key = char + '_' + anim + '_' + idx + '_' + color;
  let c = silCache[key];
  if (c) return c;
  const S = SPR[char];
  c = document.createElement('canvas'); c.width = fw; c.height = fh;
  const b = c.getContext('2d');
  b.imageSmoothingEnabled = false;
  b.drawImage(S[anim], idx * fw, 0, fw, fh, 0, 0, fw, fh);
  b.globalCompositeOperation = 'source-in';
  b.fillStyle = color;
  b.fillRect(0, 0, fw, fh);
  silCache[key] = c;
  return c;
}

// v63 环境光染色：剪影形状 + 渐变填充（source-in），低 alpha 盖在精灵上（art #1）
// 对角渐变：左下冷紫（天空反光）→ 右上暖橙（落日主光）；flip 保证暖侧永远在世界右侧
function getSilGrad(char, anim, idx, fw, fh, stops, flip) {
  const key = char + '_' + anim + '_' + idx + '_g' + (flip ? 'f' : 'n');
  let c = silCache[key];
  if (c) return c;
  const S = SPR[char];
  c = document.createElement('canvas'); c.width = fw; c.height = fh;
  const b = c.getContext('2d');
  b.imageSmoothingEnabled = false;
  b.drawImage(S[anim], idx * fw, 0, fw, fh, 0, 0, fw, fh);
  b.globalCompositeOperation = 'source-in';
  const g = b.createLinearGradient(flip ? fw : 0, fh, flip ? 0 : fw, 0);
  for (const st of stops) g.addColorStop(st[0], st[1]);
  b.fillStyle = g; b.fillRect(0, 0, fw, fh);
  silCache[key] = c;
  return c;
}

// ---------- 基础 ----------
const W = 480, H = 270, GROUND = 226;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));

// ---------- v61 字体系统：展示 / UI / 数字三档（Google Fonts，离线静默回退） ----------
const FONT = {
  disp: '"ZCOOL QingKe HuangYou","Noto Sans SC",sans-serif',  // 标题/KO/连击
  ui: '"Noto Sans SC",sans-serif',                            // 标签/按钮/台词
  num: '"Rajdhani","Noto Sans SC",monospace'                  // 计时器/伤害数字
};
try {
  if (document.fonts && document.fonts.load) {
    document.fonts.load('56px "ZCOOL QingKe HuangYou"');
    document.fonts.load('700 18px "Rajdhani"');
    document.fonts.load('700 9px "Noto Sans SC"');
  }
} catch (e) { /* 离线回退：用系统字体 */ }

// v61 切角面板（代替圆角胶囊）：四角统一剪切
function cutPanel(x, y, w, h, cut) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y); ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut); ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h); ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut); ctx.closePath();
}

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
let AC = null, masterGain = null, noiseBuf = null;
function initAudio() {
  try {
    if (!AC) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      AC = new Ctor();
      masterGain = AC.createGain(); masterGain.gain.value = 0.5; masterGain.connect(AC.destination);
      const len = Math.floor(AC.sampleRate * 0.08);
      noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) {}
}
// v63：iOS 要求用户手势后初始化 AudioContext（首次交互即建即 resume）
try {
  window.addEventListener('pointerdown', initAudio);
  window.addEventListener('keydown', initAudio);
  window.addEventListener('touchstart', initAudio);
} catch (e) {}
function jitP() { return 1 + (Math.random() * 0.2 - 0.1); }   // v63：每次打击随机 ±10% 音高
function hitClick(t, vol) {   // v63 三层音其一：TRANSIENT 脆响（噪声 burst，bandpass 3kHz）
  if (!noiseBuf) return;
  const s2 = AC.createBufferSource(); s2.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = 3000 * jitP(); f.Q.value = 1.1;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.13 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s2.connect(f); f.connect(g); g.connect(masterGain);
  s2.start(t); s2.stop(t + 0.06);
}
function hitThump(t) {   // v63 三层音其二+三：BODY sine 100→40Hz pitch-drop + SUB 62Hz
  const jr = jitP();
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(100 * jr, t); o.frequency.exponentialRampToValueAtTime(40 * jr, t + 0.12);
  g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.16);
  const o2 = AC.createOscillator(), g2 = AC.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(62 * jr, t);
  g2.gain.setValueAtTime(0.11, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  o2.connect(g2); g2.connect(masterGain); o2.start(t); o2.stop(t + 0.12);
}
function sfx(kind) {
  try {
    if (!AC) initAudio();
    if (!AC) return;
    const out = masterGain || AC.destination;
    const t = AC.currentTime;
    const tone = (type, f0, f1, dur, vol, at) => {
      const a = at || 0;
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.connect(g); g.connect(out);
      o.frequency.setValueAtTime(f0, t + a);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + dur);
      g.gain.setValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.001, t + a + dur);
      o.start(t + a); o.stop(t + a + dur + .01);
    };
    if (kind === 'hit')              hitClick(t, 1);                 // v63：轻击只有瞬态 click
    else if (kind === 'kick')      { hitClick(t, 1.5); hitThump(t); }// v63：重击三层全开
    else if (kind === 'stomp')       hitThump(t);                    // v63：warrior 胜利顿地闷响
    else if (kind === 'shot')        tone('sine', 300, 900, .2, .12);
    else if (kind === 'jump')        tone('sine', 220, 440, .1, .08);
    else if (kind === 'block')       tone('triangle', 520, 740, .06, .10);
    else if (kind === 'super')       tone('sawtooth', 180, 820, .4, .16);
    else if (kind === 'win')       { tone('square', 440, 440, .09, .12); tone('square', 660, 660, .09, .12, .09); tone('square', 880, 880, .12, .12, .18); }
    else if (kind === 'alarm')      { tone('sawtooth', 120, 120, .15, .12); tone('sawtooth', 110, 110, .15, .12, .15); tone('sawtooth', 120, 120, .15, .12, .3); }
    else if (kind === 'ko')          tone('sawtooth', 400, 50, .5, .2);
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
  punch:   { dmg:6,  total:.28, activeFrom:.06, activeTo:.14, reach:26, h:14,  kb:70,  stun:.28, cd:.30, oy:-26, combo:true, cancelFrom:.14, hitStop:.10 },
  punch2:  { dmg:7,  total:.24, activeFrom:.04, activeTo:.10, reach:30, h:14,  kb:90,  stun:.30, cd:.02, oy:-28, combo:true, cancelFrom:.10, hitStop:.10 },
  kick3:   { dmg:12, total:.36, activeFrom:.10, activeTo:.20, reach:34, h:16,  kb:150, stun:.48, cd:.02, oy:-14, last:true, cancelFrom:.20, hitStop:.18, windup:.12 },
  kick:    { dmg:10, total:.40, activeFrom:.12, activeTo:.24, reach:32, h:16,  kb:120, stun:.42, cd:.55, oy:-16, cancelFrom:.24, hitStop:.15, windup:.12 },
  airpunch:{ dmg:8,  total:.30, activeFrom:.06, activeTo:.14, reach:28, h:14,  kb:90,  stun:.35, cd:.02, oy:-26, air:true, hitStop:.10 },
  special: { dmg:14, total:.50, activeFrom:.22, activeTo:.30, cd:2.2, projectile:true, hitStop:.20, windup:.10 },
  super:   { dmg:30, total:.70, activeFrom:.25, activeTo:.35, cd:3.0, projectile:true, super:true, hitStop:.30, windup:.15 }
};
const COMBO_NEXT = { punch: 'punch2', punch2: 'kick3' };

// v62 阶梯关键帧（GG Xrd 删帧）：关掉插值，windup→strike→contact→consequence 硬切，
// 每 pose 指定停留秒数 —— stop-motion 感，不做平滑 tween
const STEP_TABLE = {
  punch:   [[0,.06],[1,.04],[2,.05],[3,.05],[4,.04],[5,.02],[6,.02]],
  punch2:  [[0,.05],[1,.04],[2,.04],[3,.04],[4,.03],[5,.02],[6,.02]],
  kick3:   [[0,.09],[1,.06],[2,.06],[3,.06],[4,.04],[5,.03],[6,.02]],
  kick:    [[0,.10],[1,.07],[2,.07],[3,.06],[4,.04],[5,.03],[6,.03]],
  airpunch:[[0,.06],[1,.05],[2,.05],[3,.05],[4,.04],[5,.03],[6,.02]],
  special: [[0,.12],[1,.08],[2,.08],[3,.08],[4,.06],[5,.04],[6,.04]],
  super:   [[0,.14],[1,.10],[2,.10],[3,.10],[4,.08],[5,.09],[6,.09]]
};
function stepFrame(name, stateT, frames) {
  const tab = STEP_TABLE[name];
  if (!tab) return Math.min(Math.floor(stateT * 14), frames - 1);
  let acc = 0;
  for (const [idx, hold] of tab) { acc += hold; if (stateT < acc) return Math.min(idx, frames - 1); }
  return frames - 1;
}

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
        
// 可用角色参数表（胜负手差异：速度/血量/伤害倍率/阵营/胜利台词）
const CHARACTERS = {
  fighter: { name:'小烈', hp:100, speed:105, dmg:1.00, desc:'均衡 · 速度型', side:'H', taunt:'还没完呢！', tauntCrit:'这一击，赌上了一切！' },
  blob:    { name:'阿蓝', hp:125, speed:88,  dmg:1.25, desc:'重装 · 血厚攻高', side:'H', taunt:'呼噜~ 我赢了！', tauntCrit:'见识下真正的力量吧！' },
  miko:    { name:'小桃', hp:108, speed:97,  dmg:1.12, desc:'迅捷 · 连打型', side:'H', taunt:'承让了！' },
  monkey:  { name:'大圣', hp:95,  speed:115, dmg:1.15, desc:'齐天 · 高速棍', side:'H', taunt:'俺老孙来也！' },
  nezha:   { name:'哪吒', hp:105, speed:100, dmg:1.06, desc:'三太子 · 火尖枪', side:'H', taunt:'闹海归来！' },
  gourd:   { name:'娃',   hp:118, speed:92,  dmg:1.22, desc:'葫芦娃 · 硬碰硬', side:'H', taunt:'七个葫芦一条心！' },
  cat:     { name:'猫警', hp:102, speed:112, dmg:1.08, desc:'正义 · 快枪手', side:'H', taunt:'坏蛋，站住！' },
  ultra:   { name:'光侠', hp:112, speed:95,  dmg:1.20, desc:'光之巨人 · 能量', side:'H', taunt:'我会守护这里！' },
  demon:   { name:'黑煞', hp:130, speed:84,  dmg:1.32, desc:'魔尊 · 重锤', side:'V', taunt:'黑暗永存。' },
  huntress:{ name:'小芸', hp:105, speed:110, dmg:1.05, desc:'灵巧 · 长枪游击', side:'H', taunt:'枪出如龙！', tauntCrit:'这一枪，为自由而战！' },
  wizard:  { name:'墨巫', hp:95,  speed:90,  dmg:1.35, desc:'秘法 · 重炮法师', side:'V', taunt:'黑暗即是真理。', tauntCrit:'见证深渊吧！' },
  viper:   { name:'蛇姬', hp:110, speed:108, dmg:1.18, desc:'蛊惑 · 高机动', side:'V', taunt:'你上钩了~' }
};
// 通用人形角色外观配置（英雄/反派统一模板，各带特色装饰）
const ROSTER = ['fighter', 'blob', 'miko', 'monkey', 'nezha', 'gourd', 'cat', 'ultra', 'demon', 'viper'];

const CAST_CFG = {
  monkey: { hair:'#d8a020', style:'topknot', gi:'#ffcf5a', belt:'#e04828', face:'#ffcf9e', deco:'staff',  deco2:'#ffe95c' },
  nezha:  { hair:'#3a2a3a', style:'buns',    gi:'#e83838', belt:'#e0e0e0', face:'#ffe2d0', deco:'spear',  deco2:'#ffd8a0' },
  gourd:  { hair:'#1c1c22', style:'gourd',   gi:'#3a8a3a', belt:'#d8d8d8', face:'#ffd8b0', deco:'gourd',  deco2:'#ff9d2e' },
  demon:  { hair:'#14141c', style:'horns',   gi:'#3a2a52', belt:'#7a5ae8', face:'#b98a6a', deco:'cape',   deco2:'#d83858' },
  viper:  { hair:'#4a9a4a', style:'flow',    gi:'#6a3a8a', belt:'#d8a030', face:'#d8b898', deco:'scales', deco2:'#8ae05a' },
  cat:    { hair:'#1a1a22', style:'cap',     gi:'#2a4a8a', belt:'#e0b030', face:'#f4cf9e', deco:'whiskers', deco2:'#ffffff' },
  ultra:  { hair:'#d8e0e8', style:'fin',     gi:'#d8e0e8', belt:'#e83838', face:'#ffd8a8', deco:'timer',   deco2:'#5ae8ff' }
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
      type: 'blob', name: '???', taunt: cfg.taunt, side: cfg.side,
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
      stretch: 0,     // v62 破形：接触帧沿攻击方向拉伸（渲染层）
      antic: 0,       // v62 蓄力预兆剩余秒（重攻击前摇定格）
      critSuper: false,  // v62 绝杀：低血量超必杀升级
      critKO: false,
      lastSuperKill: false,   // v64 本回合是否被必杀终结
      isAI: false,
      charKey: TYPE_SPRITE[opts.type] || (opts.isAI ? 'warrior' : 'hunter'),  // v65：实际精灵角色
      aiTimer: 0, aiMove: 0, aiAct: null,
      aiScale: 1,        // 街机模式逐层强化系数
      persona: 'balance',  // rush | guard | balance（AI 行为性格）
      combo: 0, comboDmg: 0,
      walkPhase: 0,
      aiGuard: 0,
      buf: { punch: 0, kick: 0, special: 0 },
      prev: { punch: false, kick: false, special: false },
      atkLog: [],              // 连段挑战用：最近攻击名序列
      prevX: 0,               // v63：次级 motion 位移滞后
      winFxDone: false,        // v63：胜利特效只播一次
    }, opts);
  }

  get onGround() { return this.y >= GROUND - 0.5; }
  get hurtbox() {
    const slim = this.type === 'fighter' || this.type === 'miko' ||
    this.type === 'monkey' || this.type === 'nezha' || this.type === 'gourd' ||
    this.type === 'demon' || this.type === 'viper' ||
    this.type === 'huntress' || this.type === 'wizard';
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
    this.antic = (ATTACKS[name] && ATTACKS[name].windup) || 0;   // v62 重攻击蓄力预兆 100-150ms
    this.critSuper = isSuper && this.hp < this.maxHp * 0.25;      // v62 低血量绝杀升级
    if (name === 'special' || name === 'super') {
      this.meter -= (isSuper ? 100 : 35);
      sfx(isSuper ? 'super' : 'shot');
      if (isSuper) {
        if (this.critSuper) {
          // v62 CRITICAL 仪式：黑边电影化 + 红闪 + 事件标签（SF6 #7）
          G.critCine = 1.1; addTrauma(.5);
          eventTag('CRITICAL', '#ff5a2e', this === G.p1 ? 1 : 2);
          critFlash();
          spawnSuperBurst(this.x, this.y - 30);
        } else goldenFlash();
      }
    }
    return true;
  }

  takeHit(dmg, dir, kb, stun, attacker, fx) {   // v62 fx: counter|punish|super 事件颜色语言
    if (this.state === 'ko') return;
    const foeInFront = Math.sign(attacker.x - this.x) === this.facing;
    const guarded = this.blocking && this.onGround && foeInFront && this.state !== 'attack';
    const isBreak = guarded && dmg >= 12;   // v62 破防：重攻击打中格挡
    const finalDmg = guarded ? (isBreak ? Math.max(2, Math.ceil(dmg * 0.5)) : Math.max(1, Math.ceil(dmg * 0.28))) : dmg;
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
      this.vx = dir * kb * (isBreak ? .5 : 0.18);
      this.flash = .034;   // v61：受击白闪 2 帧
      G.hitStop = isBreak ? .08 : .02; addTrauma(isBreak ? .4 : .15);
      this.squash = .07;
      spawnSparks(this.x, this.y - 30, dir, true, 0, isBreak ? 'break' : 'norm');
      if (isBreak) {
        // v62 GUARD BREAK：紫撕裂 + 事件标签（SF6 #1/#3）
        spawnSlash(this.x, this.y - 30, dir, 'break');
        eventTag('GUARD BREAK', '#c86bff', attacker === G.p1 ? 1 : 2);
        addTrauma(.25);
      }
      sfx('block');
      if (this.hp <= 0) {
        this.blocking = false;
        this.state = 'ko'; this.stateT = 0;
        this.vx = dir * 80; this.vy = -90;
        const gAtk = attacker.attack ? ATTACKS[attacker.attack] : null;
        if (gAtk && gAtk.super) attacker.lastSuperKill = true;   // v64 必杀终结标记
        onKO(attacker, this);
      }
      return;
    }

    this.blocking = false;
    this.state = 'hit'; this.stateT = 0;
    this.attack = null; this.hitDone = true;
    this.vx = dir * kb;
    if (!this.onGround) this.vy = -80;
    this.flash = .034;   // v61：受击白闪 2 帧（drawFighter 用 brightness 滤镜）
    attacker.combo++;
    attacker.comboDmg += finalDmg;
    // v61 分级顿帧（秒计时）+ Impact Tier 统一驱动火花/震屏
    const attAtk = attacker.attack ? ATTACKS[attacker.attack] : null;
    G.hitStop = Math.min(.30, (attAtk && attAtk.hitStop) || .10);
    const tier = clamp(finalDmg / 30, 0, 1);   // maxDmg=30（超必杀）
    addTrauma(tier < .25 ? .25 : tier < .55 ? .45 : .65);
    this.squash = .16;   // 受击挤压（渲染层，~150ms 恢复）
    // v62 颜色编码事件语言：counter 黄碎块 / punish 橙 / super 橙红喷溅（SF6 #1）
    const skind = fx === 'counter' ? 'counter' : fx === 'punish' ? 'punish' : fx === 'super' ? 'super' : 'norm';
    spawnSparks(this.x, this.y - 30, dir, false, tier, skind);
    sfx(dmg >= 10 ? 'kick' : 'hit');
    // v64 场景破坏（GG #13）：重击激起地面碎石；近墙（距边缘 60px 内）加墙面碎屑
    const nearWall = this.x < 76 || this.x > W - 76;
    if (tier >= .55) {
      spawnDebris(this.x, this.y, dir, nearWall ? 1 : .6);
      if (nearWall) spawnDebris(this.x + (this.x < W / 2 ? -16 : 16), this.y - 24, -dir, .6);
    }
    if (this.hp <= 0) {
      this.state = 'ko'; this.stateT = 0;
      this.vx = dir * 160; this.vy = -140;
      if (attacker.critSuper) attacker.critKO = true;   // v62 绝杀终结：胜利台词升级
      if (attAtk && attAtk.super) attacker.lastSuperKill = true;   // v64 必杀终结标记
      onKO(attacker, this);
    }
  }

  update(dt, foe, inp, pf) {
    pf = pf || { punch: -999, kick: -999, special: -999 };
    this.prevX = this.x;   // v63：次级 motion 用
    // 冷却与能量自然恢复
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.meter = clamp(this.meter + dt * 5, 0, this.maxMeter);
    this.flash = Math.max(0, this.flash - dt);
    this.squash = Math.max(0, this.squash - dt * 1.05);   // v61：受击挤压 ~150ms ease-out 恢复
    this.stretch = Math.max(0, this.stretch - dt * 1.4);  // v62：破形拉伸衰减

    // 胜利姿势：动作展示，不受输入影响
    if (this.state === 'win') {
      this.stateT += dt;
      // v63：warrior 胜利顿地（GG #12 差异化）——尘 puff + 闷响 + 震屏，只播一次
      if (!this.winFxDone && charOf(this) === 'warrior') {
        this.winFxDone = true;
        this.squash = .12;
        sfx('stomp'); addTrauma(.22);
        for (let i = 0; i < 10; i++) {
          const p = pAlloc(); if (!p) break;
          p.x = this.x + rand(-16, 16); p.y = GROUND - 2;
          p.vx = rand(-50, 50); p.vy = rand(-80, -12);
          p.t = 0; p.life = rand(.3, .6); p.s = irand(2, 3); p.c = 'rgba(150,120,100,.8)'; p.sh = 'sq';
        }
      }
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
      // v62 蓄力预兆：重攻击前 100-150ms 定格蓄力（渲染层挤压+轮廓预热，SF6 #10）
      if (this.antic > 0) { this.antic -= dt; return; }
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
          this.critSuper = sup && this.hp < this.maxHp * 0.25;   // v64 fix: 取消路径同样判定低血绝杀
          this.meter -= sup ? 100 : 35;
          sfx(sup ? 'super' : 'shot');
          if (sup) {
            if (this.critSuper) {
              // v64 fix: 取消路径的 CRITICAL 仪式（与 startAttack 一致）
              G.critCine = 1.1; addTrauma(.5);
              eventTag('CRITICAL', '#ff5a2e', this === G.p1 ? 1 : 2);
              critFlash();
              spawnSuperBurst(this.x, this.y - 30);
            } else goldenFlash();
          }
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
              dmg: Math.round(a.dmg * this.dmg * (this.critSuper ? 1.35 : 1)), owner: this, life: 1.6,
              r: superShot ? 13 : 7, super: superShot });
            if (superShot) addTrauma(.4);
          }
        } else {
          const hx = this.x + this.facing * a.reach;
          const hb = { x: Math.min(hx, this.x), y: this.y + a.oy - a.h/2, w: Math.abs(hx - this.x), h: a.h };
          const fb = foe.hurtbox;
          if (hb.x < fb.x + fb.w && hb.x + hb.w > fb.x && hb.y < fb.y + fb.h && hb.y + hb.h > fb.y) {
            this.hitDone = true;
            let dmg = Math.round(a.dmg * this.dmg);
            // v62 Counter 判定：对手出招前摇（startup）中被命中=Counter；出招中=Punish（GG #5）
            const foeAtk = foe.attack ? ATTACKS[foe.attack] : null;
            const isCounter = !foe.blocking && foe.state === 'attack' && foeAtk && foe.stateT < foeAtk.activeFrom;
            const isPunish = !foe.blocking && foe.state === 'attack' && !isCounter;
            if (isCounter) dmg = Math.round(dmg * 1.25);
            if (isPunish) dmg = Math.round(dmg * 1.5);
            foe.takeHit(dmg, this.facing, a.kb, a.stun, this, isCounter ? 'counter' : isPunish ? 'punish' : null);
            this.stretch = .12;   // v62 破形：接触帧沿攻击方向拉伸（GG #2/#3）
            // v62 三层斩击弧：hunter 刀光修长 / warrior 重击钝短；弧线形状=招式性格（GG #4）
            const arcKind = isCounter ? 'counter' : isPunish ? 'punish' : ({warrior:'heavy', wizard:'magic', hunter:'blade', huntress:'blade'})[charOf(this)] || 'blade';  // v65：按角色出弧
            spawnSlash(foe.x, foe.y - 30, this.facing, arcKind);
            if (isCounter) counterTrio(this, foe);   // v62 Counter 三件套
            else if (isPunish) {
              eventTag('PUNISH COUNTER', '#ff9d2e', this === G.p1 ? 1 : 2);
              G.counterSlow = .2; G.camPush = .25;
            }
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
// v61 粒子池：预分配 320 个，命中时复用，零分配
const PPOOL = [];
for (let i = 0; i < 320; i++) PPOOL.push({ x:0, y:0, vx:0, vy:0, life:0, t:0, c:'#fff', s:2, on:false });
function pAlloc() { for (const p of PPOOL) if (!p.on) { p.on = true; p.b = false; p.sh = 'sq'; return p; } return null; }  // v64：b=地面弹跳复位
let hitNums = [];   // 浮动伤害数字：{x,y,vy,txt,life,t,color}
let tauntTexts = []; // 胜利台词：{x,y,vy,txt,life,t,color,name}
// v61：Impact Tier 统一驱动 — tier=dmg/30：轻 4 / 中 10 / 重 24 粒，尺寸同步分级
// v62：颜色编码事件语言（SF6 #1）— 每种事件专属色+专属形状：
//   norm 普通 / counter 黄碎块 / punish 橙碎块 / super 橙红喷溅 / break 紫撕裂
const FX_STYLE = {
  norm:    { c: ['#ffe95c','#ff8b2e'], sh: 'sq' },
  counter: { c: ['#ffe95c','#fff3b0'], sh: 'shard' },
  punish:  { c: ['#ff9d2e','#ff6b2e'], sh: 'shard' },
  super:   { c: ['#ff6b2e','#ff3d1e'], sh: 'splat' },
  break:   { c: ['#c86bff','#9a4ae8'], sh: 'tear' }
};
function spawnSparks(x, y, dir, guarded = false, tier = 0, kind = 'norm') {
  let n, sm;
  if (guarded) { n = 6; sm = 1; }
  else if (tier < .25) { n = 4; sm = 1; }
  else if (tier < .55) { n = 10; sm = 1.3; }
  else { n = 24; sm = 1.8; }
  const st = FX_STYLE[kind] || FX_STYLE.norm;
  for (let i = 0; i < n; i++) {
    const p = pAlloc();
    if (!p) break;
    p.x = x; p.y = y + rand(-6, 6) * sm;
    p.vx = dir * rand(30, 230 * sm) + rand(-40, 40); p.vy = rand(-150, 40);
    p.life = rand(.2, .5); p.t = 0;
    p.c = guarded ? (Math.random() < .5 ? '#b8f6ff' : '#5ccfff') : st.c[irand(0, st.c.length - 1)];
    p.s = irand(2, 4) * sm * (st.sh === 'splat' ? 1.5 : 1);
    p.sh = guarded ? 'sq' : st.sh;
  }
}

// v62 三层斩击弧（GG Xrd #4）：粗主弧定方向 + 细次弧支撑 + 破碎尖片给质感；
// 中心近白高亮刃、外缘招式色；弧线形状本身就是招式性格
let slashes = [];
function spawnSlash(x, y, dir, kind) {
  const cfg = {
    blade:   { r: 36, w: 7,  c: '#7ad8ff', inner: '#f4ffff' },  // hunter 刀光：修长
    heavy:   { r: 26, w: 11, c: '#ff9d2e', inner: '#fff3d0' },  // warrior 重击：钝短
    counter: { r: 42, w: 8,  c: '#ffe95c', inner: '#fffbe0' },
    punish:  { r: 44, w: 9,  c: '#ff9d2e', inner: '#fff3d0' },
    super:   { r: 54, w: 11, c: '#ff6b2e', inner: '#fff8d0' },
    magic:   { r: 40, w: 8,  c: '#b47aff', inner: '#e8dcff' },  // v65 wizard 秘法弧
    break:   { r: 46, w: 9,  c: '#c86bff', inner: '#f0dcff' }
  }[kind] || { r: 30, w: 7, c: '#7ad8ff', inner: '#f4ffff' };
  slashes.push({ x, y, dir, t: 0, life: .26, r: cfg.r, w: cfg.w, c: cfg.c, inner: cfg.inner });
  // 破碎尖片：复用 v61 的 320 粒子池
  for (let i = 0; i < 6; i++) {
    const p = pAlloc(); if (!p) break;
    p.x = x + rand(-8, 8); p.y = y + rand(-14, 14);
    p.vx = dir * rand(60, 260); p.vy = rand(-120, 60);
    p.life = rand(.15, .3); p.t = 0; p.c = cfg.inner; p.s = irand(2, 3); p.sh = 'shard';
  }
}

// v62 事件标签（SF6 #3）：Counter 黄 / Punish 橙 / 破防紫 / Critical 红橙，屏侧大字，与伤害数字分通道
let eventTags = [];
function eventTag(txt, color, side) {
  eventTags.push({ txt, color, side, t: 0, life: .9 });
}
// v62 Counter 三件套：200ms 慢动作 + 大字 + 镜头轻推 1.06（GGST #5）；平时 HUD 保持克制
function counterTrio(attacker, foe) {
  G.counterSlow = .2;
  G.camPush = .25;
  eventTag('COUNTER', '#ffe95c', attacker === G.p1 ? 1 : 2);
  addTrauma(.45);
}

// v64 场景破坏（GG #13）：碎石带地面弹跳 + 尘埃，复用 320 粒子池
function spawnDebris(x, y, dir, tier) {
  const n = tier >= 1 ? 14 : 9;
  const rockC = ['#6a5a48', '#4a3f33', '#8a7a5f', '#3a3230'];
  for (let i = 0; i < n; i++) {
    const p = pAlloc(); if (!p) break;
    p.x = x + rand(-10, 10); p.y = Math.min(y, GROUND - 4) + rand(-6, 0);
    p.vx = dir * rand(20, 200) + rand(-60, 60); p.vy = rand(-220, -60);
    p.life = rand(.4, .8); p.t = 0;
    p.c = rockC[irand(0, rockC.length - 1)]; p.s = irand(2, 4); p.sh = 'sq'; p.b = true;
  }
  for (let i = 0; i < 6; i++) {
    const p = pAlloc(); if (!p) break;
    p.x = x + rand(-14, 14); p.y = GROUND - 2;
    p.vx = dir * rand(10, 90); p.vy = rand(-70, -20);
    p.life = rand(.3, .6); p.t = 0; p.c = '#c8aa8c'; p.s = irand(3, 5); p.sh = 'sq';
  }
}

// v64 KO 终结冲击环
let shockRings = [];
function spawnShockRing(x, y) { shockRings.push({ x, y, t: 0, life: .45 }); }

// v64 解说大字（SF6 #14）：PERFECT / SUPER FINISH，一字街机播报
function shout(txt, color, dy) { G.shouts.push({ txt, color, dy: dy || 0, t: 0, life: 1.4 }); }   // v64 dy：多播报错开

// 超必杀命中爆发
function spawnSuperBurst(x, y) {
  const colors = ['#ffe95c', '#ffd83a', '#fff8d0', '#ff9d2e'];
  for (let i = 0; i < 26; i++) {
    const p = pAlloc();
    if (!p) break;
    p.x = x + rand(-6, 6); p.y = y + rand(-6, 6);
    p.vx = rand(-190, 190); p.vy = rand(-190, 60);
    p.life = rand(.25, .5); p.t = 0;
    p.c = colors[irand(0, colors.length - 1)]; p.s = irand(3, 6);
  }
  addTrauma(.65);
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

// v62 绝杀红闪（Critical 超必杀释放）
function critFlash() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none;' +
    'background:radial-gradient(ellipse at center,rgba(255,90,40,.9),rgba(180,30,10,.45) 45%,transparent 75%);' +
    'animation:critfade .6s ease-out forwards;';
  document.head.appendChild(document.createElement('style')).textContent =
    '@keyframes critfade{from{opacity:1}to{opacity:0}}';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 620);
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
  scene: 'dusk',
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
  trauma: 0,      // v61 震屏创伤值 0..1：偏移 = trauma² × 10px，衰减 2.5/s
  koSlow: 0,      // v61 KO 慢动作剩余秒数（timeScale 0.2）
  koFlash: 0,     // v61 KO 剪影闪剩余秒数
  hitStop: 0,
  camPush: 0,     // v62 镜头轻推剩余（Counter/绝杀，1.06 缩放）
  counterSlow: 0, // v62 Counter 慢动作剩余秒（200ms）
  critCine: 0,    // v62 绝杀电影化剩余秒（黑边+暗角+推近）
  koFx: null,     // v64 KO 终结演出 {t, lx, ly}：白闪→推近→黑场→K.O.
  roundOutcomes: [], // v64 回合胜负标记 {win:'p1'|'p2'|null, how:'ko'|'timeout'|'super'}
  shouts: [],     // v64 解说大字 PERFECT / SUPER FINISH
  projectiles: [],
  comboShow: 0, comboSide: 1, comboT: 0,
  hudGhost1: 1, hudGhost2: 1, // v60 血条白条（chip damage）残影
  p1: null, p2: null
};

const NO_INPUT = Object.freeze({ left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false });
// v61：创伤值累加（钳制 0..1），只给"值得"的事件
function addTrauma(x) { G.trauma = Math.min(1, G.trauma + x); }
const NO_PRESS_FRAME = Object.freeze({ punch: -999, kick: -999, special: -999 });
function clearInput() { for (const k in input) input[k] = false; for (const k in input2) input2[k] = false; }
function show2P() { if (IS_TOUCH) document.getElementById('tc-2p').classList.remove('hidden'); }
function hide2P() { document.getElementById('tc-2p').classList.add('hidden'); }

function startMatch(mode) {
  G.mode = mode || 'vsai';       // vsai | pvp | train | arcade | endless
  G.training = (G.mode === 'train');
  if (G.mode === 'pvp') show2P(); else hide2P();
  if (G.mode === 'arcade' || G.mode === 'endless') {
    const endless = G.mode === 'endless';
    G.arcade = {
      stage: 1,
      score: 0,
      boss: false,
      endless,
      best: parseInt(localStorage.getItem(endless ? 'pixelbrawl_endless_best' : 'pixelbrawl_best') || '0', 10) || 0
    };
  }
  startBGM(G.mode === 'train' ? 'menu' : 'battle');
  G.round = 1;
  G.wins = { p1: 0, p2: 0 };
  G.roundOutcomes = [];   // v64 每局重置胜负标记
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
  if (G.mode === 'arcade' || G.mode === 'endless') {
    const stage = G.arcade.stage;
    if (G.mode === 'endless') {
      // 无尽模式：英雄/反派全池轮换，难度阶梯持续上升（scale封顶2.8）
      const pool = ROSTER.filter(t => t !== G.playerType);
      p2Type = pool[(stage - 1) % pool.length];
      G.arcade.boss = false;
      aiScale = Math.min(2.8, 1 + (stage - 1) * 0.16);
      hpBoost = Math.min(120, (stage - 1) * 10);
      persona = ['balance','rush','guard','rush','bossRush'][(stage - 1) % 5];
      startBGM(stage % 5 === 0 ? 'boss' : 'battle');
    } else {
      // 街机剧本：前4战英雄轮换（平衡→侵略→龟壳→侵略），第5战反派黑煞 Boss
      const personaOrder = ['balance', 'rush', 'guard', 'rush', 'bossRush'];
      G.arcade.boss = stage === 5;
      p2Type = G.arcade.boss ? 'demon' : heroes[(stage - 1) % heroes.length];
      aiScale = G.arcade.boss ? 1.95 : (1 + (stage - 1) * 0.22);
      hpBoost = Math.min(80, (stage - 1) * 12);
      persona = personaOrder[Math.min(4, stage - 1)];
      if (G.arcade.boss) startBGM('boss');
      else startBGM('battle');
    }
  }
  const p2c = CHARACTERS[p2Type];
  G.p1 = new Fighter({ x: 140, facing: 1, type: G.playerType, name: p1c.name, hp: p1c.hp, isAI: false });
  G.p2 = new Fighter({ x: 340, facing: -1, type: p2Type, name: p2c.name, hp: p2c.hp + hpBoost, isAI: true, aiScale, persona });
  G.projectiles = []; for (const p of PPOOL) p.on = false; hitNums = []; tauntTexts = [];
  G.time = G.training ? Infinity : 60;
  G.winner = null; G.roundCause = '';
  G.pausedFrom = null;
  G.trauma = 0; G.koSlow = 0; G.koFlash = 0; G.hitStop = 0; G.comboShow = 0; G.comboT = 0;
  G.camPush = 0; G.counterSlow = 0; G.critCine = 0; slashes = []; eventTags = [];
  G.koFx = null; G.shouts = []; shockRings = [];   // v64
  G.p1.lastSuperKill = false; G.p2.lastSuperKill = false;   // v64 必杀终结标记重置
  G.hudGhost1 = 1; G.hudGhost2 = 1; // v60 白条残影复位
  G.introT = 0;
  G.scene = pickScene();
  G.vsTimer = 0;
  G.trialsAllDone = false;
  if (G.training && G.trials) initTrials();   // 每轮复位连段挑战
  G.state = G.training ? 'fight' : ((G.mode === 'vsai' || G.mode === 'arcade' || G.mode === 'endless') ? 'vs' : 'intro');
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
  if (winner) { winner.state = 'win'; winner.stateT = 0; winner.winFxDone = false; sfx('win');
    // 胜利台词
    tauntTexts.push({ x: winner.x, y: winner.y - 60, vy: -20, life: 2.5, t: 0,
      txt: winner.name + '：' + (winner.critKO && winner.tauntCrit ? winner.tauntCrit : winner.taunt),
      color: ANCHOR[charOf(winner)] || '#ffe95c', name: winner.name });   // v63：角色视觉锚色
  }
  if (G.training) {
    G.roundCause = cause;
    G.koTimer = 0;
    G.state = 'training-ko';
    sfx('ko'); addTrauma(1.0); G.hitStop = .16; G.koSlow = .6; G.koFlash = .05; whiteFlash();
    return;
  }
  G.roundCause = cause;
  G.koTimer = 0;
  if (winner === G.p1) G.wins.p1++;
  if (winner === G.p2) G.wins.p2++;
  // v64 回合胜负标记（SF6 #11）：记录怎么赢的
  let how = cause;
  if (cause === 'ko' && winner && winner.lastSuperKill) how = 'super';
  G.roundOutcomes.push({ win: winner === G.p1 ? 'p1' : (winner === G.p2 ? 'p2' : null), how });
  // v64 解说大字（SF6 #14）
  if (winner && !G.training) {
    const perf = winner.hp >= winner.maxHp;
    if (perf) shout('PERFECT', '#ffe95c', 0);                          // 无伤回合
    if (how === 'super') shout('SUPER FINISH', '#ff6b2e', perf ? 38 : 0);   // 必杀终结（无伤+必杀双播报错开）
  }
  if (cause === 'ko') {
    G.state = 'ko';
    sfx('ko'); addTrauma(1.0); G.hitStop = .16; G.koSlow = .6; G.koFlash = .05;
    // v64 KO 终结演出（GG #10）：白闪 2-3 帧 → 镜头推近受害者 → 黑场 → K.O.大字（canvas 内，不再用 DOM 白闪）
    const loser = winner === G.p1 ? G.p2 : (winner === G.p2 ? G.p1 : null);
    G.koFx = { t: 0, lx: loser ? loser.x : W / 2, ly: loser ? loser.y - 30 : H / 2 };
    if (loser) {
      spawnShockRing(loser.x, loser.y - 30);
      const kd = Math.sign(((winner ? winner.x : W / 2) - loser.x)) || 1;
      spawnDebris(loser.x, GROUND, kd, 1);
    }
  } else {
    G.state = 'timeup';
    addTrauma(.1);
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
  if (G.mode === 'endless') {
    if (!G.winner) { startRound(); return; }
    if (G.winner === G.p2) {
      G.matchWinner = G.p2;
      endMatch();
      return;
    }
    G.arcade.score += 1000 + Math.round(G.p1.hp) * 10;
    G.arcade.stage++;
    G.p1.hp = G.p1.maxHp;
    startRound();
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
    rt.style.color = '#f4ecdf';
    rd.textContent = '平局 — 本局重赛！';
  } else if (G.mode === 'endless') {
    if (G.arcade.score > G.arcade.best) {
      G.arcade.best = G.arcade.score;
      try { localStorage.setItem('pixelbrawl_endless_best', String(G.arcade.best)); } catch (e) {}
    }
    rt.textContent = 'ENDLESS OVER';
    rt.style.color = '#ffe95c';
    const bestTxt = G.arcade.score >= G.arcade.best && G.arcade.score > 0 ? ' · 新纪录!' : '';
    rd.textContent = '坚持到第 ' + Math.max(1, G.arcade.stage) + ' 战 · 得分 ' + G.arcade.score + bestTxt + ' · 最佳 ' + G.arcade.best;
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
    rt.style.color = '#ffe95c';
    const bestTxt = G.arcade.score >= G.arcade.best && G.arcade.score > 0 ? ' · 新纪录!' : '';
    rd.textContent = (cleared ? '街机通关！' : '到达第 ' + Math.max(1, G.arcade.stage) + ' 战') +
      (cleared ? ' · 评级 ' + grade + ' · 幸存 ' + pct + '%' : '') +
      ' · 得分 ' + G.arcade.score + bestTxt + ' · 最佳 ' + G.arcade.best;
  } else if (G.mode === 'pvp') {
    rt.textContent = 'MATCH WIN';
    rt.style.color = ANCHOR[charOf(winner)] || '#ffe95c';   // v64 胜者锚色（P1 橙红 / P2 冷蓝）
    rd.textContent = (winner === G.p1 ? '1P 获胜！' : '2P 获胜！') + ' · 比分 ' + G.wins.p1 + ' : ' + G.wins.p2;
  } else {
    rt.textContent = 'MATCH WIN';
    rt.style.color = ANCHOR[charOf(winner)] || '#ffe95c';   // v64 胜者锚色（P1 橙红 / P2 冷蓝）
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
  starry:  { sky:['#0a0a1a','#1a0a2a','#0a0a1a'], hill1:'#2a2a3a', hill2:'#3a2a3a', tree:'#1a2a1a', trunk:'#2a1a1a', ground:'#2a2a3a', ground2:'#1a1a2a', fence:'#3a2a2a', stars:true },
  dusk:    { sky:['#2a1a4a','#b34a6e','#ff9a5c'], hill1:'#6a5a8a', hill2:'#4a3a6a', hill3:'#2e2547', tree:'#232a33', trunk:'#3a2a1a', ground:'#3a2e22', ground2:'#4a6a3a', fence:'#5a3a2a', dusk:true }
};
const ARCADE_SCENE_ORDER = ['dusk', 'evening', 'night', 'dojo', 'starry'];
function pickScene() {
  if (G.mode === 'arcade') return ARCADE_SCENE_ORDER[Math.min(4, G.arcade.stage - 1)];
  if (G.mode === 'endless') return ARCADE_SCENE_ORDER[(G.arcade.stage - 1) % ARCADE_SCENE_ORDER.length];
  return 'dusk';
}
  // 场景画布缓存（每个主题预渲染一次）
const bgCanvasMap = {};
// v60 黄昏道场山谷：落日余晖 + 三层远山 + 灯笼暖光 + 暗角（预渲染一次，60fps 零开销）
function buildDuskBG() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const b = c.getContext('2d');
  // 天空：深紫 → 品红 → 落日橙
  const sky = b.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#2a1a4a'); sky.addColorStop(.55, '#b34a6e'); sky.addColorStop(1, '#ff9a5c');
  b.fillStyle = sky; b.fillRect(0, 0, W, GROUND);
  // 落日圆盘 + 光晕（地平线附近）
  const sunX = W * 0.68, sunY = 118;   // v63：太阳移到右上三分点附近（art #3），不再居中
  const glow = b.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
  glow.addColorStop(0, 'rgba(255,220,160,.85)'); glow.addColorStop(.35, 'rgba(255,170,110,.35)'); glow.addColorStop(1, 'rgba(255,150,90,0)');
  b.fillStyle = glow; b.fillRect(sunX - 70, sunY - 70, 140, 140);
  b.fillStyle = '#ffe9b8';
  b.beginPath(); b.arc(sunX, sunY, 24, 0, 7); b.fill();
  // 三层远山（远→近，雾化递减）
  function ridge(baseY, amp, freq, phase, color) {
    b.fillStyle = color;
    b.beginPath(); b.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 24) b.lineTo(x, baseY - Math.abs(Math.sin(x * freq + phase)) * amp);
    b.lineTo(W, GROUND); b.fill();
  }
  ridge(150, 55, .011, 0, '#6a5a8a');   // 远山（带雾）
  ridge(175, 42, .017, 2, '#4a3a6a');   // 中山
  ridge(200, 30, .023, 4, '#2e2547');   // 近山
  // 地面：暗土 + 草带 + 土路
  b.fillStyle = '#3a2e22'; b.fillRect(0, GROUND, W, H - GROUND);
  b.fillStyle = '#3f4a35'; b.fillRect(0, GROUND, W, 7);   // v63：草带降饱和，黄昏不许出现高饱和绿
  b.fillStyle = '#2e2419'; b.fillRect(0, GROUND + 7, W, 2);
  b.fillStyle = '#54402c'; // 中央土路
  b.beginPath(); b.ellipse(W / 2, GROUND + 24, 150, 10, 0, 0, 7); b.fill();
  b.fillStyle = 'rgba(0,0,0,.25)';
  for (let x = 0; x < W; x += 14) b.fillRect(x, GROUND + 12 + ((x * 5) % 3) * 3, 6, 2);
  // 剪影树
  function silTree(x, y, s) {
    b.fillStyle = '#1c1626'; b.fillRect(x - 2 * s, y - 16 * s, 4 * s, 16 * s);
    b.fillRect(x - 11 * s, y - 28 * s, 22 * s, 12 * s);
    b.fillRect(x - 7 * s, y - 34 * s, 14 * s, 7 * s);
  }
  silTree(36, 202, 1.4); silTree(448, 204, 1.7);
  // 木栅栏（保留原风格）
  b.fillStyle = '#5a3a2a';
  for (let x = 10; x < W; x += 26) b.fillRect(x, 196, 3, 14);
  b.fillRect(0, 199, W, 2); b.fillRect(0, 205, W, 2);
  b.fillStyle = 'rgba(255,200,130,.25)'; b.fillRect(0, 199, W, 1);
  // 纸灯笼柱 ×2（暖光）
  function lantern(x) {
    b.fillStyle = '#3a2a1a'; b.fillRect(x - 2, 150, 4, 48);
    b.fillRect(x - 8, 146, 16, 3);
    const lg = b.createRadialGradient(x, 162, 2, x, 162, 34);
    lg.addColorStop(0, 'rgba(255,202,122,.8)'); lg.addColorStop(1, 'rgba(255,202,122,0)');
    b.fillStyle = lg; b.fillRect(x - 34, 128, 68, 68);
    b.fillStyle = '#ffca7a';
    b.fillRect(x - 7, 152, 14, 18);
    b.fillStyle = '#e89a4a';
    b.fillRect(x - 7, 152, 14, 3); b.fillRect(x - 7, 167, 14, 3);
    b.fillStyle = '#fff3d0'; b.fillRect(x - 3, 156, 6, 10);
  }
  lantern(70); lantern(410);
  // v62 中央降噪：战斗横带对比度降 ~25%，人物永远最亮层；灯笼/尘埃留边缘（SF6 #6）
  const dn = b.createLinearGradient(0, 0, W, 0);
  dn.addColorStop(0, 'rgba(16,8,26,0)'); dn.addColorStop(.3, 'rgba(16,8,26,.28)');
  dn.addColorStop(.7, 'rgba(16,8,26,.28)'); dn.addColorStop(1, 'rgba(16,8,26,0)');
  b.fillStyle = dn; b.fillRect(0, 96, W, GROUND - 96);
  // 暗角
  const vg = b.createRadialGradient(W/2, H/2, H*0.42, W/2, H/2, H*0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,16,.3)');   // v61：暗角收敛到 0.3
  b.fillStyle = vg; b.fillRect(0, 0, W, H);
  // v63 前景框景（art #4）：极暗道场柱剪影 + 屋檐角，左右边缘，绝不遮挡中央战斗带
  b.fillStyle = 'rgba(12,8,18,.85)';
  b.fillRect(0, 110, 14, H - 110); b.fillRect(W - 14, 110, 14, H - 110);
  b.fillRect(0, 104, 20, 8); b.fillRect(W - 20, 104, 20, 8);
  b.fillStyle = 'rgba(12,8,18,.7)';
  b.beginPath(); b.moveTo(0, 0); b.lineTo(64, 0); b.lineTo(0, 26); b.closePath(); b.fill();
  b.beginPath(); b.moveTo(W, 0); b.lineTo(W - 64, 0); b.lineTo(W, 26); b.closePath(); b.fill();
  return c;
}
function buildBG(sceneKey) {
  const sc = SCENES[sceneKey] || SCENES.dusk;
  if (sc.dusk) return buildDuskBG();
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
  // 受击挤压（Squash & Stretch）：横向拉宽+纵向压扁，随 squash 衰减回正（仅渲染层）
  if (f.squash > 0) ctx.scale(1 + f.squash * 1.6, 1 - f.squash * 1.0);
  // v62 破形：接触帧沿攻击方向拉伸，画出来"对"比"准"重要（GG #2/#3）
  if (f.stretch > 0) ctx.scale(1 + f.stretch * 1.4, 1 - f.stretch * 0.9);
  // v62 蓄力预兆：下蹲蓄力（SF6 #10）
  if (f.antic > 0) ctx.scale(1.12, 0.88);
  ctx.scale(f.facing, 1);
  // v61：受击白闪 2 帧（brightness 滤镜，只作用于受击者）
  if (f.flash > 0) { try { ctx.filter = 'brightness(3)'; } catch (e) {} }

  // v59 精灵测试：使用外部精灵图替代程序化绘制（window.V59_SPRITES=false 可回退）
  if (window.V59_SPRITES !== false) {
    const fr = spriteFrame(f);
    // v63 次级 motion（art #2）：idle 呼吸（脚底锚定纵向 0.8% 微循环）+ 位移滞后摆动
    if (f.state === 'idle') { ctx.scale(1, 1 + Math.sin(time * 3.9) * 0.022); ctx.rotate(Math.sin(time * 3.9 - .9) * .008 * f.facing); }   // v64 呼吸加到 2.2% + 肩部反向微摆（看得见但不滑稽）
    const sway = clamp((f.prevX - f.x) * 0.004, -0.035, 0.035);
    if (sway) ctx.rotate(sway * f.facing);
    // v63 胜利姿势差异化（GG #12）：hunter 收刀前倾 / warrior 顿地微蹲
    if (f.state === 'win') {
      if (fr && fr.char === 'hunter') ctx.rotate(0.045 * f.facing);
      else ctx.scale(1.03, 0.96);
    }
    if (fr) {
      // v63 选择性描边粗细（GG #7）：攻击帧加粗、平时减弱，指挥视线
      const atk = f.state === 'attack';
      const silS = atk ? 1.05 : 1.02;
      const off = (silS - 1) / 2;
      // v63 双轮廓光（art #1/#4）：暖（落日上右）+ 冷紫（天空反光下左），同一光源方向
      // x 偏移乘 facing，保证暖侧永远在世界右侧（落日侧）
      const wx = 1.2 * f.facing;
      const dc = getSil(fr.char, fr.anim, fr.idx, fr.fs, fr.h, atk ? 'rgba(10,6,12,.65)' : 'rgba(10,6,12,.5)');
      const wc = getSil(fr.char, fr.anim, fr.idx, fr.fs, fr.h, atk ? 'rgba(255,207,158,.9)' : 'rgba(255,207,158,.7)');
      const cc = getSil(fr.char, fr.anim, fr.idx, fr.fs, fr.h, 'rgba(150,125,255,.5)');
      const cw = fr.fs * fr.sc, ch = fr.h * fr.sc;
      const cx = -fr.ax * fr.sc, cy = -fr.ay * fr.sc;
      ctx.drawImage(cc, 0, 0, fr.fs, fr.h, cx - cw * off - wx, cy - ch * off + 1.2, cw * silS, ch * silS);
      ctx.drawImage(dc, 0, 0, fr.fs, fr.h, cx - cw * off, cy - ch * off, cw * silS, ch * silS);
      ctx.drawImage(wc, 0, 0, fr.fs, fr.h, cx + wx, cy - 1.2, cw, ch);
      // v62 蓄力预热：轮廓光增强暖光晕，卖出"要发力了"（SF6 #10）
      if (f.antic > 0) {
        const ag = ctx.createRadialGradient(0, -30, 4, 0, -30, 48);
        ag.addColorStop(0, 'rgba(255,170,90,.4)'); ag.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = ag; ctx.fillRect(-48, -78, 96, 96);
      }
    }
    drawSpriteFighter(f, time);
    // v63 环境光染色（art #1）：暖橙受光（上右）+ 冷紫背光（下左），剪影形状低 alpha 覆盖
    if (fr) {
      const cw = fr.fs * fr.sc, ch = fr.h * fr.sc;
      const tint = getSilGrad(fr.char, fr.anim, fr.idx, fr.fs, fr.h,
        [[0, 'rgba(150,120,255,.16)'], [0.55, 'rgba(150,120,255,0)'], [1, 'rgba(255,150,60,.20)']], f.facing < 0);
      ctx.drawImage(tint, 0, 0, fr.fs, fr.h, -fr.ax * fr.sc, -fr.ay * fr.sc, cw, ch);
    }
    ctx.restore(); return;
  }

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
  if (c.deco === 'timer') { px(-3, -28+bob, 6, 6, '#1a2a3a'); px(-2, -27+bob, 4, 4, c.deco2); }  // 胸前能量灯
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
  } else if (c.style === 'cap') {
    px(-9, -55+bob, 18, 5, c.hair);
    px(-11, -57+bob, 22, 3, c.hair);                                     // 帽檐
    px(-3, -59+bob, 6, 4, c.belt);                                       // 帽徽
  } else if (c.style === 'fin') {
    px(-9, -55+bob, 18, 6, c.hair);
    px(-2, -62+bob, 4, 10, c.hair);                                      // 头冠鳍
    px(-1, -60+bob, 2, 7, c.deco2);                                      // 鳍光条
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
  // 角色装饰（脸侧）
  if (c.deco === 'whiskers') {
    px(-14, -46+bob, 6, 1, c.deco2); px(-14, -43+bob, 6, 1, c.deco2);
    px(8, -46+bob, 6, 1, c.deco2);   px(8, -43+bob, 6, 1, c.deco2);
  }
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
  ctx.font = '700 11px ' + FONT.ui; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#f4ecdf';
  ctx.fillText(G.p1.name, W * 0.18, 132);
  ctx.fillText(G.p2.name, W * 0.82, 132);
  // 居中 VS 字样（脉动）
  const pulse = 1 + Math.sin(G.vsTimer * 10) * 0.05;
  ctx.save();
  ctx.translate(W / 2, 92); ctx.scale(pulse, pulse);
  ctx.font = '34px ' + FONT.disp;   // v61：展示字体
  ctx.strokeStyle = '#5c0d00'; ctx.lineWidth = 7;
  ctx.strokeText('VS', 0, 0);
  ctx.fillStyle = '#ffe95c'; ctx.fillText('VS', 0, 0);
  ctx.restore();
  if (G.mode === 'arcade' || G.mode === 'endless') {
    ctx.font = '700 10px ' + FONT.num; ctx.fillStyle = G.arcade.boss ? '#ff4b2e' : '#9fd4ff';
    ctx.fillText(G.mode === 'endless' ? 'WAVE ' + G.arcade.stage : (G.arcade.boss ? 'FINAL BOSS' : 'STAGE ' + G.arcade.stage + ' / 5'), W / 2, 128);
  }
  ctx.font = '500 8px ' + FONT.ui; ctx.fillStyle = '#6a7d92';
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
    if (c.style==='cap'){ px(3,2,20,5,'#1a1a22'); px(10,0,6,3,'#e0b030'); px(0,9,5,1,'#fff'); px(21,9,5,1,'#fff'); }
    if (c.style==='fin'){ px(10,-1,6,6,'#e83838'); px(6,12,5,4,'#222'); px(15,12,5,4,'#222'); px(10,18,6,3,'#e83838'); }
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
  const SLANT = 6;

  // ---------- 血条 ----------
  function slantPath(x, y, w, h, leftSlant) {
    ctx.beginPath();
    if (leftSlant) {
      ctx.moveTo(x + SLANT, y); ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x + w - SLANT, y);
      ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
    }
    ctx.closePath();
  }
  function hpBar(x, pct, ghost, leftSlant) {
    const y = 8, w = 180, h = 14;
    // 深枪色外框
    ctx.fillStyle = '#14161f';
    slantPath(x - 2, y - 2, w + 4, h + 4, leftSlant); ctx.fill();
    ctx.save();
    slantPath(x, y, w, h, leftSlant); ctx.clip();
    ctx.fillStyle = '#2a1214'; ctx.fillRect(x, y, w, h);
    // 白条残影（chip damage）
    const gw = Math.round(w * Math.max(0, ghost - pct));
    if (gw > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      if (leftSlant) ctx.fillRect(x + Math.round(w * pct), y, gw, h);
      else ctx.fillRect(x + w - Math.round(w * pct) - gw, y, gw, h);
    }
    // 血量：绿→黄→红
    const fw = Math.round(w * pct);
    ctx.fillStyle = pct > .5 ? '#58d83a' : pct > .25 ? '#ffd83a' : '#ff4b2e';
    if (leftSlant) ctx.fillRect(x, y, fw, h);
    else ctx.fillRect(x + w - fw, y, fw, h);
    // v64 低血量黄段呼吸（SF6 #4）："超杀可终结"信号，与 25% 刻度区分
    if (pct < .25 && pct > 0) {
      const pulse = .3 + .25 * Math.sin(gameTime * 7);
      ctx.fillStyle = 'rgba(255,216,58,' + pulse.toFixed(3) + ')';
      if (leftSlant) ctx.fillRect(x, y, fw, h);
      else ctx.fillRect(x + w - fw, y, fw, h);
    }
    // v62 绝杀阈值线：25% 黄色刻度 —— "绝杀可用"可视化（SF6 #4）
    ctx.fillStyle = '#ffd83a';
    if (leftSlant) ctx.fillRect(x + Math.round(w * .25) - 1, y, 2, h);
    else ctx.fillRect(x + Math.round(w * .75) - 1, y, 2, h);
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, w, 2);
    ctx.restore();
    // 低血量红色闪烁
    if (pct < .25 && Math.floor(gameTime * 6) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,60,40,.4)';
      slantPath(x - 2, y - 2, w + 4, h + 4, leftSlant); ctx.fill();
    }
  }
  hpBar(56, p1.hp / p1.maxHp, G.hudGhost1, true);
  hpBar(W - 56 - 180, p2.hp / p2.maxHp, G.hudGhost2, false);

  // ---------- 头像勋章（精灵头部裁剪；v61 切角框） ----------
  function medallion(mx, char, flip) {
    const mw = 46, mh = 34, my = 4, s = 8;
    ctx.fillStyle = '#14161f';
    cutPanel(mx, my, mw, mh, s); ctx.fill();
    ctx.strokeStyle = '#c89a30'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = ANCHOR[char] || '#c89a30'; ctx.globalAlpha = .55;   // v63：角色视觉锚色
    cutPanel(mx, my, mw, mh, s); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.save(); ctx.clip();
    const img = getPortrait(char);
    if (flip) {
      ctx.translate(mx + mw / 2, 0); ctx.scale(-1, 1);
      ctx.drawImage(img, -mw / 2 + 4, my + 2, mw - 8, mh - 4);
    } else {
      ctx.drawImage(img, mx + 4, my + 2, mw - 8, mh - 4);
    }
    ctx.restore();
  }
  medallion(6, (G.p1 && G.p1.charKey) || 'hunter', false);
  medallion(W - 6 - 46, (G.p2 && G.p2.charKey) || 'warrior', true);

  // ---------- 名字 + 1P/2P 标签（v61：Noto Sans SC，禁用纯白） ----------
  ctx.font = '700 9px ' + FONT.ui; ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5ccfff'; ctx.fillText('1P', 58, 26);
  ctx.fillStyle = '#f4ecdf'; ctx.fillText(p1.name, 78, 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f4ecdf'; ctx.fillText(p2.name, W - 78, 26);
  ctx.fillStyle = '#ff6b6b'; ctx.fillText('2P', W - 58, 26);

  // ---------- 中央计时器（六角牌） ----------
  const tleft = Number.isFinite(G.time) ? Math.ceil(G.time) : null;
  const ttxt = tleft === null ? '∞' : String(tleft).padStart(2, '0');
  ctx.fillStyle = '#14161f';
  ctx.beginPath();
  ctx.moveTo(W/2 - 26, 4); ctx.lineTo(W/2 + 26, 4); ctx.lineTo(W/2 + 32, 15);
  ctx.lineTo(W/2 + 26, 26); ctx.lineTo(W/2 - 26, 26); ctx.lineTo(W/2 - 32, 15);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c89a30'; ctx.lineWidth = 1; ctx.stroke();
  // v61：数字独立字体 Rajdhani；描边 ≈ 字号/9；禁用纯白纯黑
  ctx.font = '700 18px ' + FONT.num; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 2; ctx.strokeStyle = '#1f1a16';
  ctx.strokeText(ttxt, W / 2, 16);
  ctx.fillStyle = (tleft !== null && tleft <= 10) ? '#ff4b2e' : '#f4ecdf';
  ctx.fillText(ttxt, W / 2, 16);
  if (G.training) {
    ctx.font = '700 7px ' + FONT.num; ctx.fillStyle = '#5ccfff';
    ctx.fillText('TRAINING', W / 2, 32);
  }

  // ---------- 回合点（名字下方小菱形；v64 胜负标记 SF6 #11） ----------
  function pip(pxx, won, oc) {
    ctx.save(); ctx.translate(pxx, 41); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = won ? '#ffd83a' : '#2a2e3a';
    ctx.fillRect(-3.5, -3.5, 7, 7);
    if (won) { ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 1; ctx.strokeRect(-3.5, -3.5, 7, 7); }
    ctx.restore();
    // v64：KO=× / 超时=钟 / 必杀终结=星
    if (won && oc && oc.how) {
      ctx.save(); ctx.translate(pxx, 41);
      ctx.strokeStyle = '#1f1a16'; ctx.fillStyle = '#1f1a16'; ctx.lineWidth = 1.2;
      if (oc.how === 'ko') {
        ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(2, 2); ctx.moveTo(2, -2); ctx.lineTo(-2, 2); ctx.stroke();
      } else if (oc.how === 'timeout') {
        ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -1.6); ctx.moveTo(0, 0); ctx.lineTo(1.2, .6); ctx.stroke();
      } else if (oc.how === 'super') {
        ctx.beginPath();
        ctx.moveTo(0, -3); ctx.lineTo(.8, -.8); ctx.lineTo(3, 0); ctx.lineTo(.8, .8);
        ctx.lineTo(0, 3); ctx.lineTo(-.8, .8); ctx.lineTo(-3, 0); ctx.lineTo(-.8, -.8);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
  const oc1 = G.roundOutcomes.filter(o => o.win === 'p1');   // v64 按胜者取标记
  const oc2 = G.roundOutcomes.filter(o => o.win === 'p2');
  pip(64, G.wins.p1 >= 1, oc1[0]); pip(76, G.wins.p1 >= 2, oc1[1]);
  pip(W - 64, G.wins.p2 >= 1, oc2[0]); pip(W - 76, G.wins.p2 >= 2, oc2[1]);

  // ---------- 能量条（底部五段） ----------
  function meter(x, pct, flip) {
    const y = H - 14, w = 120, h = 8, segs = 5, gap = 2;
    const sw = (w - gap * (segs - 1)) / segs;
    const full = pct >= 1;
    const empty = pct <= 0.02;   // v62 能量条三态：满=亮光 / 半=常色 / 空=灰+闪烁警告（SF6 #2）
    ctx.fillStyle = '#14161f'; cutPanel(x - 2, y - 2, w + 4, h + 4, 3); ctx.fill();
    for (let i = 0; i < segs; i++) {
      const sx = flip ? x + w - (i + 1) * sw - i * gap : x + i * (sw + gap);
      const segPct = Math.min(1, Math.max(0, pct * segs - i));
      ctx.fillStyle = empty ? '#3a3f4a' : '#1e2a3a'; ctx.fillRect(sx, y, sw, h);
      if (segPct > 0 && !empty) {
        ctx.fillStyle = full ? '#7ae7ff' : '#3ecfff';   // v62 满槽更亮
        ctx.fillRect(sx, y, sw * segPct, h);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(sx, y, sw * segPct, 2);
      }
    }
    if (empty && Math.floor(gameTime * 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,90,60,.45)'; cutPanel(x - 2, y - 2, w + 4, h + 4, 3); ctx.fill();
    }
    if (full) {
      const pulse = .5 + .5 * Math.sin(gameTime * 8);
      ctx.fillStyle = 'rgba(255,216,58,' + (0.25 + 0.35 * pulse).toFixed(2) + ')';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.font = '700 8px ' + FONT.num; ctx.textAlign = flip ? 'right' : 'left'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffd83a';
      ctx.fillText('MAX', flip ? x + w : x, y - 3);
    }
  }
  meter(8, p1.meter / p1.maxMeter, false);
  meter(W - 8 - 120, p2.meter / p2.maxMeter, true);

  // ---------- 连击（侧边大字 + 缩放弹出） ----------
  if (G.comboShow >= 2 && G.comboT > 0) {
    const pop = 1 + 0.5 * Math.max(0, Math.min(1, (G.comboT - 0.9) / 0.3));
    const left = G.comboSide === 1;
    ctx.save();
    ctx.translate(left ? 14 : W - 14, 60); ctx.scale(pop, pop);
    ctx.font = '20px ' + FONT.disp;   // v61：展示字体（庆科黄油体无斜体，用正体）
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'top';
    ctx.lineWidth = 2; ctx.strokeStyle = '#5c0d00';
    const txt = G.comboShow + ' HITS';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = '#ffd83a'; ctx.fillText(txt, 0, 0);
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
  if (G.koSlow > 0) { G.koSlow -= rawDt; dt = rawDt * 0.2; } // v61：KO 慢动作 600ms
  if (G.counterSlow > 0) { G.counterSlow -= rawDt; dt = Math.min(dt, rawDt * 0.25); } // v62 Counter 慢动作 200ms
  if (G.critCine > 0) G.critCine -= rawDt;   // v62 绝杀电影化
  if (G.camPush > 0) G.camPush = Math.max(0, G.camPush - rawDt * 1.2);   // v62 镜头轻推衰减
  if (G.koFlash > 0) G.koFlash -= rawDt;
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
    if (G.koFx) G.koFx.t += rawDt;   // v64 KO 演出计时
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
      const pfx = p.owner.critSuper ? 'super' : null;   // v62 绝杀=橙红喷溅
      if (p.super) spawnSlash(fb.x + fb.w/2, fb.y + fb.h/2, Math.sign(p.vx), p.owner.critSuper ? 'super' : 'heavy');
      foe.takeHit(p.dmg, Math.sign(p.vx), 130, .45, p.owner, pfx);
      p.life = 0;
    }
  }
  G.projectiles = G.projectiles.filter(p => p.life > 0 && p.x > -20 && p.x < W + 20);

  // 粒子（v61 对象池复用）
  for (const pt of PPOOL) {
    if (!pt.on) continue;
    pt.t += rawDt; pt.x += pt.vx * rawDt; pt.y += pt.vy * rawDt; pt.vy += 300 * rawDt;
    if (pt.b && pt.y > GROUND - 3 && pt.vy > 0) { pt.y = GROUND - 3; pt.vy *= -.45; pt.vx *= .7; }   // v64 碎石地面弹跳
    if (pt.t >= pt.life) pt.on = false;
  }
  // v62 斩击弧 + 事件标签更新
  for (const s of slashes) s.t += rawDt;
  slashes = slashes.filter(s => s.t < s.life);
  for (const e of eventTags) e.t += rawDt;
  eventTags = eventTags.filter(e => e.t < e.life);
  for (const s of G.shouts) s.t += rawDt;   // v64 解说大字
  G.shouts = G.shouts.filter(s => s.t < s.life);
  for (const r of shockRings) r.t += rawDt;   // v64 冲击环
  shockRings = shockRings.filter(r => r.t < r.life);
  for (const n of hitNums) { n.t += rawDt; n.y += n.vy * rawDt; }
  hitNums = hitNums.filter(n => n.t < n.life);
  for (const q of tauntTexts) { q.t += rawDt; q.y += q.vy * rawDt; }
  tauntTexts = tauntTexts.filter(q => q.t < q.life);

  // 连击显示计时
  const lastCombo = Math.max(G.p1.combo, G.p2.combo);
  if (lastCombo >= 2) {
    if (lastCombo !== G.comboShow) { G.comboShow = lastCombo; G.comboT = 1.2; G.comboSide = G.p1.combo >= G.p2.combo ? 1 : 2; }
  }
  G.comboT -= rawDt;
  if (G.comboT <= 0) { G.comboShow = 0; G.p1.combo = 0; G.p2.combo = 0; G.p1.comboDmg = 0; G.p2.comboDmg = 0; }

  // v60 血条白条残影：缓慢追向实际血量
  if (G.p1 && G.p2) {
    const g1 = G.p1.hp / G.p1.maxHp, g2 = G.p2.hp / G.p2.maxHp;
    G.hudGhost1 += (g1 - G.hudGhost1) * 0.06;
    G.hudGhost2 += (g2 - G.hudGhost2) * 0.06;
    if (Math.abs(G.hudGhost1 - g1) < 0.004) G.hudGhost1 = g1;
    if (Math.abs(G.hudGhost2 - g2) < 0.004) G.hudGhost2 = g2;
    // 回血时残影不滞后
    if (G.hudGhost1 < g1) G.hudGhost1 = g1;
    if (G.hudGhost2 < g2) G.hudGhost2 = g2;
  }

  G.trauma = Math.max(0, G.trauma - rawDt * 2.5);   // v61 创伤衰减
  render(rawDt);
}

function drawTitleBG() {
  ctx.drawImage(sceneCanvas(), 0, 0);
  drawDustMotes();
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0,0,W,H);
}

// v60 黄昏尘埃（逐帧漂移，14 粒零分配；标题与战斗场景共用）
function drawDustMotes() {
  if (G.scene !== 'dusk') return;
  ctx.fillStyle = 'rgba(255,220,160,.45)';
  for (let i = 0; i < 14; i++) {
    const mx = (i * 97 + gameTime * (6 + (i % 3) * 4)) % (W + 20) - 10;
    const my = 60 + ((i * 53) % 140) + Math.sin(gameTime * 0.8 + i * 2.1) * 8;
    ctx.fillRect(mx | 0, my | 0, 2, 2);
  }
}

function render(dt) {
  ctx.save();
  // v61 创伤震屏：偏移 = trauma² × 10px，只抖渲染，逻辑坐标不动
  if (G.trauma > 0) {
    const s = G.trauma * G.trauma * 10;
    ctx.translate(rand(-s, s), rand(-s, s));
  }
  // v62 镜头轻推（Counter 1.06 / 绝杀推近）：只动渲染层，逻辑坐标不动
  if (G.camPush > 0 || G.critCine > 0) {
    let kp = 1;
    if (G.camPush > 0) kp += .06 * (G.camPush / .25);
    if (G.critCine > 0) kp += .06;
    ctx.translate(W/2, H/2); ctx.scale(kp, kp); ctx.translate(-W/2, -H/2);
  }
  // v64 KO 推近（GG #10）：白闪后以受害者为中心推到 1.3x，黑场前回正
  if (G.koFx && G.koFx.t > .05 && G.koFx.t < .9) {
    const ft = G.koFx.t;
    const zin = clamp((ft - .05) / .5, 0, 1);
    const zout = ft > .7 ? clamp((ft - .7) / .2, 0, 1) : 0;
    const z = 1 + .3 * zin * (1 - zout);
    if (z > 1.001) {
      ctx.translate(G.koFx.lx, G.koFx.ly); ctx.scale(z, z); ctx.translate(-G.koFx.lx, -G.koFx.ly);
    }
  }

  ctx.drawImage(sceneCanvas(), 0, 0);
  drawDustMotes();

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
        px(p.x - r+4, p.y - r+4, r, r, '#f4ecdf');
        // 拖尾
        px(p.x - Math.sign(p.vx)*r*2 - r/2, p.y - 3, r, 6, 'rgba(122,216,255,.4)');
      }
    }
    // 粒子（v62 形状语言：sq 方块 / shard 碎片三角 / tear 紫撕裂 / splat 喷溅）
    for (const pt of PPOOL) {
      if (!pt.on) continue;
      ctx.globalAlpha = 1 - pt.t / pt.life;
      if (pt.sh === 'shard') {
        ctx.fillStyle = pt.c;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - pt.s); ctx.lineTo(pt.x + pt.s, pt.y + pt.s); ctx.lineTo(pt.x - pt.s, pt.y + pt.s);
        ctx.closePath(); ctx.fill();
      } else if (pt.sh === 'tear') {
        px(pt.x - 1, pt.y - pt.s * 1.6, 2, Math.round(pt.s * 3.2), pt.c);
      } else {
        px(pt.x, pt.y, pt.s, pt.s, pt.c);
      }
      ctx.globalAlpha = 1;
    }
    // v62 三层斩击弧：粗主弧定方向 + 细次弧支撑（中心近白高亮刃、外缘招式色）
    for (const s of slashes) {
      const k = s.t / s.life, a = 1 - k, r = s.r * (1 + k * .35);
      const a0 = s.dir > 0 ? -1.15 : Math.PI - 1.15, a1 = s.dir > 0 ? 1.15 : Math.PI + 1.15;
      ctx.globalAlpha = a;
      ctx.lineWidth = s.w; ctx.strokeStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, a0, a1); ctx.stroke();
      ctx.lineWidth = Math.max(1.5, s.w * .4); ctx.strokeStyle = s.inner;
      ctx.beginPath(); ctx.arc(s.x, s.y, r * .72, a0, a1); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // v64 KO 冲击环
    for (const r of shockRings) {
      const k = r.t / r.life, rr = 12 + k * 120;
      ctx.globalAlpha = (1 - k) * .8;
      ctx.lineWidth = 4 * (1 - k) + 1; ctx.strokeStyle = '#fff3d0';
      ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // v62 事件标签：屏侧大字弹出（庆科黄油体），与伤害数字分通道（SF6 #3）
    for (const e of eventTags) {
      const k = e.t / e.life;
      const pop = e.t < .15 ? 1.35 - (e.t / .15) * .35 : 1;
      ctx.save();
      ctx.translate(e.side === 1 ? 120 : W - 120, 112); ctx.scale(pop, pop);
      ctx.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
      ctx.font = '26px ' + FONT.disp; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = '#1f1a16'; ctx.strokeText(e.txt, 0, 0);
      ctx.fillStyle = e.color; ctx.fillText(e.txt, 0, 0);
      ctx.restore();
    }
    // v64 解说层（SF6 #14）：中央大字播报，比事件标签更大
    for (const s of G.shouts) {
      const k = s.t / s.life;
      const pop = s.t < .2 ? 1.5 - (s.t / .2) * .5 : 1;
      ctx.save();
      ctx.translate(W / 2, 96 + (s.dy || 0)); ctx.scale(pop, pop);
      ctx.globalAlpha = k < .75 ? 1 : 1 - (k - .75) / .25;
      ctx.font = '34px ' + FONT.disp; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = '#1f1a16'; ctx.strokeText(s.txt, 0, 0);
      ctx.fillStyle = s.color; ctx.fillText(s.txt, 0, 0);
      ctx.restore();
    }
    // v62 绝杀电影化：黑边 + 暗角（SF6 Critical Art 配方）；HUD 画在上层保持可读
    if (G.critCine > 0) {
      ctx.fillStyle = 'rgba(8,4,10,.92)';
      ctx.fillRect(0, 0, W, 20); ctx.fillRect(0, H - 20, W, 20);
      const cg = ctx.createRadialGradient(W/2, H/2, 40, W/2, H/2, 175);
      cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(8,4,10,.45)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
    }
    // 浮动伤害 / 格挡提示（v61：Rajdhani 数字字体）
    ctx.save();
    ctx.font = '700 10px ' + FONT.num; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of hitNums) {
      ctx.globalAlpha = Math.max(0, 1 - n.t / n.life);
      ctx.strokeStyle = '#1f1a16'; ctx.lineWidth = 2;
      ctx.strokeText(n.txt, n.x, n.y);
      ctx.fillStyle = n.color; ctx.fillText(n.txt, n.x, n.y);
    }
    // 胜利台词（v61：Noto Sans SC）
    ctx.font = '700 11px ' + FONT.ui;
    for (const q of tauntTexts) {
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
      ctx.strokeStyle = '#17131d'; ctx.lineWidth = 3;
      ctx.strokeText(q.txt, q.x, q.y);
      ctx.fillStyle = q.color; ctx.fillText(q.txt, q.x, q.y);
    }
    ctx.restore();
    drawHUD();
  }

  // 回合标识与倒计时提示（v61：Noto Sans SC，禁用纯白）
  ctx.font = '700 8px ' + FONT.ui; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#f4ecdf';
  ctx.fillText('ROUND ' + G.round + (G.mode === 'arcade' ? ' · STAGE ' + G.arcade.stage + (G.arcade.boss ? ' FINAL' : '/5') : (G.mode === 'endless' ? ' · WAVE ' + G.arcade.stage : '')), W / 2, 32);
  if ((G.mode === 'arcade' || G.mode === 'endless') && G.state !== 'intro') {
    ctx.fillStyle = '#9fd4ff';
    ctx.fillText('SCORE ' + G.arcade.score + ' · BEST ' + G.arcade.best, W / 2, 44);
  }
  if (G.state === 'intro') {
    const introText = G.introT < .7 ? 'READY' : 'FIGHT!';
    ctx.font = '24px ' + FONT.disp;   // v61：展示字体
    ctx.strokeStyle = '#5c0d00'; ctx.lineWidth = 3; ctx.strokeText(introText, W / 2, 85);
    ctx.fillStyle = G.introT < .7 ? '#ffe95c' : '#ff6b2e';
    ctx.fillText(introText, W / 2, 85);
  }
  if (G.state === 'timeup') {
    ctx.font = '700 20px ' + FONT.num; ctx.strokeStyle = '#24344a'; ctx.lineWidth = 2;
    ctx.strokeText('TIME UP', W / 2, 90); ctx.fillStyle = '#f4ecdf'; ctx.fillText('TIME UP', W / 2, 90);
  }

  // VS 对决面板
  if (G.state === 'vs') { drawBigPortrait(W * 0.18, 60, G.p1.type); drawBigPortrait(W * 0.82, 60, G.p2.type); drawVS(); }

  // KO 大字（v60：3x 缩放回弹 + 白描边 + 投影；v61：展示字体 + KO 剪影闪；v64：白闪→推近→黑场→K.O.）
  if (G.state === 'ko' || G.state === 'training-ko') {
    // v61：终结剪影闪 1-2 帧（属性色全屏，只用在终结点）
    if (G.koFlash > 0) { ctx.fillStyle = 'rgba(255,46,30,.28)'; ctx.fillRect(0, 0, W, H); }
    // v64 KO 终结演出（GG #10）：白闪 2-3 帧 → 黑场
    if (G.koFx) {
      const ft = G.koFx.t;
      if (ft < .08) {
        ctx.fillStyle = 'rgba(244,236,223,' + (0.95 * (1 - ft / .08)).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      } else if (ft >= .55 && ft < .9) {
        const bk = ft < .7 ? (ft - .55) / .15 : 1 - (ft - .7) / .2;
        ctx.fillStyle = 'rgba(8,4,10,' + (0.88 * Math.max(0, bk)).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (G.koFx && G.koFx.t < .85) { /* K.O. 大字等黑场后登场 */ }
    else {
    const t = Math.min(1, (G.koFx ? Math.max(0, G.koFx.t - .85) : G.koTimer) * 3);
    const bk = 1.70158; // easeOutBack
    const s = 1 + (bk + 1) * Math.pow(t - 1, 3) + bk * Math.pow(t - 1, 2);
    const scale = 3 - 2 * s;
    ctx.save();
    ctx.translate(W/2, H/2 - 20);
    ctx.scale(scale, scale);
    ctx.font = '56px ' + FONT.disp; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowOffsetY = 4;
    ctx.lineWidth = 10; ctx.strokeStyle = '#f4ecdf'; ctx.strokeText('K.O.', 0, 0);
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 4; ctx.strokeStyle = '#5c0d00'; ctx.strokeText('K.O.', 0, 0);
    ctx.fillStyle = '#ff2e1e'; ctx.fillText('K.O.', 0, 0);
    ctx.restore();
    }   // v64 else: K.O. 大字等黑场后
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
tapDrive(document.getElementById('btn-endless'), () => {
  document.getElementById('title').classList.add('hidden');
  startMatch('endless');
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
// v65：可选角色=4 名有精灵者；ROSTER 仍供街机 AI 池
const PLAYABLE = ['fighter', 'blob', 'huntress', 'wizard'];
function selectCharacter(type) {
  if (!PLAYABLE.includes(type)) type = 'fighter';
  G.playerType = type;
  PLAYABLE.forEach(k =>
    document.getElementById('char-' + k).classList.toggle('selected', k === type));
  saveSettings();
}
tapDrive(document.getElementById('char-fighter'), () => selectCharacter('fighter'));
tapDrive(document.getElementById('char-blob'), () => selectCharacter('blob'));
tapDrive(document.getElementById('char-huntress'), () => selectCharacter('huntress'));
tapDrive(document.getElementById('char-wizard'), () => selectCharacter('wizard'));
tapDrive(document.getElementById('char-random'), () => selectCharacter(PLAYABLE[Math.floor(Math.random()*PLAYABLE.length)]));

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