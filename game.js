'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#f06292', // + - pink
  '#4db6ac', // U - teal
  '#a1887f', // Y - brown
  '#fff176', // 1x1 - light yellow
  '#90a4ae', // 3x3 hueca - gray
  '#ff5252', // bomba
  '#ffeb3b', // rayo
  '#e040fb', // tinte
  '#69f0ae', // gravedad
  '#40c4ff', // congelar
  '#cfd8dc', // comodín
  '#757575', // basura / bloques pre-colocados
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // + (pentominó)
  [[9,0,9],[9,9,9]],                          // U (pentominó)
  [[0,10,0,0],[10,10,10,10]],                 // Y (pentominó)
  [[11]],                                     // 1x1 (recompensa tras un Tetris)
  [[12,12,12],[12,0,12],[12,12,12]],          // 3x3 hueca (reto)
  [[13]], [[14]], [[15]], [[16]], [[17]],      // power-ups 1x1: bomba, rayo, tinte, gravedad, congelar
];

// 13-17 = power-ups (no se fusionan al tablero); WILD = bloque comodín en el tablero
const POWER_TYPES = [13, 14, 15, 16, 17];
const WILD = 18;
const GARBAGE = 19;
const POWER_EVERY_LINES = 5;
const FREEZE_MS = 5000;
const ICONS = { 13: '💣', 14: '⚡', 15: '🎨', 16: '⬇️', 17: '❄️', 18: '✦' };
const POWER_NAMES = { 13: 'BOMBA', 14: 'RAYO', 15: 'TINTE', 16: 'GRAVEDAD', 17: 'CONGELAR' };

const SPECIAL_TYPES = [8, 9, 10, 12];
const SPECIAL_CHANCE = 0.07;

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PERFECT_CLEAR = 2000;
const FLASH_MS = 1200;
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 10;
const ABILITY_MS = 10000;
const QUEUE_LEN = 6;

// modos desafío (los values del <select> en index.html)
const SPRINT_LINES = 40;
const SPRINT_MS = 120000;
const GARBAGE_MS = 10000;
const PRESET_ROWS = 6;
const REVEAL_MS = 600;
const INVERSE_LEVEL_BASE = 4;
// orden = teclas 1-5 del menú
const ABILITY_KEYS = ['peek', 'swap', 'slow', 'undo', 'hold'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const energyFill = document.getElementById('energy-fill');
const energyHint = document.getElementById('energy-hint');
const peekSection = document.getElementById('peek-section');
const peekCanvas = document.getElementById('peek-canvas');
const peekCtx = peekCanvas.getContext('2d');
const abilityMenu = document.getElementById('ability-menu');
const modeSelect = document.getElementById('mode-select');
const modeInfo = document.getElementById('mode-info');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');

const themeToggle = document.getElementById('theme-toggle');
const themeColors = { grid: '', highlight: '', accent: '' };

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let hold, holdUsed, freezeLeft;
let energy, slowLeft, peekLeft, undoSnap;
let mode, levelBase, timeLeft, garbageLeft, revealLeft;
let combo, b2b, lastRotate, flash, audioCtx;

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPower() {
  return POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
}

// la recompensa entra como la siguiente pieza visible (queue[0] es la que está por salir)
function queueReward(type) {
  queue.splice(1, 0, type);
}

function nextType() {
  if (Math.random() < SPECIAL_CHANCE) return SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
  return Math.floor(Math.random() * 7) + 1;
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] && board[ny][nx] !== WILD) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = mode === 'inverse' ? rotateCW(rotateCW(rotateCW(current.shape))) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function cellFilled(x, y) {
  return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0);
}

// regla de 3 esquinas: T, última acción fue rotar y >=3 de las 4 esquinas ocupadas
function isTSpin() {
  if (current.type !== 3 || !lastRotate) return false;
  const { x, y } = current;
  const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
  return corners.filter(([dx, dy]) => cellFilled(x + dx, y + dy)).length >= 3;
}

function beep(freq, dur = 0.12) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

