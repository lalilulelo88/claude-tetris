# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no linter, no tests. The README is in Spanish and so is the UI text.

## Running

Open `index.html` directly, or serve the folder statically (e.g. `python3 -m http.server 8000`).

## Architecture

Three files: `index.html` (DOM + canvases: board, next, hold, peek), `style.css`, and `game.js` (all logic, loaded as a plain script with global state).

- `game.js` uses module-level `let` state (`board`, `current`, `queue`, `score`, ...) reset by `init()`. The restart button calls `init()`.
- Board is a `ROWS x COLS` matrix of 0 or a color/piece index. `COLORS` and `PIECES` are indexed by that same number: 1-7 tetrominoes, 8-12 special pieces (+, U, Y, 1x1, hollow 3x3), 13-17 power-ups (1x1, never merged into the board), `WILD` = 18 (wildcard block: counts as filled for lines, pieces can pass through it), `GARBAGE` = 19.
- The `requestAnimationFrame` `loop` accumulates time and drops the piece when `dropAccum >= dropInterval`. Pause and game over stop it with `cancelAnimationFrame(animId)`; unpausing restarts it by calling `loop` directly.
- Piece lifecycle: `lockPiece()` = snapshot for undo -> `merge()` -> `clearLines()` (only removes rows, returns the count) -> `scoreLock()` (score, combo, T-spin, B2B, perfect clear, level, energy) -> `spawn()`. Power-up pieces go through `lockPower()` instead. `spawn()` calls `endGame()` if the new piece collides immediately.
- Upcoming pieces live in `queue` (types, `QUEUE_LEN` long, `queue[0]` = next). `nextType()` draws a random type; rewards (single after a Tetris, power-up every 5 lines) are inserted with `queueReward()`.
- `loop` must not reschedule itself once `gameOver` is set (`endGame()` runs inside `loop` via `lockPiece()`).
- Hold: `hold` (type) + `holdUsed`, reset in `spawn()`. Abilities: `energy` fills 10 per cleared line; `Q` opens `#ability-menu` (pauses the loop), keys 1-5 pick one (`applyAbility()`).
- Challenge modes: `#mode-select` value is `mode` (`classic`, `sprint`, `garbage`, `preset`, `invisible`, `inverse`), read by `init()`. Per-frame mode logic is in `modeTick()`. Timers (`freezeLeft`, `slowLeft`, `peekLeft`, `timeLeft`, `garbageLeft`, `revealLeft`) count down in game time inside `loop`, so they respect pause.
- Canvas size is hardcoded in `index.html` (`300x600` board, `120x120` next and hold, `70x210` peek). If you change `COLS`, `ROWS` or `BLOCK` in `game.js`, update those attributes to match.
- Theming: colors are CSS variables in `style.css` (`:root` = dark, `[data-theme="light"]` = light). `applyTheme()` in `game.js` sets `data-theme`, caches canvas colors (`--grid`, `--block-highlight`) in `themeColors`, and redraws manually (the loop is cancelled while paused/game over). An inline script in `<head>` sets the theme from `localStorage` before first paint. `init()` does not touch the theme.
- Level/speed rules live in `scoreLock()`: level = `floor(lines/10)+1+levelBase` (`levelBase` is 4 in `inverse` mode), `dropInterval = speedFor(level) = max(100, 1000 - (level-1)*90)`.
