(() => {
  'use strict';

  const W = 450, H = 800, PLAY_LEFT = 18, PLAY_RIGHT = W - 18, PLAY_TOP = 78, GATE_Y = 740, GRAVITY = 560, SUBSTEPS = 2;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const pinchOverlay = document.getElementById('pinchOverlay');
  const touchHud = document.getElementById('touchHud');
  const leftTouchHint = document.getElementById('leftTouchHint');
  const rightTouchHint = document.getElementById('rightTouchHint');

  const hudHpText = document.getElementById('hudHpText');
  const hudHpBar = document.getElementById('hudHpBar');
  const hudTime = document.getElementById('hudTime');
  const hudMeta = document.getElementById('hudMeta');
  const hudCombo = document.getElementById('hudCombo');
  const hudComboHits = document.getElementById('hudComboHits');
  const comboBox = document.getElementById('comboBox');
  const hudXpBar = document.getElementById('hudXpBar');
  const hudTiltText = document.getElementById('hudTiltText');
  const buildStrip = document.getElementById('buildStrip');

  const overlayStart = document.getElementById('overlayStart');
  const overlayLevelUp = document.getElementById('overlayLevelUp');
  const overlayPause = document.getElementById('overlayPause');
  const overlayEnd = document.getElementById('overlayEnd');
  const upgradeList = document.getElementById('upgradeList');
  const levelUpBadge = document.getElementById('levelUpBadge');

  const btnStart = document.getElementById('btnStart');
  const btnMute = document.getElementById('btnMute');
  const btnPause = document.getElementById('btnPause');
  const btnResume = document.getElementById('btnResume');
  const btnRestartFromPause = document.getElementById('btnRestartFromPause');
  const btnPlayAgain = document.getElementById('btnPlayAgain');
  const btnNudge = document.getElementById('btnNudge');

  class ArcadeAudio {
    constructor() {
      this.ctx = null; this.muted = false;
      this.scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0, 880.0, 1046.5];
    }
    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    }
    toggleMute() { this.muted = !this.muted; return this.muted; }
    tone(freq, dur, type = 'triangle', vol = 0.09, slideTo = null) {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now); gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + dur + 0.01);
    }
    flipper() { this.tone(190, 0.055, 'square', 0.07, 460); }
    crit() { this.tone(540, 0.14, 'sawtooth', 0.12, 1360); this.tone(880, 0.18, 'triangle', 0.09, 1760); }
    bumper() { this.tone(250, 0.085, 'sine', 0.11, 660); }
    hit(c) { const f = this.scale[Math.min(this.scale.length - 1, Math.floor(c / 3))]; this.tone(f, 0.06, 'triangle', 0.075, f * 1.18); }
    kill(c) { const f = this.scale[Math.min(this.scale.length - 1, Math.floor(c / 2))]; this.tone(f * 1.5, 0.1, 'sine', 0.09, f * 2.15); }
    zap() { this.tone(940, 0.07, 'sawtooth', 0.055, 290); }
    nudge() { this.tone(130, 0.14, 'sawtooth', 0.12, 46); }
    hurt() { this.tone(145, 0.22, 'sawtooth', 0.14, 48); }
    levelUp() { [523.3, 659.3, 784.0, 1046.5].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'triangle', 0.1), i * 60)); }
    evolve() { [440, 554.4, 659.3, 880, 1108.7, 1318.5].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.095), i * 50)); }
  }
  const audio = new ArcadeAudio();

  const UPGRADES = [
    { id: 'plasma', icon: '🔥', name: 'プラズマ球', evoName: 'ソーラーフレア', color: '#ff2a7f', maxLv: 4, type: 'ball',
      desc: (lv) => lv === 0 ? '着弾爆発＋炎上ボールを追加' : lv >= 3 ? '★進化：巨大貫通太陽球で広範囲焼却！' : `爆発ダメージ＆範囲UP (Lv.${lv + 1})` },
    { id: 'lightning', icon: '⚡', name: 'ライトニング球', evoName: 'テスラ・ストーム', color: '#00eaff', maxLv: 4, type: 'ball',
      desc: (lv) => lv === 0 ? '周囲3体へ連鎖電撃ボールを追加' : lv >= 3 ? '★進化：6体同時連鎖＋高速バウンド！' : `連鎖数＆電撃火力UP (Lv.${lv + 1})` },
    { id: 'prism', icon: '✦', name: 'プリズム球', evoName: 'カレイド・スウォーム', color: '#f8fafc', maxLv: 4, type: 'ball',
      desc: (lv) => lv === 0 ? '跳弾でミニボール分裂する弾幕球を追加' : lv >= 3 ? '★進化：3回跳弾で大量分裂弾幕！' : `分裂スピード＆火力UP (Lv.${lv + 1})` },
    { id: 'gravity', icon: '◎', name: 'グラビティ球', evoName: 'イベントホライズン', color: '#c084fc', maxLv: 4, type: 'ball',
      desc: (lv) => lv === 0 ? '敵とXPを吸い寄せる重力球を追加' : lv >= 3 ? '★進化：ブラックホール圧殺＆広域XP回収！' : `吸引範囲＆圧殺ダメージUP (Lv.${lv + 1})` },
    { id: 'bumper', icon: '◉', name: 'パルスバンパー', evoName: '共鳴アレイ', color: '#38bdf8', maxLv: 4, type: 'gimmick',
      desc: (lv) => lv === 0 ? 'バンパー衝突で衝撃波＆1基増設' : lv >= 3 ? '★進化：5基すべてが連動起爆！' : `衝撃波拡大＆バンパー増設 (Lv.${lv + 1})` },
    { id: 'spinner', icon: '⟰', name: 'レールガンゲート', evoName: '極太貫通レーザー', color: '#ffd43b', maxLv: 4, type: 'gimmick',
      desc: (lv) => lv === 0 ? '中央通過で上方向へ貫通ビーム発射' : lv >= 3 ? '★進化：3連極太レーザーでボス瞬殺！' : `発射数＆レーザー火力UP (Lv.${lv + 1})` },
    { id: 'multiball', icon: '+●', name: 'マルチローダー', evoName: null, color: '#fb7185', maxLv: 4, type: 'passive',
      desc: (lv) => `メインボール+1球＆全威力+15% (Lv.${lv + 1})` },
    { id: 'overclock', icon: '★', name: 'オーバードライブ', evoName: null, color: '#34d399', maxLv: 4, type: 'passive',
      desc: (lv) => `強打クリティカル倍率UP＆HP30回復 (Lv.${lv + 1})` }
  ];

  const WALL_SEGMENTS = [
    { x1: PLAY_LEFT, y1: 146, x2: PLAY_LEFT, y2: 598 },
    { x1: PLAY_RIGHT, y1: 146, x2: PLAY_RIGHT, y2: 598 },
    { x1: PLAY_LEFT, y1: 146, x2: 92, y2: PLAY_TOP },
    { x1: 92, y1: PLAY_TOP, x2: W - 92, y2: PLAY_TOP },
    { x1: W - 92, y1: PLAY_TOP, x2: PLAY_RIGHT, y2: 146 },
    { x1: PLAY_LEFT, y1: 598, x2: 118, y2: 688 },
    { x1: PLAY_RIGHT, y1: 598, x2: W - 118, y2: 688 }
  ];

  const SLINGSHOTS = [
    { x1: 56, y1: 515, x2: 108, y2: 608, nx: 0.85, ny: -0.52, flash: 0 },
    { x1: W - 56, y1: 515, x2: W - 108, y2: 608, nx: -0.85, ny: -0.52, flash: 0 }
  ];

  let state = null, rafId = null, lastTs = 0, lastComboShown = 0, levelUpReadyAt = 0, levelUpUnlockTimer = null;
  const activePointers = new Map();

  function createInitialState(attract = false) {
    return {
      phase: attract ? 'START' : 'PLAYING', elapsed: 0, gateHp: 100, maxGateHp: 100,
      level: 1, xp: 0, nextXp: 32, kills: 0, combo: 0, maxCombo: 0, comboTimer: 0,
      tilt: 0, tiltLockTimer: 0, hitstop: 0, shake: 0, gateFlash: 0, critFlash: 0,
      respawnTimer: 0, spawnTimer: 0.55, eliteTimer: 45, bossSpawned: false,
      bannerText: '', bannerSub: '', bannerTimer: 0,
      levels: { plasma: 1, lightning: 0, prism: 0, gravity: 0, bumper: 0, spinner: 0, multiball: 0, overclock: 0 },
      pendingChoices: [], input: { left: false, right: false }, tapRipples: [],
      flippers: {
        left: { px: 118, py: 688, len: 88, angle: 0.44, rest: 0.44, active: -0.52, prevAngle: 0.44, swingTime: 0 },
        right: { px: W - 118, py: 688, len: 88, angle: Math.PI - 0.44, rest: Math.PI - 0.44, active: Math.PI + 0.52, prevAngle: Math.PI - 0.44, swingTime: 0 }
      },
      bumpers: [
        { x: 152, y: 280, r: 22, flash: 0 },
        { x: W - 152, y: 280, r: 22, flash: 0 },
        { x: W / 2, y: 368, r: 24, flash: 0 }
      ],
      spinner: { x: W / 2, y: 468, w: 62, spin: 0, angle: 0, flash: 0 },
      balls: [], enemies: [], gems: [], particles: [], bolts: [], lasers: [], rings: [], starbursts: [], floatTexts: []
    };
  }

  function addBall(kind, x, y, vx, vy, isMini = false) {
    if (isMini && state.balls.filter(b => b.isMini).length >= 16) return;
    const lv = Math.max(1, state.levels[kind] || 1), evolved = lv >= 4;
    const baseDmg = (18 + lv * 8) * (1 + state.levels.multiball * 0.15) * (isMini ? 0.55 : 1);
    state.balls.push({ kind, evolved, isMini, x, y, vx, vy, r: isMini ? 6 : (evolved && kind === 'plasma' ? 12.5 : 9.5), damage: baseDmg, critTimer: 0, pierce: 0, bounces: 0, life: isMini ? 6.5 : 9999, trail: [] });
  }

  function launchMainBall(preferredKind = null) {
    const owned = ['plasma', 'lightning', 'prism', 'gravity'].filter(k => state.levels[k] > 0);
    const kind = preferredKind || owned[Math.floor(Math.random() * owned.length)] || 'plasma';
    addBall(kind, W - 52, 560, -130 - Math.random() * 130, -740 - Math.random() * 110, false);
  }

  function desiredMainBallCount() {
    return Math.max(1, ['plasma', 'lightning', 'prism', 'gravity'].filter(k => state.levels[k] > 0).length + state.levels.multiball);
  }

  function showBanner(text, sub = 'ALERT', dur = 2.1) { state.bannerText = text; state.bannerSub = sub; state.bannerTimer = dur; }

  function spawnParticles(x, y, color, count = 10, speed = 180) {
    for (let i = 0; i < count; i++) {
      if (state.particles.length > 360) break;
      const a = Math.random() * Math.PI * 2, s = (0.35 + Math.random() * 0.85) * speed;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.24 + Math.random() * 0.32, maxLife: 0.56, r: 2 + Math.random() * 2.5, color });
    }
  }

  function addStarburst(x, y, color = '#ffd43b', size = 28) { state.starbursts.push({ x, y, color, size, life: 0.18, maxLife: 0.18 }); }

  function addFloatText(x, y, text, color = '#fff', size = 14) {
    if (state.floatTexts.length > 40) state.floatTexts.shift();
    state.floatTexts.push({ x, y, text, color, size, life: 0.62, maxLife: 0.62 });
  }

  function spawnEnemy(type = 'drone', xOverride = null, yOverride = null) {
    const mins = state.elapsed / 60, hpScale = 1 + mins * 0.65 + (mins > 2 ? (mins - 2) * 0.5 : 0);
    const x = xOverride !== null ? xOverride : (64 + Math.random() * (W - 128));
    const y = yOverride !== null ? yOverride : (112 + Math.random() * 30);
    if (type === 'boss') { state.enemies.push({ type: 'boss', x: W / 2, y: 150, vx: 52, vy: 5, r: 38, hp: Math.round(1400 * hpScale), maxHp: Math.round(1400 * hpScale), xp: 120, color: '#ff2a7f', flash: 0, shootTimer: 2.2 }); return; }
    if (type === 'elite') { state.enemies.push({ type: 'elite', x, y, vx: (Math.random() - 0.5) * 30, vy: 18 + mins * 2, r: 22, hp: Math.round(180 * hpScale), maxHp: Math.round(180 * hpScale), xp: 34, color: '#ffd43b', flash: 0 }); return; }
    if (type === 'shield') { state.enemies.push({ type: 'shield', x, y, vx: (Math.random() - 0.5) * 20, vy: 24 + mins * 3, r: 16, hp: Math.round(64 * hpScale), maxHp: Math.round(64 * hpScale), xp: 14, color: '#f59e0b', flash: 0 }); return; }
    if (type === 'splitter') { state.enemies.push({ type: 'splitter', x, y, vx: (Math.random() - 0.5) * 34, vy: 29 + mins * 3.5, r: 14, hp: Math.round(40 * hpScale), maxHp: Math.round(40 * hpScale), xp: 11, color: '#e879f9', flash: 0 }); return; }
    state.enemies.push({ type: 'drone', x, y, vx: (Math.random() - 0.5) * 24, vy: 33 + mins * 4.5, r: 12, hp: Math.round(22 * hpScale), maxHp: Math.round(22 * hpScale), xp: 8, color: '#ff3b6b', flash: 0 });
  }

  function damageEnemy(enemy, rawDmg, isCrit = false, hitFromBelow = false) {
    let dmg = rawDmg;
    if (enemy.type === 'shield' && hitFromBelow && !isCrit) dmg *= 0.45;
    enemy.hp -= dmg; enemy.flash = 0.13;
    state.combo++; state.comboTimer = 2.6;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    if (isCrit) { addStarburst(enemy.x, enemy.y, '#ffd43b', 32); addFloatText(enemy.x, enemy.y - 12, `${Math.round(dmg)}!!`, '#ffd43b', 18); }
    else if (Math.random() < 0.42 || enemy.type === 'boss' || enemy.type === 'elite') { addFloatText(enemy.x, enemy.y - 8, `${Math.round(dmg)}`, '#ffffff', 13); }

    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true; state.kills++; audio.kill(state.combo);
      spawnParticles(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 42 : 12, enemy.type === 'boss' ? 300 : 200);
      const shards = enemy.type === 'boss' ? 12 : enemy.type === 'elite' ? 5 : 1, xpPerShard = Math.ceil(enemy.xp / shards);
      for (let i = 0; i < shards; i++) state.gems.push({ x: enemy.x + (Math.random() - 0.5) * 22, y: enemy.y + (Math.random() - 0.5) * 22, vx: (Math.random() - 0.5) * 55, vy: 45 + Math.random() * 35, xp: xpPerShard, big: enemy.type === 'elite' || enemy.type === 'boss' });
      if (enemy.type === 'splitter') { spawnEnemy('drone', enemy.x - 14, enemy.y); spawnEnemy('drone', enemy.x + 14, enemy.y); }
      if (enemy.type === 'boss') { state.shake = 18; audio.evolve(); endRun(true); }
    } else { audio.hit(state.combo); }
  }

  function triggerBallEffect(ball, hitX, hitY, primaryEnemy) {
    const lv = Math.max(1, state.levels[ball.kind] || 1), comboMult = 1 + Math.min(2.5, state.combo * 0.02);
    if (ball.kind === 'plasma') {
      const rad = ball.evolved ? 90 : (44 + lv * 11);
      state.rings.push({ x: hitX, y: hitY, r: 8, maxR: rad, color: '#ff2a7f', life: 0.24, maxLife: 0.24 });
      for (const e of state.enemies) if (e !== primaryEnemy && !e.dead && Math.hypot(e.x - hitX, e.y - hitY) < rad + e.r) damageEnemy(e, ball.damage * (ball.evolved ? 0.85 : 0.55) * comboMult, false, false);
    }
    if (ball.kind === 'lightning') {
      const chains = ball.evolved ? 6 : (2 + lv), range = ball.evolved ? 200 : 145;
      let currX = hitX, currY = hitY, zapped = false;
      const visited = new Set(primaryEnemy ? [primaryEnemy] : []);
      for (let c = 0; c < chains; c++) {
        let best = null, bestD = range;
        for (const e of state.enemies) { if (e.dead || visited.has(e)) continue; const d = Math.hypot(e.x - currX, e.y - currY); if (d < bestD) { bestD = d; best = e; } }
        if (!best) break;
        visited.add(best); zapped = true;
        state.bolts.push({ x1: currX, y1: currY, x2: best.x, y2: best.y, life: 0.16, maxLife: 0.16 });
        damageEnemy(best, ball.damage * (ball.evolved ? 0.9 : 0.65) * comboMult, false, false);
        currX = best.x; currY = best.y;
      }
      if (zapped) audio.zap();
    }
    if (ball.kind === 'prism' && !ball.isMini) {
      ball.bounces++;
      if (ball.bounces >= (ball.evolved ? 3 : Math.max(3, 6 - lv))) {
        ball.bounces = 0;
        const count = ball.evolved ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const ang = Math.atan2(ball.vy, ball.vx) + (i - (count - 1) / 2) * 0.6, spd = Math.max(440, Math.hypot(ball.vx, ball.vy));
          addBall('prism', hitX, hitY, Math.cos(ang) * spd, Math.sin(ang) * spd, true);
        }
        spawnParticles(hitX, hitY, '#f8fafc', 7, 150);
      }
    }
  }

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: x1, y: y1, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return { x: x1 + t * dx, y: y1 + t * dy, t };
  }

  function resolveSegmentCollision(ball, x1, y1, x2, y2, restitution = 0.88) {
    const pt = closestPointOnSegment(ball.x, ball.y, x1, y1, x2, y2);
    const dx = ball.x - pt.x, dy = ball.y - pt.y, dist = Math.hypot(dx, dy);
    if (dist < ball.r && dist > 0.0001) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = pt.x + nx * (ball.r + 0.5); ball.y = pt.y + ny * (ball.r + 0.5);
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) { ball.vx -= (1 + restitution) * vn * nx; ball.vy -= (1 + restitution) * vn * ny; }
      return true;
    }
    return false;
  }

  function resolveFlipperCollision(ball, f, isLeft, dt, isAttract = false) {
    const tipX = f.px + Math.cos(f.angle) * f.len, tipY = f.py + Math.sin(f.angle) * f.len;
    const pt = closestPointOnSegment(ball.x, ball.y, f.px, f.py, tipX, tipY);
    const dx = ball.x - pt.x, dy = ball.y - pt.y, dist = Math.hypot(dx, dy), minDist = ball.r + 8.5;
    if (dist < minDist && dist > 0.0001) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = pt.x + nx * (minDist + 0.8); ball.y = pt.y + ny * (minDist + 0.8);
      const angVel = (f.angle - f.prevAngle) / Math.max(dt, 0.001);
      const swingingUp = isLeft ? angVel < -1.5 : angVel > 1.5;
      const rDist = pt.t * f.len, tx = -Math.sin(f.angle) * angVel * rDist, ty = Math.cos(f.angle) * angVel * rDist;
      const vn = (ball.vx - tx) * nx + (ball.vy - ty) * ny;
      if (vn < 0) { const bounce = swingingUp ? 1.05 : 0.72; ball.vx -= (1 + bounce) * vn * nx; ball.vy -= (1 + bounce) * vn * ny; }
      if (swingingUp || f.swingTime > 0) {
        ball.vx = (pt.t - 0.5) * 290 * (isLeft ? 1 : -1) + (isLeft ? 85 : -85);
        ball.vy = -(810 + state.levels.overclock * 55 + pt.t * 155);
        ball.critTimer = 1.65; ball.pierce = 2 + state.levels.overclock;
        if (!isAttract) {
          state.hitstop = 0.028; state.shake = Math.max(state.shake, 7); state.critFlash = 0.22;
          audio.crit(); addStarburst(pt.x, pt.y, '#ffd43b', 36); spawnParticles(pt.x, pt.y, '#ffd43b', 12, 240); addFloatText(pt.x, pt.y - 18, 'CRIT!!', '#ffd43b', 16);
        }
      }
    }
  }

  function triggerNudge() {
    if (!state || state.phase !== 'PLAYING' || state.tiltLockTimer > 0) return;
    state.tilt = Math.min(100, state.tilt + 36); state.shake = 11; audio.nudge();
    for (const b of state.balls) { b.vy -= 310; b.vx += (Math.random() - 0.5) * 150; }
    for (const e of state.enemies) if (e.type !== 'boss') e.y = Math.max(96, e.y - 36);
    state.rings.push({ x: W / 2, y: H - 140, r: 18, maxR: 240, color: '#ffd43b', life: 0.26, maxLife: 0.26 });
    if (state.tilt >= 100) { state.tiltLockTimer = 2.6; showBanner('TILT LOCK!', 'フリッパー 2.6秒停止', 2.4); audio.hurt(); }
  }

  function openLevelUp() {
    state.phase = 'LEVEL_UP'; clearInputs(); audio.levelUp();
    const pool = UPGRADES.filter(u => state.levels[u.id] < u.maxLv);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const choices = pool.slice(0, 3);
    if (choices.length === 0) { state.gateHp = Math.min(state.maxGateHp, state.gateHp + 25); state.phase = 'PLAYING'; showBanner('MAX OVERDRIVE!', 'HP +25回復', 1.8); return; }

    state.pendingChoices = choices;
    levelUpBadge.textContent = `LV.${state.level}`;
    upgradeList.innerHTML = '';
    levelUpReadyAt = performance.now() + 300;
    if (levelUpUnlockTimer) clearTimeout(levelUpUnlockTimer);
    upgradeList.classList.add('locked');

    choices.forEach((u) => {
      const curLv = state.levels[u.id], isEvo = u.evoName && curLv === u.maxLv - 1;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'upg-card'; btn.style.borderColor = isEvo ? '#ffd43b' : u.color;
      btn.innerHTML = `<div class="unskew"><div class="upg-icon" style="background:${u.color}25;border-color:${u.color};color:${u.color}">${u.icon}</div><div class="upg-body"><div class="upg-top"><span class="font-arcade upg-name" style="color:${isEvo ? '#fcd34d' : '#fff'}">${isEvo ? `★ ${u.evoName}` : u.name}</span><span class="font-arcade upg-lv">LV.${curLv}→${curLv + 1}</span></div><p class="upg-desc">${u.desc(curLv)}</p></div></div>`;
      btn.addEventListener('click', () => applyUpgrade(u.id));
      upgradeList.appendChild(btn);
    });

    overlayLevelUp.classList.remove('hidden');
    levelUpUnlockTimer = setTimeout(() => upgradeList.classList.remove('locked'), 300);
  }

  function applyUpgrade(id) {
    if (state.phase !== 'LEVEL_UP' || performance.now() < levelUpReadyAt) return;
    const u = UPGRADES.find(item => item.id === id);
    if (!u) return;
    const prevLv = state.levels[id];
    state.levels[id] = Math.min(u.maxLv, prevLv + 1);
    const newLv = state.levels[id];
    if (u.evoName && newLv === u.maxLv) { audio.evolve(); showBanner(`${u.evoName} 覚醒！`, 'EVOLUTION', 2.4); }
    if (u.type === 'ball') {
      let updated = false;
      for (const b of state.balls) if (b.kind === id && !b.isMini) { b.evolved = newLv >= 4; b.r = (b.evolved && id === 'plasma') ? 12.5 : 9.5; b.damage = (18 + newLv * 8) * (1 + state.levels.multiball * 0.15); updated = true; }
      if (!updated || prevLv === 0) launchMainBall(id);
    }
    if (id === 'bumper') {
      if (newLv === 1 && state.bumpers.length < 4) state.bumpers.push({ x: 96, y: 368, r: 20, flash: 0 });
      if (newLv >= 3 && state.bumpers.length < 5) state.bumpers.push({ x: W - 96, y: 368, r: 20, flash: 0 });
    }
    if (id === 'multiball') launchMainBall();
    if (id === 'overclock') state.gateHp = Math.min(state.maxGateHp, state.gateHp + 30);
    for (const b of state.balls) { const blv = Math.max(1, state.levels[b.kind] || 1); b.damage = (18 + blv * 8) * (1 + state.levels.multiball * 0.15) * (b.isMini ? 0.55 : 1); }

    overlayLevelUp.classList.add('hidden'); state.pendingChoices = []; state.phase = 'PLAYING'; refreshBuildStrip();
  }

  function refreshBuildStrip() {
    const badges = [];
    for (const u of UPGRADES) {
      const lv = state.levels[u.id];
      if (lv > 0) {
        const isEvo = u.evoName && lv >= u.maxLv, border = isEvo ? '#ffd43b' : u.color;
        badges.push(`<div class="skew-plate build-badge font-arcade" style="border-color:${border};color:${isEvo ? '#ffd43b' : u.color}"><span class="unskew">${u.icon}<span style="color:#fff">${isEvo ? '★' : lv}</span></span></div>`);
      }
    }
    buildStrip.innerHTML = badges.join('');
  }

  function updateAttract(dt) {
    state.elapsed += dt;
    if (state.balls.length < 3) addBall(['plasma', 'lightning', 'gravity'][state.balls.length % 3], 140 + Math.random() * 170, 210, (Math.random() - 0.5) * 440, -400, false);
    const fl = state.flippers.left, fr = state.flippers.right;
    const autoL = state.balls.some(b => b.y > 615 && b.x < W / 2 + 16), autoR = state.balls.some(b => b.y > 615 && b.x >= W / 2 - 16);
    const subDt = dt / SUBSTEPS;
    for (let step = 0; step < SUBSTEPS; step++) {
      fl.prevAngle = fl.angle; fr.prevAngle = fr.angle;
      fl.angle += ((autoL ? fl.active : fl.rest) - fl.angle) * Math.min(1, 20 * subDt);
      fr.angle += ((autoR ? fr.active : fr.rest) - fr.angle) * Math.min(1, 20 * subDt);
      for (const b of state.balls) {
        b.vy += GRAVITY * subDt; b.x += b.vx * subDt; b.y += b.vy * subDt;
        for (const seg of WALL_SEGMENTS) resolveSegmentCollision(b, seg.x1, seg.y1, seg.x2, seg.y2, 0.92);
        for (const sl of SLINGSHOTS) if (resolveSegmentCollision(b, sl.x1, sl.y1, sl.x2, sl.y2, 1.15)) { b.vx += sl.nx * 220; b.vy += sl.ny * 220; sl.flash = 0.16; }
        for (const bmp of state.bumpers) {
          const dx = b.x - bmp.x, dy = b.y - bmp.y, dist = Math.hypot(dx, dy);
          if (dist < b.r + bmp.r && dist > 0.001) { const nx = dx / dist, ny = dy / dist; b.x = bmp.x + nx * (b.r + bmp.r + 1); b.y = bmp.y + ny * (b.r + bmp.r + 1); b.vx = nx * 540; b.vy = ny * 540; bmp.flash = 0.2; spawnParticles(bmp.x + nx * bmp.r, bmp.y + ny * bmp.r, '#00eaff', 6, 160); }
        }
        resolveFlipperCollision(b, fl, true, subDt, true); resolveFlipperCollision(b, fr, false, subDt, true);
        if (b.y > H + 10) { b.x = W - 52; b.y = 550; b.vx = -150 - Math.random() * 130; b.vy = -750; }
      }
    }
    for (const b of state.balls) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.shift(); }
    for (const bmp of state.bumpers) bmp.flash = Math.max(0, bmp.flash - dt);
    for (const sl of SLINGSHOTS) sl.flash = Math.max(0, sl.flash - dt);
    for (let i = state.particles.length - 1; i >= 0; i--) { const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) state.particles.splice(i, 1); }
  }

  function update(dt) {
    if (state.phase === 'START') { updateAttract(dt); return; }
    if (state.phase !== 'PLAYING') return;
    if (state.hitstop > 0) { state.hitstop = Math.max(0, state.hitstop - dt); return; }

    state.elapsed += dt; state.shake = Math.max(0, state.shake - dt * 30); state.gateFlash = Math.max(0, state.gateFlash - dt * 3); state.critFlash = Math.max(0, state.critFlash - dt * 2.5);
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 0; }
    if (state.tiltLockTimer > 0) { state.tiltLockTimer = Math.max(0, state.tiltLockTimer - dt); if (state.tiltLockTimer === 0) state.tilt = 0; }
    else if (state.tilt > 0) state.tilt = Math.max(0, state.tilt - dt * 16);

    const mins = state.elapsed / 60;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemies.length < 150) {
      const batch = 1 + Math.floor(mins * 1.1);
      for (let i = 0; i < batch; i++) {
        const roll = Math.random();
        if (mins > 1.2 && roll < 0.18) spawnEnemy('shield');
        else if (mins > 0.7 && roll < 0.36) spawnEnemy('splitter');
        else spawnEnemy('drone');
      }
      state.spawnTimer = Math.max(0.45, 1.32 - mins * 0.22);
    }

    state.eliteTimer -= dt;
    if (state.eliteTimer <= 0) { spawnEnemy('elite'); showBanner('ELITE 接近！', 'HIGH VALUE', 1.8); state.eliteTimer = 42; }
    if (!state.bossSpawned && state.elapsed >= 180) { state.bossSpawned = true; spawnEnemy('boss'); showBanner('ARCHITECT CORE', 'WARNING // BOSS', 2.8); audio.evolve(); }

    const activeMains = state.balls.filter(b => !b.isMini).length;
    if (activeMains === 0) { state.respawnTimer -= dt; if (state.respawnTimer <= 0) launchMainBall(); }
    else if (activeMains < desiredMainBallCount() && Math.random() < dt * 0.35) launchMainBall();

    const subDt = dt / SUBSTEPS, leftActive = state.input.left && state.tiltLockTimer <= 0, rightActive = state.input.right && state.tiltLockTimer <= 0;
    for (let step = 0; step < SUBSTEPS; step++) {
      const fl = state.flippers.left, fr = state.flippers.right;
      fl.prevAngle = fl.angle; fr.prevAngle = fr.angle;
      fl.angle += ((leftActive ? fl.active : fl.rest) - fl.angle) * Math.min(1, (leftActive ? 23 : 12) * subDt);
      fr.angle += ((rightActive ? fr.active : fr.rest) - fr.angle) * Math.min(1, (rightActive ? 23 : 12) * subDt);
      fl.swingTime = leftActive && Math.abs(fl.angle - fl.active) > 0.08 ? 0.095 : Math.max(0, fl.swingTime - subDt);
      fr.swingTime = rightActive && Math.abs(fr.angle - fr.active) > 0.08 ? 0.095 : Math.max(0, fr.swingTime - subDt);

      for (const b of state.balls) {
        b.vy += GRAVITY * subDt;
        const spd = Math.hypot(b.vx, b.vy), maxSpd = 1040 + state.levels.overclock * 60;
        if (spd > maxSpd) { b.vx = (b.vx / spd) * maxSpd; b.vy = (b.vy / spd) * maxSpd; }
        b.x += b.vx * subDt; b.y += b.vy * subDt; b.critTimer = Math.max(0, b.critTimer - subDt);
        if (b.isMini) b.life -= subDt;

        for (const seg of WALL_SEGMENTS) resolveSegmentCollision(b, seg.x1, seg.y1, seg.x2, seg.y2, 0.88);
        for (const sl of SLINGSHOTS) if (resolveSegmentCollision(b, sl.x1, sl.y1, sl.x2, sl.y2, 1.15)) { b.vx += sl.nx * 255; b.vy += sl.ny * 255; sl.flash = 0.18; audio.bumper(); spawnParticles(b.x, b.y, '#00eaff', 7, 170); }
        for (const bmp of state.bumpers) {
          const dx = b.x - bmp.x, dy = b.y - bmp.y, dist = Math.hypot(dx, dy);
          if (dist < b.r + bmp.r && dist > 0.001) {
            const nx = dx / dist, ny = dy / dist; b.x = bmp.x + nx * (b.r + bmp.r + 1); b.y = bmp.y + ny * (b.r + bmp.r + 1);
            const kick = 560 + state.levels.bumper * 45; b.vx = nx * kick + (Math.random() - 0.5) * 75; b.vy = ny * kick; bmp.flash = 0.22; audio.bumper();
            spawnParticles(bmp.x + nx * bmp.r, bmp.y + ny * bmp.r, '#38bdf8', 9, 200);
            if (state.levels.bumper > 0) {
              const rad = 70 + state.levels.bumper * 22, dmg = 16 + state.levels.bumper * 12;
              for (const tb of (state.levels.bumper >= 4 ? state.bumpers : [bmp])) {
                tb.flash = 0.24; state.rings.push({ x: tb.x, y: tb.y, r: tb.r, maxR: rad, color: '#38bdf8', life: 0.24, maxLife: 0.24 });
                for (const e of state.enemies) if (!e.dead && Math.hypot(e.x - tb.x, e.y - tb.y) < rad + e.r) damageEnemy(e, dmg, false, false);
              }
            }
          }
        }
        resolveFlipperCollision(b, fl, true, subDt, false); resolveFlipperCollision(b, fr, false, subDt, false);

        const sp = state.spinner;
        if (Math.abs(b.y - sp.y) < b.r + 8 && Math.abs(b.x - sp.x) < sp.w / 2 + b.r && sp.flash <= 0) {
          sp.spin = 18; sp.flash = 0.22; audio.bumper();
          if (state.levels.spinner > 0) {
            const beamCount = state.levels.spinner >= 4 ? 3 : (state.levels.spinner >= 2 ? 2 : 1), beamDmg = 28 + state.levels.spinner * 18;
            for (let k = 0; k < beamCount; k++) {
              const bx = sp.x + (k - (beamCount - 1) / 2) * 28;
              state.lasers.push({ x: bx, y1: sp.y, y2: PLAY_TOP, life: 0.18, maxLife: 0.18, w: state.levels.spinner >= 4 ? 9 : 5 });
              for (const e of state.enemies) if (!e.dead && e.y < sp.y && Math.abs(e.x - bx) < e.r + 14) damageEnemy(e, beamDmg, true, false);
            }
          }
        }

        for (const e of state.enemies) {
          if (e.dead) continue;
          const dx = b.x - e.x, dy = b.y - e.y, dist = Math.hypot(dx, dy);
          if (dist < b.r + e.r && dist > 0.001) {
            const isCrit = b.critTimer > 0, critMult = 2.2 + state.levels.overclock * 0.35, comboMult = 1 + Math.min(2.5, state.combo * 0.02);
            damageEnemy(e, b.damage * (isCrit ? critMult : 1) * comboMult, isCrit, b.y > e.y + 4);
            triggerBallEffect(b, e.x, e.y, e);
            if (b.pierce > 0) b.pierce--;
            else {
              const nx = dx / dist, ny = dy / dist; b.x = e.x + nx * (b.r + e.r + 1); b.y = e.y + ny * (b.r + e.r + 1);
              const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.85 * vn * nx; b.vy -= 1.85 * vn * ny; }
              if (Math.hypot(b.vx, b.vy) < 330) { b.vx *= 1.25; b.vy = Math.min(b.vy, -330); }
            }
          }
        }
      }
    }

    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i]; b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > (b.isMini ? 5 : 11)) b.trail.shift();
      if (b.kind === 'gravity') {
        const pullR = b.evolved ? 165 : (90 + state.levels.gravity * 20);
        for (const e of state.enemies) {
          if (e.dead || e.type === 'boss') continue;
          const dx = b.x - e.x, dy = b.y - e.y, d = Math.hypot(dx, dy);
          if (d < pullR && d > 12) {
            const f = (b.evolved ? 145 : 80) * dt; e.x += (dx / d) * f; e.y += (dy / d) * f;
            if (b.evolved && d < 62) { e.hp -= (24 + state.levels.gravity * 8) * dt; if (e.hp <= 0) damageEnemy(e, 1, false, false); }
          }
        }
      }
      if (b.y > H + 16 || (b.isMini && b.life <= 0)) {
        const wasMini = b.isMini; state.balls.splice(i, 1);
        if (!wasMini && state.balls.filter(x => !x.isMini).length === 0) {
          state.gateHp = Math.max(0, state.gateHp - 8); state.gateFlash = 1; state.shake = 11; state.respawnTimer = 0.78; audio.hurt();
          addFloatText(W / 2, GATE_Y - 22, 'DRAIN -8', '#ff2a7f', 15);
          if (state.gateHp <= 0) endRun(false);
        }
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i]; if (e.dead) { state.enemies.splice(i, 1); continue; }
      e.flash = Math.max(0, e.flash - dt);
      if (e.type === 'boss') {
        e.x += e.vx * dt; if (e.x < 85 || e.x > W - 85) e.vx *= -1; e.y = Math.min(195, e.y + e.vy * dt); e.shootTimer -= dt;
        if (e.shootTimer <= 0) { spawnEnemy('drone', e.x - 32, e.y + 34); spawnEnemy('drone', e.x + 32, e.y + 34); e.shootTimer = 3.2; }
      } else { e.x += e.vx * dt; e.y += e.vy * dt; if (e.x < PLAY_LEFT + e.r + 6 || e.x > PLAY_RIGHT - e.r - 6) e.vx *= -1; }
      if (e.y + e.r >= GATE_Y) {
        const dmg = e.type === 'elite' ? 22 : 10; state.gateHp = Math.max(0, state.gateHp - dmg); state.gateFlash = 1; state.shake = 12; audio.hurt();
        addFloatText(e.x, GATE_Y - 20, `-${dmg}`, '#ff2a7f', 16); state.enemies.splice(i, 1);
        if (state.gateHp <= 0) endRun(false);
      }
    }

    const magnetR = 76 + state.levels.gravity * 36 + (state.levels.gravity >= 4 ? 135 : 0);
    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i]; g.vy = Math.min(220, g.vy + 140 * dt); g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.96;
      let collected = false;
      for (const b of state.balls) { const dx = b.x - g.x, dy = b.y - g.y, d = Math.hypot(dx, dy); if (d < magnetR) { g.x += (dx / Math.max(d, 1)) * 420 * dt; g.y += (dy / Math.max(d, 1)) * 420 * dt; } if (d < b.r + 14) { collected = true; break; } }
      if (g.y >= 675) collected = true;
      if (collected) {
        state.xp += g.xp; state.gems.splice(i, 1);
        if (state.xp >= state.nextXp) { state.xp -= state.nextXp; state.level++; state.nextXp = Math.round(state.nextXp * 1.32 + 14); openLevelUp(); return; }
      }
    }

    for (const bmp of state.bumpers) bmp.flash = Math.max(0, bmp.flash - dt);
    for (const sl of SLINGSHOTS) sl.flash = Math.max(0, sl.flash - dt);
    state.spinner.flash = Math.max(0, state.spinner.flash - dt); state.spinner.angle += state.spinner.spin * dt; state.spinner.spin = Math.max(0, state.spinner.spin - dt * 20);
    for (let i = state.particles.length - 1; i >= 0; i--) { const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; p.life -= dt; if (p.life <= 0) state.particles.splice(i, 1); }
    for (let i = state.bolts.length - 1; i >= 0; i--) { state.bolts[i].life -= dt; if (state.bolts[i].life <= 0) state.bolts.splice(i, 1); }
    for (let i = state.lasers.length - 1; i >= 0; i--) { state.lasers[i].life -= dt; if (state.lasers[i].life <= 0) state.lasers.splice(i, 1); }
    for (let i = state.rings.length - 1; i >= 0; i--) { const r = state.rings[i]; r.life -= dt; r.r = r.maxR * (1 - r.life / r.maxLife); if (r.life <= 0) state.rings.splice(i, 1); }
    for (let i = state.starbursts.length - 1; i >= 0; i--) { state.starbursts[i].life -= dt; if (state.starbursts[i].life <= 0) state.starbursts.splice(i, 1); }
    for (let i = state.floatTexts.length - 1; i >= 0; i--) { const ft = state.floatTexts[i]; ft.y -= 40 * dt; ft.life -= dt; if (ft.life <= 0) state.floatTexts.splice(i, 1); }
    for (let i = state.tapRipples.length - 1; i >= 0; i--) { state.tapRipples[i].life -= dt; if (state.tapRipples[i].life <= 0) state.tapRipples.splice(i, 1); }
  }

  function draw() {
    ctx.save();
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0c1020'); bgGrad.addColorStop(0.55, '#090c17'); bgGrad.addColorStop(1, '#120b1a');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

    if (state.phase === 'PLAYING') {
      if (state.input.left) { const lg = ctx.createLinearGradient(0, 0, W * 0.45, 0); lg.addColorStop(0, 'rgba(255,42,127,0.14)'); lg.addColorStop(1, 'transparent'); ctx.fillStyle = lg; ctx.fillRect(0, PLAY_TOP, W / 2, H - PLAY_TOP); }
      if (state.input.right) { const rg = ctx.createLinearGradient(W, 0, W * 0.55, 0); rg.addColorStop(0, 'rgba(0,234,255,0.14)'); rg.addColorStop(1, 'transparent'); ctx.fillStyle = rg; ctx.fillRect(W / 2, PLAY_TOP, W / 2, H - PLAY_TOP); }
    }

    ctx.strokeStyle = 'rgba(0,234,255,0.045)'; ctx.lineWidth = 1;
    for (let gx = 45; gx < W; gx += 45) { ctx.beginPath(); ctx.moveTo(gx, PLAY_TOP); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = PLAY_TOP; gy < H; gy += 45) { ctx.beginPath(); ctx.moveTo(PLAY_LEFT, gy); ctx.lineTo(PLAY_RIGHT, gy); ctx.stroke(); }

    ctx.strokeStyle = 'rgba(255,42,127,0.09)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, 348, 108, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const cy = 590 - i * 24, alpha = 0.08 + ((Math.sin(state.elapsed * 6 - i * 1.1) + 1) * 0.13);
      ctx.strokeStyle = `rgba(0,234,255,${alpha})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(W / 2 - 18, cy + 9); ctx.lineTo(W / 2, cy); ctx.lineTo(W / 2 + 18, cy + 9); ctx.stroke();
    }

    if (state.shake > 0.2) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    if (state.critFlash > 0) { ctx.fillStyle = `rgba(255,212,59,${state.critFlash * 0.15})`; ctx.fillRect(0, 0, W, H); }

    ctx.save(); ctx.shadowColor = state.gateFlash > 0 ? '#ff2a7f' : '#00eaff'; ctx.shadowBlur = state.gateFlash > 0 ? 18 : 10;
    ctx.strokeStyle = state.gateFlash > 0 ? '#ff6fa8' : 'rgba(0,234,255,0.55)'; ctx.lineWidth = 4.5; ctx.setLineDash([16, 8]);
    ctx.beginPath(); ctx.moveTo(PLAY_LEFT + 10, GATE_Y); ctx.lineTo(PLAY_RIGHT - 10, GATE_Y); ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 9;
    for (const seg of WALL_SEGMENTS) { ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke(); }
    ctx.strokeStyle = '#00eaff'; ctx.lineWidth = 2.5;
    for (const seg of WALL_SEGMENTS) { ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke(); }

    for (let idx = 0; idx < SLINGSHOTS.length; idx++) {
      const sl = SLINGSHOTS[idx], backX = idx === 0 ? sl.x1 - 20 : sl.x1 + 20;
      ctx.fillStyle = sl.flash > 0 ? 'rgba(255,42,127,0.55)' : 'rgba(255,42,127,0.14)';
      ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.lineTo(backX, sl.y2 - 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = sl.flash > 0 ? '#ffffff' : '#ff2a7f'; ctx.lineWidth = sl.flash > 0 ? 6 : 4;
      ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.stroke();
    }

    const sp = state.spinner; ctx.save(); ctx.translate(sp.x, sp.y);
    ctx.strokeStyle = sp.flash > 0 ? '#ffffff' : (state.levels.spinner > 0 ? '#ffd43b' : 'rgba(255,212,59,0.45)'); ctx.lineWidth = 3.5;
    const scaleY = Math.max(0.2, Math.abs(Math.cos(sp.angle))); ctx.strokeRect(-sp.w / 2, -5.5 * scaleY, sp.w, 11 * scaleY); ctx.restore();

    for (const r of state.rings) { ctx.strokeStyle = r.color; ctx.globalAlpha = Math.max(0, r.life / r.maxLife); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    for (const l of state.lasers) { ctx.save(); ctx.shadowColor = '#ffd43b'; ctx.shadowBlur = 14; ctx.strokeStyle = '#fff9db'; ctx.globalAlpha = Math.max(0, l.life / l.maxLife); ctx.lineWidth = l.w; ctx.beginPath(); ctx.moveTo(l.x, l.y1); ctx.lineTo(l.x, l.y2); ctx.stroke(); ctx.restore(); }

    for (const bmp of state.bumpers) {
      const lit = bmp.flash > 0, rPop = bmp.r + (lit ? 4 : 0);
      ctx.save(); ctx.shadowColor = lit ? '#ffffff' : '#00eaff'; ctx.shadowBlur = lit ? 20 : 10;
      ctx.fillStyle = lit ? '#38bdf8' : '#101b33'; ctx.strokeStyle = lit ? '#ffffff' : '#00eaff'; ctx.lineWidth = lit ? 4 : 3;
      ctx.beginPath(); ctx.arc(bmp.x, bmp.y, rPop, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = lit ? '#ffd43b' : '#ff2a7f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(bmp.x, bmp.y, rPop * 0.54, 0, Math.PI * 2); ctx.stroke();
    }

    for (const g of state.gems) { ctx.fillStyle = g.big ? '#ffd43b' : '#00eaff'; const s = g.big ? 6.5 : 4.5; ctx.beginPath(); ctx.moveTo(g.x, g.y - s); ctx.lineTo(g.x + s * 0.85, g.y); ctx.lineTo(g.x, g.y + s); ctx.lineTo(g.x - s * 0.85, g.y); ctx.closePath(); ctx.fill(); }

    for (const e of state.enemies) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e.type === 'boss' ? 3 : 1.6;
      ctx.beginPath();
      if (e.type === 'boss') { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + state.elapsed * 0.9, rad = k % 2 === 0 ? e.r : e.r * 0.76; if (k === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); }
      else if (e.type === 'shield') { ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0); ctx.closePath(); }
      else if (e.type === 'splitter') { ctx.moveTo(0, -e.r); ctx.lineTo(e.r * 0.95, e.r * 0.85); ctx.lineTo(-e.r * 0.95, e.r * 0.85); ctx.closePath(); }
      else { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; if (k === 0) ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r); else ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); } ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      if (e.type === 'shield') { ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.r + 3, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); }
      if (e.type === 'boss' || e.type === 'elite' || (e.hp < e.maxHp && e.maxHp > 35)) {
        const bw = e.type === 'boss' ? 84 : 28; ctx.fillStyle = 'rgba(5,7,13,0.9)'; ctx.fillRect(-bw / 2, -e.r - 11, bw, 4.5);
        ctx.fillStyle = e.type === 'boss' ? '#ff2a7f' : '#00eaff'; ctx.fillRect(-bw / 2, -e.r - 11, bw * Math.max(0, e.hp / e.maxHp), 4.5);
      }
      ctx.restore();
    }

    for (const bolt of state.bolts) { ctx.strokeStyle = '#80f4ff'; ctx.globalAlpha = Math.max(0, bolt.life / bolt.maxLife); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bolt.x1, bolt.y1); ctx.lineTo((bolt.x1 + bolt.x2) / 2 + (Math.random() - 0.5) * 16, (bolt.y1 + bolt.y2) / 2 + (Math.random() - 0.5) * 16); ctx.lineTo(bolt.x2, bolt.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    drawFlipper(state.flippers.left, '#ff2a7f'); drawFlipper(state.flippers.right, '#00eaff');

    for (const b of state.balls) {
      const col = b.critTimer > 0 ? '#ffd43b' : b.kind === 'plasma' ? '#ff2a7f' : b.kind === 'lightning' ? '#00eaff' : b.kind === 'gravity' ? '#c084fc' : '#f8fafc';
      for (let t = 0; t < b.trail.length; t++) { const p = b.trail[t], ratio = (t + 1) / b.trail.length; ctx.fillStyle = col; ctx.globalAlpha = ratio * 0.4; ctx.beginPath(); ctx.arc(p.x, p.y, b.r * ratio * 0.9, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (b.kind === 'gravity') { ctx.strokeStyle = 'rgba(192,132,252,0.4)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(b.x, b.y, b.evolved ? 44 : 28, 0, Math.PI * 2); ctx.stroke(); }
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = b.critTimer > 0 ? 16 : 9; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = col; ctx.lineWidth = b.critTimer > 0 ? 3.8 : 2.8; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    for (const rp of state.tapRipples) { const ratio = rp.life / rp.maxLife; ctx.strokeStyle = rp.color; ctx.globalAlpha = ratio * 0.55; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(rp.x, rp.y, 12 + (1 - ratio) * 34, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    for (const sb of state.starbursts) { const ratio = sb.life / sb.maxLife; ctx.save(); ctx.translate(sb.x, sb.y); ctx.globalAlpha = ratio; ctx.strokeStyle = sb.color; ctx.lineWidth = 2.8; const rad = sb.size * (1.3 - ratio * 0.5); for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI + 0.35; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); ctx.lineTo(-Math.cos(a) * rad, -Math.sin(a) * rad); ctx.stroke(); } ctx.restore(); }
    for (const p of state.particles) { ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const ft of state.floatTexts) { ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife); ctx.font = `900 ${ft.size}px "Russo One", "Noto Sans JP", sans-serif`; ctx.strokeStyle = '#05070d'; ctx.lineWidth = 3.5; ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillStyle = ft.color; ctx.fillText(ft.text, ft.x, ft.y); }
    ctx.globalAlpha = 1;

    if (state.bannerTimer > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, state.bannerTimer * 2.2); ctx.translate(W / 2, 230); ctx.rotate(-0.045);
      ctx.fillStyle = 'rgba(11,16,32,0.94)'; ctx.fillRect(-W, -30, W * 2, 60);
      ctx.fillStyle = '#ff2a7f'; ctx.fillRect(-W, -30, W * 2, 3.5); ctx.fillStyle = '#00eaff'; ctx.fillRect(-W, 26.5, W * 2, 3.5);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd43b'; ctx.font = '700 10px "Chakra Petch", sans-serif'; ctx.fillText(state.bannerSub, 0, -9);
      ctx.fillStyle = '#ffffff'; ctx.font = '900 20px "Russo One", "Noto Sans JP", sans-serif'; ctx.fillText(state.bannerText, 0, 15); ctx.restore();
    }
    ctx.restore();
  }

  function drawFlipper(f, color) {
    const tipX = f.px + Math.cos(f.angle) * f.len, tipY = f.py + Math.sin(f.angle) * f.len, locked = state.tiltLockTimer > 0;
    ctx.save(); ctx.shadowColor = locked ? 'transparent' : color; ctx.shadowBlur = 14;
    ctx.strokeStyle = locked ? '#64748b' : color; ctx.lineWidth = 17; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle = locked ? '#94a3b8' : '#ffffff'; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.fillStyle = '#05070d'; ctx.beginPath(); ctx.arc(f.px, f.py, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function updateHud() {
    const hpPct = Math.max(0, Math.min(100, (state.gateHp / state.maxGateHp) * 100));
    hudHpText.textContent = String(Math.ceil(state.gateHp)); hudHpBar.style.width = `${hpPct}%`;
    if (state.phase === 'PLAYING' && hpPct <= 30) pinchOverlay.classList.remove('hidden'); else pinchOverlay.classList.add('hidden');
    hudXpBar.style.width = `${Math.max(0, Math.min(100, (state.xp / Math.max(1, state.nextXp)) * 100))}%`;
    hudTime.textContent = `${String(Math.floor(state.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`;
    hudMeta.textContent = `LV.${state.level} · ${state.kills} KO`;
    hudComboHits.textContent = String(state.combo); hudCombo.textContent = `x${(1 + Math.min(2.5, state.combo * 0.02)).toFixed(1)}`;
    comboBox.style.opacity = state.combo > 0 ? '1' : '0.35';
    if (state.combo > lastComboShown) { comboBox.classList.remove('combo-pop'); void comboBox.offsetWidth; comboBox.classList.add('combo-pop'); }
    lastComboShown = state.combo;
    hudTiltText.textContent = state.tiltLockTimer > 0 ? 'LOCK' : `${Math.round(state.tilt)}%`;
    if (state.phase === 'PLAYING' && state.elapsed > 8) { leftTouchHint.style.opacity = '0'; rightTouchHint.style.opacity = '0'; }
  }

  function clearInputs() { activePointers.clear(); if (state) { state.input.left = false; state.input.right = false; } }
  function syncPointerInputs() {
    if (!state || state.phase !== 'PLAYING') return;
    let l = false, r = false;
    for (const p of activePointers.values()) { if (p.side === 'left') l = true; if (p.side === 'right') r = true; }
    if (l && !state.input.left) audio.flipper(); if (r && !state.input.right) audio.flipper();
    state.input.left = l; state.input.right = r;
  }

  function endRun(victory) {
    state.phase = victory ? 'VICTORY' : 'OVER'; clearInputs(); touchHud.classList.add('hidden');
    const endTag = document.getElementById('endTag'), endTitle = document.getElementById('endTitle');
    if (victory) { endTag.style.background = '#06b6d4'; endTag.style.borderColor = '#a5f3fc'; endTag.innerHTML = '<span class="unskew font-arcade" style="color:#020617">BOSS DESTROYED</span>'; endTitle.textContent = 'STAGE CLEAR!!'; }
    else { endTag.style.background = '#e11d48'; endTag.style.borderColor = '#fda4af'; endTag.innerHTML = '<span class="unskew font-arcade">GATE BREACHED</span>'; endTitle.textContent = 'GAME OVER'; }
    document.getElementById('statTime').textContent = `${String(Math.floor(state.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`;
    document.getElementById('statKills').textContent = String(state.kills);
    document.getElementById('statLevel').textContent = String(state.level);
    document.getElementById('statMaxCombo').textContent = String(state.maxCombo);
    overlayEnd.classList.remove('hidden');
  }

  function startNewRun() {
    audio.unlock(); state = createInitialState(false); clearInputs(); lastComboShown = 0;
    leftTouchHint.style.opacity = '1'; rightTouchHint.style.opacity = '1';
    overlayStart.classList.add('hidden'); overlayLevelUp.classList.add('hidden'); overlayPause.classList.add('hidden'); overlayEnd.classList.add('hidden');
    touchHud.classList.remove('hidden');
    launchMainBall('plasma'); for (let i = 0; i < 4; i++) spawnEnemy('drone');
    refreshBuildStrip(); updateHud();
  }

  function loop(ts) {
    const dt = Math.min(0.033, Math.max(0.001, (ts - lastTs) / 1000)); lastTs = ts;
    update(dt); draw(); updateHud(); rafId = requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (state) draw();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state || state.phase !== 'PLAYING') return;
    e.preventDefault(); audio.unlock();
    const rect = canvas.getBoundingClientRect(), relX = (e.clientX - rect.left) / rect.width, relY = (e.clientY - rect.top) / rect.height;
    const side = relX < 0.5 ? 'left' : 'right';
    activePointers.set(e.pointerId, { side, startY: e.clientY, swiped: false });
    state.tapRipples.push({ x: relX * W, y: relY * H, color: side === 'left' ? '#ff2a7f' : '#00eaff', life: 0.28, maxLife: 0.28 });
    syncPointerInputs();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state || state.phase !== 'PLAYING') return;
    const p = activePointers.get(e.pointerId);
    if (p && !p.swiped && (p.startY - e.clientY) > 48) { p.swiped = true; triggerNudge(); }
  });
  function releasePointer(e) { if (activePointers.has(e.pointerId)) { activePointers.delete(e.pointerId); syncPointerInputs(); } }
  window.addEventListener('pointerup', releasePointer); window.addEventListener('pointercancel', releasePointer);

  btnNudge.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audio.unlock(); triggerNudge(); });
  window.addEventListener('keydown', (e) => {
    if (!state || state.phase !== 'PLAYING') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (!state.input.left) audio.flipper(); state.input.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (!state.input.right) audio.flipper(); state.input.right = true; }
    if (e.code === 'Space' && !e.repeat) triggerNudge();
  });
  window.addEventListener('keyup', (e) => {
    if (!state) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') state.input.right = false;
  });

  function togglePause() {
    if (!state) return;
    if (state.phase === 'PLAYING') { state.phase = 'PAUSED'; clearInputs(); overlayPause.classList.remove('hidden'); }
    else if (state.phase === 'PAUSED') { state.phase = 'PLAYING'; overlayPause.classList.add('hidden'); }
  }

  btnStart.addEventListener('click', startNewRun); btnPlayAgain.addEventListener('click', startNewRun);
  btnPause.addEventListener('click', togglePause); btnResume.addEventListener('click', togglePause); btnRestartFromPause.addEventListener('click', startNewRun);
  btnMute.addEventListener('click', () => { audio.unlock(); const muted = audio.toggleMute(); btnMute.textContent = muted ? '🔇' : '🔊'; btnMute.classList.toggle('muted-btn', muted); });
  window.addEventListener('resize', resizeCanvas);

  window.onload = () => {
    state = createInitialState(true); resizeCanvas(); refreshBuildStrip(); updateHud();
    if (rafId) cancelAnimationFrame(rafId); lastTs = performance.now(); rafId = requestAnimationFrame(loop);
  };
})();