function scoreLock(cleared, tspin) {
  const labels = [];
  let pts = 0;
  if (!cleared) {
    combo = 0;
    if (tspin) { pts = TSPIN_SCORES[0] * level; labels.push('T-SPIN'); }
  } else {
    const difficult = cleared === 4 || tspin;
    pts = (tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared]) * level;
    if (tspin) labels.push('T-SPIN');
    if (cleared === 4) { labels.push('TETRIS'); queueReward(11); }
    if (difficult && b2b) { pts = Math.floor(pts * 1.5); labels.push('B2B'); }
    b2b = difficult;
    combo++;
    if (combo >= 2) { pts *= combo; labels.push('COMBO x' + combo); }
    if (board.every(row => row.every(v => !v))) { pts += PERFECT_CLEAR * level; labels.push('PERFECT CLEAR'); }
    lines += cleared;
    if (Math.floor(lines / POWER_EVERY_LINES) > Math.floor((lines - cleared) / POWER_EVERY_LINES)) queueReward(randomPower());
    energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
    level = Math.floor(lines / 10) + 1 + levelBase;
    dropInterval = speedFor(level);
    beep(300 + 100 * Math.min(combo, 8));
  }
  score += pts;
  if (mode === 'sprint' && lines >= SPRINT_LINES) endGame('¡VICTORIA!', true);
  if (labels.length) {
    flash = { text: labels.join(' + ') + '  +' + pts, left: FLASH_MS };
    if (labels.length > 1 || tspin) beep(880, 0.2);
  }
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastRotate = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function applyPower(type, x, y) {
  if (type === 13) {
    for (let r = y - 1; r <= y + 1; r++)
      for (let c = x - 1; c <= x + 1; c++)
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
  } else if (type === 14) {
    if (Math.random() < 0.5) board[y].fill(0);
    else for (let r = 0; r < ROWS; r++) board[r][x] = 0;
  } else if (type === 15) {
    const below = y + 1 < ROWS ? board[y + 1][x] : 0;
    let color = below && below !== WILD ? below : 0;
    if (!color) {
      const count = {};
      board.forEach(row => row.forEach(v => { if (v && v !== WILD) count[v] = (count[v] || 0) + 1; }));
      color = +Object.keys(count).sort((a, b) => count[b] - count[a])[0] || 0;
    }
    if (color) board.forEach(row => row.forEach((v, c) => { if (v === color) row[c] = WILD; }));
  } else if (type === 16) {
    for (let c = 0; c < COLS; c++) {
      const col = board.map(row => row[c]).filter(v => v);
      for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() || 0;
    }
  } else if (type === 17) {
    freezeLeft = FREEZE_MS;
  }
}

function lockPower() {
  applyPower(current.type, current.x, current.y);
  flash = { text: POWER_NAMES[current.type] + '  +50', left: FLASH_MS };
  score += 50;
  const cleared = clearLines();
  if (cleared) scoreLock(cleared, false);
  updateHUD();
  spawn();
}

function lockPiece() {
  revealLeft = REVEAL_MS;
  undoSnap = structuredClone({ board, current, queue, score, lines, level, dropInterval, combo, b2b, hold, holdUsed });
  if (POWER_TYPES.includes(current.type)) return lockPower();
  const tspin = isTSpin();
  merge();
  scoreLock(clearLines(), tspin);
  spawn();
}

function spawn() {
  current = makePiece(queue.shift());
  queue.push(nextType());
  holdUsed = false;
  lastRotate = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
}

