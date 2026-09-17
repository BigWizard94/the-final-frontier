/* The Final Frontier — core engine: assets, input, camera, main loop */
"use strict";
const FF = {
  TILE: 32,
  canvas: null, ctx: null,
  W: 0, H: 0, DPR: 1,
  time: 0,
  state: "title", // title | play | dialogue | gameover | victory
  assets: {},
};

FF.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
FF.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
FF.rand = (a, b) => a + Math.random() * (b - a);
// Deterministic PRNG for worldgen
FF.seededRand = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(1337);

/* ---------------- Assets ---------------- */
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
// White -> transparent (threshold), returns canvas.
// Falls back to the unkeyed image if pixel access is blocked.
function chromaKey(img, thresh = 248) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  try {
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i] > thresh && p[i + 1] > thresh && p[i + 2] > thresh) p[i + 3] = 0;
    }
    x.putImageData(d, 0, 0);
  } catch (e) { /* tainted canvas: use image as-is */ }
  return c;
}
// Slice a sheet canvas into rows x cols frame canvases
function sliceSheet(sheet, rows, cols) {
  const fw = Math.floor(sheet.width / cols), fh = Math.floor(sheet.height / rows);
  const frames = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let col = 0; col < cols; col++) {
      const c = document.createElement("canvas");
      c.width = fw; c.height = fh;
      c.getContext("2d").drawImage(sheet, col * fw, r * fh, fw, fh, 0, 0, fw, fh);
      row.push(c);
    }
    frames.push(row);
  }
  return { frames, fw, fh };
}
// Trim transparent borders -> {canvas, w, h}.
// If pixel access is blocked (e.g. file:// canvas tainting), returns the
// canvas untrimmed instead of throwing.
function trimCanvas(c) {
  try {
    const x = c.getContext("2d", { willReadFrequently: true });
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
      if (d[(j * c.width + i) * 4 + 3] > 8) {
        if (i < minX) minX = i; if (i > maxX) maxX = i;
        if (j < minY) minY = j; if (j > maxY) maxY = j;
      }
    }
    if (maxX < 0) return { canvas: c, w: c.width, h: c.height };
    const t = document.createElement("canvas");
    t.width = maxX - minX + 1; t.height = maxY - minY + 1;
    t.getContext("2d").drawImage(c, minX, minY, t.width, t.height, 0, 0, t.width, t.height);
    return { canvas: t, w: t.width, h: t.height };
  } catch (e) {
    return { canvas: c, w: c.width, h: c.height };
  }
}

// Trim every frame, then re-center all frames on the sheet's max trimmed
// size so per-frame padding is gone but the grid stays uniform.
function tightFrames(entry) {
  const trimmed = entry.frames.map(row => row.map(c => trimCanvas(c)));
  let mw = 1, mh = 1;
  for (const row of trimmed) for (const t of row) { mw = Math.max(mw, t.w); mh = Math.max(mh, t.h); }
  entry.frames = trimmed.map(row => row.map(t => {
    const c = document.createElement("canvas");
    c.width = mw; c.height = mh;
    c.getContext("2d").drawImage(t.canvas, Math.round((mw - t.w) / 2), Math.round((mh - t.h) / 2));
    return c;
  }));
  entry.fw = mw; entry.fh = mh;
  return entry;
}

FF.loadAssets = async function (onProgress) {
  const defs = {
    player:   { file: "player.png",        rows: 4, cols: 4 },
    crawler:  { file: "enemy_crawler.png", rows: 1, cols: 4 },
    spitter:  { file: "enemy_spitter.png", rows: 1, cols: 2 },
    bot:      { file: "enemy_bot.png",     rows: 1, cols: 4 },
    commander:{ file: "npc_commander.png", rows: 1, cols: 1, trim: true },
    engineer: { file: "npc_engineer.png",  rows: 1, cols: 1, trim: true },
    medic:    { file: "npc_medic.png",     rows: 1, cols: 1, trim: true },
  };
  const keys = Object.keys(defs);
  let done = 0;
  for (const k of keys) {
    const img = await loadImage("assets/" + defs[k].file);
    const keyed = chromaKey(img);
    let entry;
    if (defs[k].trim) {
      entry = trimCanvas(keyed);
      entry.frames = [[entry.canvas]]; entry.fw = entry.w; entry.fh = entry.h;
    } else {
      entry = tightFrames(sliceSheet(keyed, defs[k].rows, defs[k].cols));
    }
    FF.assets[k] = entry;
    done++; if (onProgress) onProgress(done / keys.length);
  }
};

