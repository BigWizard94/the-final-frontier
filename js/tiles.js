/* The Final Frontier — procedural tile art (painted once to offscreen canvases) */
"use strict";
// Tile IDs
const T = {
  VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, PAD: 4,
  GRASS: 5, GRASS2: 6, ROCK: 7, CRYSTAL: 8, WATER: 9,
  PATH: 10, RUIN_FLOOR: 11, RUIN_WALL: 12, BLOOM: 13, CONSOLE: 14,
};
const TILE_SOLID = new Set([T.WALL, T.ROCK, T.CRYSTAL, T.WATER, T.RUIN_WALL, T.CONSOLE]);
const TILE_DEFS = {
  [T.VOID]:       { name: "void" },
  [T.FLOOR]:      { name: "colony floor" },
  [T.WALL]:       { name: "colony wall" },
  [T.DOOR]:       { name: "door" },
  [T.PAD]:        { name: "landing pad" },
  [T.GRASS]:      { name: "alien grass", variants: 3 },
  [T.GRASS2]:     { name: "alien scrub", variants: 3 },
  [T.ROCK]:       { name: "rock" },
  [T.CRYSTAL]:    { name: "crystal" },
  [T.WATER]:      { name: "water", variants: 2 },
  [T.PATH]:       { name: "dirt path", variants: 2 },
  [T.RUIN_FLOOR]: { name: "ruin floor", variants: 2 },
  [T.RUIN_WALL]:  { name: "ruin wall" },
  [T.BLOOM]:      { name: "glowbloom", variants: 2 },
  [T.CONSOLE]:    { name: "console" },
};