function holdPiece() {
  if (holdUsed) return;
  const type = current.type;
  if (hold) {
    current = makePiece(hold);
    if (collide(current.shape, current.x, current.y)) endGame();
  } else {
    spawn();
  }
  hold = type;
  holdUsed = true;
  lastRotate = false;
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo > 1 ? 'x' + combo : '-';
  energyFill.style.width = (energy / ENERGY_MAX) * 100 + '%';
  energyHint.textContent = energy >= ENERGY_MAX ? '¡Lista! Pulsa Q' : '';
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = themeColors.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (ICONS[colorIndex]) {
    context.fillStyle = '#000';
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(ICONS[colorIndex], x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = themeColors.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board (en modo invisible solo se ve un instante tras bloquear, o al terminar)
  if (mode !== 'invisible' || revealLeft > 0 || gameOver)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost (también delataría el tablero en modo invisible)
  if (mode !== 'invisible') {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(64, 196, 255, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS[17];
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.textAlign = 'left';
    ctx.fillText('❄ ' + (freezeLeft / 1000).toFixed(1) + 's', 6, 18);
  }
  drawFlash();
}

function drawFlash() {
  if (!flash) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, flash.left / 400);
  ctx.font = "bold 16px 'Courier New', monospace";
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillStyle = themeColors.accent;
  ctx.strokeText(flash.text, canvas.width / 2, canvas.height / 3);
  ctx.fillText(flash.text, canvas.width / 2, canvas.height / 3);
  ctx.restore();
}

function drawPreview(context, cnv, piece, alpha) {
  const NB = 30;
  context.clearRect(0, 0, cnv.width, cnv.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, makePiece(queue[0]));
}

// slot atenuado mientras el hold está bloqueado en este turno
function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold && makePiece(hold), holdUsed ? 0.35 : 1);
}

function drawPeek() {
  const SZ = 14;
  peekCtx.clearRect(0, 0, peekCanvas.width, peekCanvas.height);
  queue.slice(0, 5).forEach((type, i) => {
    const shape = PIECES[type];
    const offX = Math.floor((5 - shape[0].length) / 2);
    const offY = i * 3 + Math.floor((3 - shape.length) / 2);
    shape.forEach((row, r) => row.forEach((v, c) => drawBlock(peekCtx, offX + c, offY + r, v, SZ)));
  });
}

function addGarbageRow() {
  if (board[0].some(v => v)) { endGame(); return; }
  board.shift();
  const hole = Math.floor(Math.random() * COLS);
  board.push(Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE)));
  // la pieza en juego sube si la fila nueva le invade el sitio
  while (collide(current.shape, current.x, current.y) && current.y > -4) current.y--;
  if (collide(current.shape, current.x, current.y)) endGame();
}

function fillPreset() {
  for (let r = ROWS - PRESET_ROWS; r < ROWS; r++) {
    const hole = Math.floor(Math.random() * COLS);
    for (let c = 0; c < COLS; c++)
      if (c !== hole && Math.random() < 0.7) board[r][c] = GARBAGE;
  }
}

