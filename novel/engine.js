// ===== 星海彼岸 — 游戏引擎 =====
'use strict';

const Engine = (() => {
  // ====== 状态 ======
  let state = {
    currentNode: 'opening',
    flags: {},       // 好感度: { luna: 0, kai: 0, iris: 0 }
    history: [],     // 已访问节点列表
    visited: new Set(),
    textIndex: 0,    // 打字机进度
    isTyping: false,
    isTransitioning: false,
    choicesShown: false,
    skipNextClick: false
  };

  // ====== DOM 引用 ======
  const DOM = {};
  let initialized = false;

  function initDOM() {
    if (initialized) return;
    const ids = ['bg-layer','char-left','char-center','char-right','fx-layer',
      'title-screen','dialogue-box','speaker-name','dialogue-text','click-hint',
      'choice-box','choices','ending-screen','ending-title','ending-desc',
      'hud','flag-display','save-screen','save-slots','menu-overlay',
      'btn-new-game','btn-continue','btn-load-menu','btn-close-save','btn-hidden',
      'btn-back-title','btn-save','btn-menu','btn-save-slot','btn-load-slot',
      'btn-return-title','btn-resume','btn-return-title'];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
    if (!DOM['btn-resume'] && DOM['btn-return-title']) {
      // fallback
    }
    initialized = true;
  }

  // ====== 工具函数 ======
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  // ====== 存档 ======
  const SAVE_KEY = 'starrysea_saves';

  function getSaves() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch(e) { return {}; }
  }

  function setSaves(saves) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  function saveGame(slot) {
    const saves = getSaves();
    const data = {
      node: state.currentNode,
      flags: {...state.flags},
      history: [...state.history],
      time: new Date().toLocaleString('zh-CN'),
      scene: getCurrentNode().bg || 'unknown'
    };
    saves[slot] = data;
    setSaves(saves);
    renderSaveSlots(slot);
    return data;
  }

  function loadGame(slot) {
    const saves = getSaves();
    const data = saves[slot];
    if (!data) return false;
    state.currentNode = data.node;
    state.flags = {...data.flags};
    state.history = [...data.history];
    state.visited = new Set(state.history);
    state.choicesShown = false;
    state.isTyping = false;
    closeAllOverlays();
    renderScene();
    return true;
  }

  function deleteSave(slot) {
    const saves = getSaves();
    delete saves[slot];
    setSaves(saves);
    renderSaveSlots();
  }

  function renderSaveSlots(highlightSlot) {
    const saves = getSaves();
    const container = DOM['save-slots'];
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'save-slot';
      if (saves[i]) {
        const d = saves[i];
        slot.innerHTML = `<strong>第 ${i} 格</strong><span class="slot-time">${d.time}</span><span class="slot-time">节点: ${getNodeTitle(d.node)}</span>`;
        slot.dataset.filled = '1';
      } else {
        slot.className += ' empty';
        slot.innerHTML = `<strong>第 ${i} 格</strong> — 空`;
      }
      if (highlightSlot === i) slot.style.borderColor = '#7ec8ff';
      slot.addEventListener('click', () => {
        if (slot.dataset.filled) {
          if (confirm(`读取第 ${i} 格的存档？`)) loadGame(i);
        }
      });
      container.appendChild(slot);
    }
  }

  function getNodeTitle(nodeId) {
    const node = STORY.nodes[nodeId];
    if (!node) return nodeId;
    if (node.speaker) return STORY.characters[node.speaker]?.name || nodeId;
    if (node.ending) return node.ending.title;
    return nodeId;
  }

  // ====== 场景渲染 ======
  function getCurrentNode() {
    return STORY.nodes[state.currentNode] || STORY.nodes.opening;
  }

  function renderScene() {
    const node = getCurrentNode();
    if (!node) return;

    // 背景
    if (node.bg && STORY.scenes.bg[node.bg]) {
      DOM['bg-layer'].style.background = STORY.scenes.bg[node.bg];
    }

    // 角色立绘
    renderCharacters(node.char);

    // 对话
    if (node.text) {
      showDialogue(node);
    } else {
      hideDialogue();
    }

    // 选项
    if (node.choices && node.choices.length > 0) {
      showChoices(node.choices);
    } else {
      hideChoices();
    }

    // 结局
    if (node.ending) {
      showEnding(node.ending);
    }

    // 更新好感度显示
    updateFlagDisplay();

    // 流式特殊效果
    if (node.fx) {
      applyFX(node.fx);
    }
  }

  function renderCharacters(charConfig) {
    // 清空所有角色槽
    ['char-left', 'char-center', 'char-right'].forEach(slot => {
      DOM[slot].classList.add('hidden');
      DOM[slot].innerHTML = '';
    });

    if (!charConfig) return;

    const positions = ['left', 'center', 'right'];
    positions.forEach(pos => {
      const charId = charConfig[pos];
      if (!charId || !STORY.characters[charId]) return;
      const char = STORY.characters[charId];
      const slot = DOM['char-' + pos];
      slot.classList.remove('hidden', 'speaking', 'muted');

      // 构建立绘
      const art = document.createElement('div');
      art.className = 'char-art';

      // 影子
      const shadow = document.createElement('div');
      shadow.className = 'char-shadow';
      art.appendChild(shadow);

      // 身体（衣服）
      const dress = document.createElement('div');
      dress.className = 'char-dress';
      dress.style.background = char.dress;
      dress.textContent = char.initial;

      // 头部
      const head = document.createElement('div');
      head.className = 'char-head';

      // 头发
      const hair = document.createElement('div');
      hair.className = 'char-hair ' + (char.hairStyle || 'long');
      hair.style.background = char.hair;
      head.appendChild(hair);

      // 眼睛
      const eyes = document.createElement('div');
      eyes.className = 'char-eyes';
      eyes.innerHTML = '<div class="eye" style="background:' + char.eyes + '"></div><div class="eye" style="background:' + char.eyes + '"></div>';
      head.appendChild(eyes);

      // 嘴
      const mouth = document.createElement('div');
      mouth.className = 'char-mouth smile';
      const emotion = charConfig[pos + '_emotion'];
      if (emotion) mouth.className = 'char-mouth ' + mapEmotion(emotion);
      head.appendChild(mouth);

      art.appendChild(head);
      art.appendChild(dress);

      slot.innerHTML = '';
      slot.appendChild(art);

      // 标记说话角色
      if (nodeHasSpeaker(charId)) {
        slot.classList.add('speaking');
      } else {
        slot.classList.add('muted');
      }
    });
  }

  function mapEmotion(emotion) {
    const map = { happy: 'smile', sad: 'sad', open: 'open', angry: 'angry', neutral: '' };
    return map[emotion] || '';
  }

  function nodeHasSpeaker(charId) {
    const node = getCurrentNode();
    return node.speaker === charId;
  }

  // ====== 对话系统 ======
  let typewriterTimer = null;

  function showDialogue(node) {
    const box = DOM['dialogue-box'];
    box.classList.remove('hidden');

    // 说话者
    const nameEl = DOM['speaker-name'];
    if (node.speaker && STORY.characters[node.speaker]) {
      nameEl.textContent = STORY.characters[node.speaker].name;
      nameEl.style.display = 'inline-block';
    } else {
      nameEl.style.display = 'none';
    }

    // 文字（打字机效果）
    const textEl = DOM['dialogue-text'];
    const fullText = node.text;
    textEl.textContent = '';
    textEl.dataset.full = fullText;

    state.isTyping = true;
    state.textIndex = 0;

    if (typewriterTimer) clearInterval(typewriterTimer);
    let i = 0;
    const speed = 28; // ms per char
    typewriterTimer = setInterval(() => {
      if (i >= fullText.length) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
        state.isTyping = false;
        DOM['click-hint'].classList.remove('hidden');
        return;
      }
      // 标点符号处稍停
      let step = 1;
      const ch = fullText[i];
      if (ch === '。' || ch === '？' || ch === '！' || ch === '……') step = 2;
      else if (ch === '\n') step = 1;
      i += step;
      textEl.textContent = fullText.substring(0, i);
      state.textIndex = i;
    }, speed);

    DOM['click-hint'].classList.add('hidden');
  }

  function hideDialogue() {
    DOM['dialogue-box'].classList.add('hidden');
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    state.isTyping = false;
  }

  function skipTyping() {
    if (!state.isTyping) return;
    const textEl = DOM['dialogue-text'];
    const full = textEl.dataset.full || '';
    textEl.textContent = full;
    state.textIndex = full.length;
    state.isTyping = false;
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    DOM['click-hint'].classList.remove('hidden');
  }

  // ====== 选项系统 ======
  function showChoices(choices) {
    const box = DOM['choice-box'];
    box.classList.remove('hidden');
    const container = DOM['choices'];
    container.innerHTML = '';
    state.choicesShown = true;

    choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      // 检查是否满足条件
      if (choice.condition) {
        const ok = evaluateCondition(choice.condition);
        if (!ok) btn.style.display = 'none';
      }
      btn.textContent = choice.text;
      btn.addEventListener('click', () => {
        if (state.isTransitioning) return;
        state.isTransitioning = true;
        // 应用好感度效果
        if (choice.effect) {
          for (const [char, delta] of Object.entries(choice.effect)) {
            state.flags[char] = (state.flags[char] || 0) + delta;
          }
        }
        // 加隐藏结局触发检查
        if (checkHiddenEnding(choice.next)) return;
        goToNode(choice.next);
      });
      container.appendChild(btn);
    });

    hideDialogue();
    DOM['click-hint'].classList.add('hidden');
  }

  function hideChoices() {
    DOM['choice-box'].classList.add('hidden');
    DOM['choices'].innerHTML = '';
    state.choicesShown = false;
  }

  function evaluateCondition(cond) {
    // 简单条件格式: { flag: 'luna', op: '>=', val: 3 }
    const val = state.flags[cond.flag] || 0;
    switch (cond.op) {
      case '>=': return val >= cond.val;
      case '>':  return val > cond.val;
      case '==': return val === cond.val;
      case '<':  return val < cond.val;
      default:   return true;
    }
  }

  // ====== 节点跳转 ======
  function goToNode(nodeId) {
    if (!STORY.nodes[nodeId]) {
      console.error('Node not found:', nodeId);
      return;
    }
    state.history.push(state.currentNode);
    state.visited.add(state.currentNode);
    state.currentNode = nodeId;
    state.choicesShown = false;
    state.isTransitioning = false;
    hideChoices();
    // 加淡入效果
    DOM['bg-layer'].style.transition = 'opacity 0.35s';
    DOM['bg-layer'].style.opacity = '0.85';
    setTimeout(() => {
      DOM['bg-layer'].style.opacity = '1';
      renderScene();
    }, 200);
  }

  // ====== 隐藏结局 ======
  let hiddenAttempts = 0;

  function checkHiddenEnding(nextNode) {
    // 在所有角色路线都走完后，在特定节点触发
    const node = getCurrentNode();
    // 如果当前节点是 ending 后的返回节点，且好感度总和达标
    const totalAffection = Object.values(state.flags).reduce((a,b)=>a+b, 0);
    if (state.history.length >= 15 && totalAffection >= 0 && Math.random() < 0.05) {
      // 5% 概率触发隐藏结局
      // 实际触发：在标题画面选择"继续故事"时检测
      return false;
    }
    return false;
  }

  function tryUnlockHidden() {
    // 从标题画面检测是否解锁隐藏结局
    const saves = getSaves();
    const auto = saves[0];
    if (!auto || !auto.flags) return false;
    const flags = auto.flags;
    if (!flags._ended) return false;               // 必须至少完成过一个结局
    const totalAffection = ['luna','kai','iris']
      .reduce((a,k) => a + (flags[k] || 0), 0);
    const nodeCount = new Set(auto.history || []).size;
    return totalAffection >= 8 && nodeCount >= 10;
  }

  // ====== 结局 ======
  function showEnding(ending) {
    DOM['bg-layer'].style.filter = 'brightness(0.6)';
    // 隐藏所有 UI
    hideDialogue();
    hideChoices();
    DOM['hud'].classList.add('hidden');
    DOM['flag-display'].classList.add('hidden');

    const screen = DOM['ending-screen'];
    screen.classList.remove('hidden');
    DOM['ending-title'].textContent = ending.title;
    DOM['ending-desc'].textContent = ending.desc;

    // 记录结局
    state.flags._ending = ending.id;
    state.flags._ended = true;

    // 自动保存
    saveGame(0); // 自动存档用槽0
  }

  // ====== 好感度显示 ======
  function updateFlagDisplay() {
    const el = DOM['flag-display'];
    const names = { luna: '晓月', kai: '海', iris: '小晴' };
    const parts = [];
    for (const [char, val] of Object.entries(state.flags)) {
      if (char.startsWith('_')) continue;
      if (names[char] && val) {
        parts.push(names[char] + ' ' + '♥'.repeat(Math.min(val, 5)));
      }
    }
    if (parts.length > 0) {
      el.textContent = parts.join(' | ');
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // ====== 特效 ======
  function applyFX(fx) {
    if (fx === 'rain') {
      startRain();
    } else if (fx === 'flash') {
      flashScreen();
    } else if (fx === 'stars') {
      startStars();
    }
  }

  function startRain() {
    const layer = DOM['fx-layer'];
    layer.innerHTML = '';
    for (let i = 0; i < 30; i++) {
      const drop = document.createElement('div');
      drop.className = 'fx-rain';
      drop.textContent = '|';
      drop.style.left = Math.random() * 100 + '%';
      drop.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';
      drop.style.animationDelay = Math.random() * 2 + 's';
      drop.style.fontSize = (0.8 + Math.random() * 0.6) + 'rem';
      layer.appendChild(drop);
    }
  }

  function flashScreen() {
    const flash = document.createElement('div');
    flash.className = 'fx-flash';
    DOM['fx-layer'].appendChild(flash);
    setTimeout(() => flash.remove(), 500);
  }

  function startStars() {
    const layer = DOM['fx-layer'];
    layer.innerHTML = '';
    for (let i = 0; i < 50; i++) {
      const star = document.createElement('div');
      star.style.cssText = `position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;
        top:${Math.random()*70}%;left:${Math.random()*100}%;
        animation:twinkle ${1+Math.random()*2}s ease-in-out infinite alternate;
        animation-delay:${Math.random()*2}s`;
      layer.appendChild(star);
    }
    // 加入 twinkle 动画
    if (!document.getElementById('star-style')) {
      const style = document.createElement('style');
      style.id = 'star-style';
      style.textContent = '@keyframes twinkle { from { opacity: 0.2; } to { opacity: 1; } }';
      document.head.appendChild(style);
    }
  }

  // ====== 覆盖层管理 ======
  function closeAllOverlays() {
    DOM['title-screen'].classList.add('hidden');
    DOM['save-screen'].classList.add('hidden');
    DOM['menu-overlay'].classList.add('hidden');
    DOM['ending-screen'].classList.add('hidden');
    DOM['bg-layer'].style.filter = 'none';
  }

  function showTitle() {
    saveGame(0); // 自动存档
    closeAllOverlays();
    DOM['title-screen'].classList.remove('hidden');
    hideDialogue();
    hideChoices();
    DOM['hud'].classList.add('hidden');
    DOM['flag-display'].classList.add('hidden');
    DOM['bg-layer'].style.background = STORY.scenes.bg.starry;
    DOM['bg-layer'].style.filter = 'none';
    state.currentNode = 'opening';
    // 检查是否有继续游戏的存档
    checkContinue();
  }

  function checkContinue() {
    const saves = getSaves();
    if (saves[0] && saves[0].node && saves[0].node !== 'opening') {
      DOM['btn-continue'].classList.remove('hidden');
    } else {
      DOM['btn-continue'].classList.add('hidden');
    }
    // 隐藏结局解锁：完成过至少一个结局 且 好感度总和 >= 8
    if (tryUnlockHidden()) {
      DOM['btn-hidden'].classList.remove('hidden');
      // 确保按钮已绑定（只绑一次）
      if (!DOM['btn-hidden'].dataset.bound) {
        DOM['btn-hidden'].dataset.bound = '1';
        DOM['btn-hidden'].addEventListener('click', () => {
          closeAllOverlays();
          DOM['hud'].classList.remove('hidden');
          goToNode('hidden_ending');
        });
      }
    } else {
      DOM['btn-hidden'].classList.add('hidden');
    }
  }

  function continueGame() {
    const saves = getSaves();
    if (saves[0]) {
      loadGame(0);
      closeAllOverlays();
      DOM['hud'].classList.remove('hidden');
      renderScene();
    }
  }

  function startNewGame() {
    state = {
      currentNode: 'opening',
      flags: {},
      history: [],
      visited: new Set(),
      textIndex: 0,
      isTyping: false,
      isTransitioning: false,
      choicesShown: false,
      skipNextClick: false
    };
    closeAllOverlays();
    DOM['hud'].classList.remove('hidden');
    DOM['flag-display'].classList.remove('hidden');
    renderScene();
  }

  // ====== 点击推进 ======
  function handleClick() {
    const node = getCurrentNode();
    if (state.choicesShown) return;
    if (state.isTyping) {
      skipTyping();
      return;
    }
    // 有结局时不跳转
    if (node.ending) return;
    // 有选项时不跳转（已在 choicesShown 处理）
    if (node.choices && node.choices.length > 0) return;
    // 有 next 则跳转
    if (node.next) {
      goToNode(node.next);
    }
  }

  // ====== 键盘支持 ======
  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleClick();
    }
    if (e.key === 'Escape') {
      if (!DOM['menu-overlay'].classList.contains('hidden')) {
        DOM['menu-overlay'].classList.add('hidden');
      } else if (DOM['save-screen'].classList.contains('hidden')) {
        DOM['menu-overlay'].classList.remove('hidden');
      }
    }
    // 数字键选选项
    if (e.key >= '1' && e.key <= '9') {
      const buttons = DOM['choices'].querySelectorAll('.choice-btn');
      const idx = parseInt(e.key) - 1;
      if (buttons[idx]) buttons[idx].click();
    }
  }

  // ====== 初始化 ======
  function init() {
    initDOM();

    // 标题按钮
    DOM['btn-new-game'].addEventListener('click', startNewGame);
    DOM['btn-continue'].addEventListener('click', continueGame);
    DOM['btn-load-menu'].addEventListener('click', () => {
      DOM['save-screen'].classList.remove('hidden');
      renderSaveSlots();
    });
    DOM['btn-close-save'].addEventListener('click', () => {
      DOM['save-screen'].classList.add('hidden');
    });

    // 结局返回
    DOM['btn-back-title'].addEventListener('click', showTitle);

    // 游戏内 HUD
    DOM['btn-save'].addEventListener('click', () => {
      DOM['menu-overlay'].classList.add('hidden');
      DOM['save-screen'].classList.remove('hidden');
      renderSaveSlots();
    });
    DOM['btn-menu'].addEventListener('click', () => {
      DOM['menu-overlay'].classList.remove('hidden');
    });

    // 菜单
    DOM['btn-save-slot'].addEventListener('click', () => {
      DOM['menu-overlay'].classList.add('hidden');
      DOM['save-screen'].classList.remove('hidden');
      renderSaveSlots();
    });
    DOM['btn-load-slot'].addEventListener('click', () => {
      DOM['menu-overlay'].classList.add('hidden');
      DOM['save-screen'].classList.remove('hidden');
      renderSaveSlots();
    });
    DOM['btn-return-title'].addEventListener('click', showTitle);
    DOM['btn-resume'].addEventListener('click', () => {
      DOM['menu-overlay'].classList.add('hidden');
    });

    // 点击对话
    DOM['dialogue-box'].addEventListener('click', handleClick);

    // 键盘
    document.addEventListener('keydown', handleKey);

    // 触摸滑动推进
    let touchStartY = 0;
    document.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; });
    document.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) < 20) { // 点击而非滑动
        const target = e.target;
        if (target.closest('#dialogue-box') || target.closest('#game') && !target.closest('.choice-btn') && !target.closest('#hud') && !target.closest('.overlay')) {
          handleClick();
        }
      }
    });

    // 显示标题
    showTitle();
    // 初始场景背景
    DOM['bg-layer'].style.background = STORY.scenes.bg.starry;
    startStars();
  }

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    goTo: goToNode,
    save: saveGame,
    load: loadGame,
    getState: () => ({...state, flags: {...state.flags}}),
    showTitle: showTitle,
    startNewGame: startNewGame
  };
})();