function tileCanvas() {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  return [c, c.getContext("2d")];
}
// deterministic per-tile randomness
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 974634) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const TilePainters = {
  [T.VOID](x, v) { const [c, g] = tileCanvas(); g.fillStyle = "#05030f"; g.fillRect(0, 0, 32, 32); return c; },

  [T.FLOOR](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#3a3f5e"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#434a6b"; g.fillRect(1, 1, 30, 30);
    g.strokeStyle = "#2b2f48"; g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, 31, 31);
    g.fillStyle = "#565d85";
    for (const [rx, ry] of [[4, 4], [27, 4], [4, 27], [27, 27]]) { g.fillRect(rx, ry, 2, 2); }
    if (hash2(v, 7, 1) > 0.6) { g.fillStyle = "#2f3450"; g.fillRect(6, 14, 20, 2); }
    return c;
  },

  [T.WALL](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#232742"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#5b648f"; g.fillRect(0, 0, 32, 10);       // top face
    g.fillStyle = "#7c86b8"; g.fillRect(0, 0, 32, 3);        // highlight
    g.fillStyle = "#39406b"; g.fillRect(0, 10, 32, 22);      // front face
    g.fillStyle = "#2c3157";
    for (let i = 0; i < 32; i += 8) g.fillRect(i, 12, 2, 18);
    g.fillStyle = "#38e1ff"; g.fillRect(4, 20, 8, 2);        // status light strip
    if (hash2(v, 3, 9) > 0.75) { g.fillStyle = "#ffd76a"; g.fillRect(20, 20, 3, 3); }
    return c;
  },

  [T.DOOR](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#2c3157"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#8f9bd0"; g.fillRect(2, 2, 28, 28);
    g.fillStyle = "#2c3157"; g.fillRect(15, 2, 2, 28);       // seam
    g.fillStyle = "#38e1ff"; g.fillRect(6, 6, 4, 4); g.fillRect(22, 6, 4, 4);
    return c;
  },

  [T.PAD](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#262a44"; g.fillRect(0, 0, 32, 32);
    g.strokeStyle = "#3d4368"; g.lineWidth = 2; g.strokeRect(2, 2, 28, 28);
    g.fillStyle = "#c9a227";
    g.fillRect(4, 4, 8, 3); g.fillRect(20, 25, 8, 3);       // chevrons
    if (hash2(v, 5, 2) > 0.5) { g.fillStyle = "#38e1ff"; g.fillRect(14, 14, 4, 4); }
    return c;
  },

  [T.GRASS](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#3d2b63"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#463371"; g.fillRect(0, 0, 32, 16);
    g.fillStyle = "#4f7d6a";
    for (let i = 0; i < 9; i++) {
      const px = Math.floor(hash2(v, i, 11) * 30), py = Math.floor(hash2(i, v, 12) * 28) + 2;
      g.fillRect(px, py, 2, 4);
    }
    g.fillStyle = "#6fae96";
    for (let i = 0; i < 4; i++) {
      const px = Math.floor(hash2(v, i, 13) * 30);
      g.fillRect(px, Math.floor(hash2(i, v, 14) * 28) + 2, 1, 3);
    }
    return c;
  },

  [T.GRASS2](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#33244f"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#5b3f7d";
    for (let i = 0; i < 7; i++) {
      const px = Math.floor(hash2(v, i, 21) * 28) + 2, py = Math.floor(hash2(i, v, 22) * 28) + 2;
      g.fillRect(px, py, 3, 3);
    }
    g.fillStyle = "#7d5ba6";
    for (let i = 0; i < 4; i++) {
      const px = Math.floor(hash2(v, i, 23) * 30);
      g.fillRect(px, Math.floor(hash2(i, v, 24) * 28) + 2, 2, 2);
    }
    return c;
  },

  [T.ROCK](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#3d2b63"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#5c4a7d";
    g.beginPath(); g.moveTo(4, 28); g.lineTo(8, 10); g.lineTo(18, 4); g.lineTo(28, 14); g.lineTo(26, 28); g.closePath(); g.fill();
    g.fillStyle = "#7a639e";
    g.beginPath(); g.moveTo(8, 26); g.lineTo(11, 12); g.lineTo(18, 7); g.lineTo(22, 14); g.lineTo(20, 26); g.closePath(); g.fill();
    g.fillStyle = "#463a63"; g.fillRect(4, 28, 24, 4);
    return c;
  },

  [T.CRYSTAL](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#33244f"; g.fillRect(0, 0, 32, 32);
    const shard = (bx, h, w, col) => {
      g.fillStyle = col;
      g.beginPath(); g.moveTo(bx, 30); g.lineTo(bx + w / 2, 30 - h); g.lineTo(bx + w, 30); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(bx + w / 2 - 1, 30 - h + 2, 2, h - 4);
    };
    shard(4, 18, 8, "#38e1ff"); shard(14, 26, 9, "#7a5cff"); shard(23, 14, 6, "#38e1ff");
    return c;
  },

  [T.WATER](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#123a5e"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#1b5a8a"; g.fillRect(0, 0, 32, 14);
    g.fillStyle = "#38b6ff";
    const off = (v % 2) * 8;
    for (let i = 0; i < 3; i++) g.fillRect(((i * 13 + off) % 30) + 1, 6 + i * 8, 8, 2);
    return c;
  },

  [T.PATH](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#4a3a5e"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#57456e"; g.fillRect(0, 0, 32, 16);
    g.fillStyle = "#463a58";
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(hash2(v, i, 31) * 28) + 2, Math.floor(hash2(i, v, 32) * 28) + 2, 3, 2);
    return c;
  },

  [T.RUIN_FLOOR](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#2c2340"; g.fillRect(0, 0, 32, 32);
    g.strokeStyle = "#241c36"; g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, 15, 15); g.strokeRect(16.5, 16.5, 15, 15);
    g.fillStyle = "#38e1ff";
    if (hash2(v, 9, 41) > 0.72) { g.fillRect(7, 7, 2, 2); g.fillRect(22, 22, 2, 2); }
    return c;
  },

  [T.RUIN_WALL](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#1b1530"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#4a3f6e"; g.fillRect(0, 0, 32, 12);
    g.fillStyle = "#6a5c96"; g.fillRect(0, 0, 32, 3);
    g.fillStyle = "#332b52"; g.fillRect(0, 12, 32, 20);
    g.fillStyle = "#241e40";
    for (let i = 4; i < 32; i += 10) g.fillRect(i, 14, 2, 16);
    g.fillStyle = "#7a5cff"; g.fillRect(6, 18, 4, 2);
    return c;
  },

  [T.BLOOM](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#3d2b63"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#4f7d6a"; g.fillRect(15, 16, 2, 12);
    const cols = ["#ff7ad9", "#ffd76a"];
    g.fillStyle = cols[v % 2];
    g.fillRect(11, 8, 10, 8);
    g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(13, 10, 3, 3);
    return c;
  },

  [T.CONSOLE](x, v) {
    const [c, g] = tileCanvas();
    g.fillStyle = "#3a3f5e"; g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#232742"; g.fillRect(4, 14, 24, 14);
    g.fillStyle = "#0e2a3a"; g.fillRect(6, 4, 20, 10);
    g.fillStyle = "#38e1ff"; g.fillRect(8, 6, 10, 2); g.fillRect(8, 9, 6, 2);
    g.fillStyle = "#ff4d6d"; g.fillRect(22, 6, 2, 2);
    g.fillStyle = "#7c86b8"; g.fillRect(4, 26, 24, 2);
    return c;
  },
};

// Pre-render cache: key `${id}:${variant}`
const tileCache = new Map();
function getTile(id, variant) {
  const def = TILE_DEFS[id] || TILE_DEFS[T.VOID];
  const nv = def.variants || 1;
  const v = ((variant % nv) + nv) % nv;
  const key = id + ":" + v;
  if (!tileCache.has(key)) tileCache.set(key, TilePainters[id](0, v));
  return tileCache.get(key);
}
