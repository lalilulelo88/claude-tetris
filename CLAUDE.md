# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no linter, no tests. The README is in Spanish and so is the UI text.

## Running

Open `index.html` directly, or serve the folder statically (e.g. `python3 -m http.server 8000`).

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, loaded as a plain script with global state).

- `game.js` uses module-level `let` state (`board`, `current`, `next`, `score`, ...) reset by `init()`. The restart button calls `init()`.
- Board is a `ROWS x COLS` matrix of 0 or a color/piece index 1-7. `COLORS` and `PIECES` are indexed by that same number.
- The `requestAnimationFrame` `loop` accumulates time and drops the piece when `dropAccum >= dropInterval`. Pause and game over stop it with `cancelAnimationFrame(animId)`; unpausing restarts it by calling `loop` directly.
- Piece lifecycle: `lockPiece()` = `merge()` -> `clearLines()` -> `spawn()`. `spawn()` calls `endGame()` if the new piece collides immediately.
- Canvas size is hardcoded in `index.html` (`300x600` board, `120x120` next). If you change `COLS`, `ROWS` or `BLOCK` in `game.js`, update those attributes to match.
- Level/speed rules live in `clearLines()`: level = `floor(lines/10)+1`, `dropInterval = max(100, 1000 - (level-1)*90)`.