/* ---------------- Input ---------------- */
FF.input = {
  keys: {},
  joy: { active: false, id: null, dx: 0, dy: 0 },
  attackQueued: false, fireQueued: false, interactQueued: false,
};
function isTouchDevice() { return "ontouchstart" in window || navigator.maxTouchPoints > 0; }
FF.isTouch = isTouchDevice();

FF.initInput = function () {
  const I = FF.input;
  window.addEventListener("keydown", e => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    I.keys[e.key.toLowerCase()] = true;
    if (e.key === " " || e.key.toLowerCase() === "j") I.attackQueued = true;
    if (e.key.toLowerCase() === "k") I.fireQueued = true;
    if (e.key.toLowerCase() === "e") I.interactQueued = true;
    if (e.key === "Enter" && FF.state === "dialogue") FF.advanceDialogue();
  });
  window.addEventListener("keyup", e => { I.keys[e.key.toLowerCase()] = false; });

  if (!FF.isTouch) return;
  document.getElementById("touch").classList.remove("hidden");
  const joy = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  const JR = 52;
  const setStick = (dx, dy) => { stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  joy.addEventListener("touchstart", e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    I.joy.active = true; I.joy.id = t.identifier;
    joy._cx = joy.getBoundingClientRect().left + 64;
    joy._cy = joy.getBoundingClientRect().top + 64;
  }, { passive: false });
  const joyMove = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== I.joy.id) continue;
      let dx = t.clientX - joy._cx, dy = t.clientY - joy._cy;
      const m = Math.hypot(dx, dy);
      if (m > JR) { dx = dx / m * JR; dy = dy / m * JR; }
      I.joy.dx = dx / JR; I.joy.dy = dy / JR;
      setStick(dx, dy);
    }
  };
  const joyEnd = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== I.joy.id) continue;
      I.joy.active = false; I.joy.id = null; I.joy.dx = 0; I.joy.dy = 0;
      setStick(0, 0);
    }
  };
  joy.addEventListener("touchmove", e => { e.preventDefault(); joyMove(e); }, { passive: false });
  joy.addEventListener("touchend", joyEnd); joy.addEventListener("touchcancel", joyEnd);

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", e => { e.preventDefault(); fn(); }, { passive: false });
  };
  bind("btn-attack", () => { I.attackQueued = true; });
  bind("btn-fire", () => { I.fireQueued = true; });
  bind("btn-talk", () => { I.interactQueued = true; });
  document.getElementById("dialogue").addEventListener("touchstart", e => {
    e.preventDefault(); FF.advanceDialogue();
  }, { passive: false });
};

// Normalized movement vector from keys + joystick
FF.moveVector = function () {
  const I = FF.input, k = I.keys;
  let x = 0, y = 0;
  if (k["a"] || k["arrowleft"]) x -= 1;
  if (k["d"] || k["arrowright"]) x += 1;
  if (k["w"] || k["arrowup"]) y -= 1;
  if (k["s"] || k["arrowdown"]) y += 1;
  if (I.joy.active) { x += I.joy.dx; y += I.joy.dy; }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x, y, mag: Math.min(1, m) };
};
FF.consumePresses = function () {
  const I = FF.input;
  const p = { attack: I.attackQueued, fire: I.fireQueued, interact: I.interactQueued };
  I.attackQueued = I.fireQueued = I.interactQueued = false;
  return p;
};

/* ---------------- Camera ---------------- */
FF.camera = { x: 0, y: 0 };
FF.updateCamera = function (tx, ty, worldW, worldH) {
  const c = FF.camera;
  const wantX = tx - FF.W / 2, wantY = ty - FF.H / 2;
  c.x += (wantX - c.x) * 0.12; c.y += (wantY - c.y) * 0.12;
  c.x = FF.clamp(c.x, 0, Math.max(0, worldW - FF.W));
  c.y = FF.clamp(c.y, 0, Math.max(0, worldH - FF.H));
};

/* ---------------- Canvas / loop ---------------- */
FF.resize = function () {
  FF.DPR = Math.min(2, window.devicePixelRatio || 1);
  FF.W = window.innerWidth; FF.H = window.innerHeight;
  FF.canvas.width = FF.W * FF.DPR; FF.canvas.height = FF.H * FF.DPR;
  FF.ctx.setTransform(FF.DPR, 0, 0, FF.DPR, 0, 0);
  FF.ctx.imageSmoothingEnabled = false;
};

FF.boot = function (update, render) {
  FF.canvas = document.getElementById("game");
  FF.ctx = FF.canvas.getContext("2d");
  FF.resize();
  window.addEventListener("resize", FF.resize);
  FF.initInput();
  let last = performance.now();
  const frame = now => {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    FF.time += dt;
    if (FF.state === "play") update(dt);
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};