function updateModeInfo() {
  const secs = ms => Math.ceil(ms / 1000);
  if (mode === 'sprint') {
    const t = secs(timeLeft);
    modeInfo.textContent = `${lines}/${SPRINT_LINES} · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  } else if (mode === 'garbage') {
    modeInfo.textContent = `Basura en ${secs(garbageLeft)}s`;
  } else {
    modeInfo.textContent = '';
  }
}

function modeTick(dt) {
  if (mode === 'sprint') {
    timeLeft = Math.max(0, timeLeft - dt);
    if (!timeLeft) endGame('TIEMPO');
  } else if (mode === 'garbage') {
    garbageLeft -= dt;
    if (garbageLeft <= 0) { garbageLeft = GARBAGE_MS; addGarbageRow(); }
  } else if (mode === 'invisible') {
    revealLeft = Math.max(0, revealLeft - dt);
  }
  updateModeInfo();
}

function openAbilityMenu() {
  if (energy < ENERGY_MAX || paused || gameOver) return;
  paused = true;
  cancelAnimationFrame(animId);
  abilityMenu.querySelector('[data-ability="undo"]').disabled = !undoSnap;
  abilityMenu.querySelector('[data-ability="hold"]').disabled = !holdUsed;
  abilityMenu.classList.remove('hidden');
}

function closeAbilityMenu() {
  abilityMenu.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  loop(lastTime);
}

// devuelve false si no se puede aplicar (no gasta energía)
function applyAbility(name) {
  if (name === 'peek') {
    peekLeft = ABILITY_MS;
  } else if (name === 'swap') {
    let type;
    do type = Math.floor(Math.random() * 7) + 1; while (type === current.type);
    const piece = makePiece(type);
    if (collide(piece.shape, current.x, current.y)) return false;
    piece.x = current.x;
    piece.y = current.y;
    current = piece;
  } else if (name === 'slow') {
    slowLeft = ABILITY_MS;
  } else if (name === 'undo') {
    if (!undoSnap) return false;
    ({ board, current, queue, score, lines, level, dropInterval, combo, b2b, hold, holdUsed } = undoSnap);
    undoSnap = null;
    drawNext();
  } else if (name === 'hold') {
    if (!holdUsed) return false;
    holdUsed = false;
  }
  return true;
}

function chooseAbility(name) {
  if (!applyAbility(name)) { beep(200, 0.15); return; }
  energy = 0;
  drawHold();
  updateHUD();
  closeAbilityMenu();
}

function endGame(title = 'GAME OVER', win = false) {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', win);
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);
  else dropAccum += dt;
  if (slowLeft > 0) slowLeft = Math.max(0, slowLeft - dt);
  modeTick(dt);
  if (gameOver) { draw(); return; }
  const showPeek = peekLeft > 0;
  if (showPeek) { peekLeft = Math.max(0, peekLeft - dt); drawPeek(); }
  peekSection.hidden = !showPeek;
  if (flash && (flash.left -= dt) <= 0) flash = null;
  if (dropAccum >= (slowLeft > 0 ? dropInterval * 2 : dropInterval)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  mode = modeSelect.value;
  levelBase = mode === 'inverse' ? INVERSE_LEVEL_BASE : 0;
  timeLeft = SPRINT_MS;
  garbageLeft = GARBAGE_MS;
  revealLeft = 0;
  board = createBoard();
  if (mode === 'preset') fillPreset();
  score = 0;
  lines = 0;
  level = 1 + levelBase;
  paused = false;
  gameOver = false;
  dropInterval = speedFor(level);
  dropAccum = 0;
  hold = null;
  freezeLeft = 0;
  energy = 0;
  slowLeft = 0;
  peekLeft = 0;
  undoSnap = null;
  combo = 0;
  b2b = false;
  lastRotate = false;
  flash = null;
  lastTime = performance.now();
  queue = Array.from({ length: QUEUE_LEN }, nextType);
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  abilityMenu.classList.add('hidden');
  overlayTitle.classList.remove('win');
  peekSection.hidden = true;
  updateModeInfo();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!audioCtx) try { audioCtx = new AudioContext(); } catch (err) {}
  if (!abilityMenu.classList.contains('hidden')) {
    const i = Number(e.key) - 1;
    if (ABILITY_KEYS[i]) chooseAbility(ABILITY_KEYS[i]);
    else if (e.code === 'Escape' || e.code === 'KeyQ') closeAbilityMenu();
    return;
  }
  if (e.code === 'KeyQ') { openAbilityMenu(); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

modeSelect.addEventListener('change', () => {
  modeSelect.blur(); // evita que las flechas/Space sigan cambiando el modo
  init();
});
// flechas/Space son del juego, no del <select>
modeSelect.addEventListener('keydown', e => {
  if (e.key.startsWith('Arrow') || e.code === 'Space') { e.preventDefault(); modeSelect.blur(); }
});

abilityMenu.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  btn.blur();
  if (btn.dataset.ability) chooseAbility(btn.dataset.ability);
  else closeAbilityMenu();
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  const styles = getComputedStyle(document.documentElement);
  themeColors.grid = styles.getPropertyValue('--grid').trim();
  themeColors.highlight = styles.getPropertyValue('--block-highlight').trim();
  themeColors.accent = styles.getPropertyValue('--accent').trim();
  // el loop está cancelado en pausa/game over: repintar manualmente
  if (current) {
    draw();
    drawNext();
    drawHold();
  }
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', theme); } catch (e) {}
  applyTheme(theme);
  themeToggle.blur(); // evita que Space (caída) active el toggle
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

init();
