/* The Final Frontier — world: map generation, collision, placements */
"use strict";
const World = {
  W: 110, H: 80,
  map: null,
  npcs: [], pickups: [], enemySpawns: [],
};

function wset(x, y, t) {
  if (x < 0 || y < 0 || x >= World.W || y >= World.H) return;
  World.map[y * World.W + x] = t;
}
function wrect(x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wset(x, y, t);
}
// hollow rectangle of walls with floor inside
function building(x0, y0, x1, y1, doorX, doorY) {
  wrect(x0, y0, x1, y1, T.FLOOR);
  for (let x = x0; x <= x1; x++) { wset(x, y0, T.WALL); wset(x, y1, T.WALL); }
  for (let y = y0; y <= y1; y++) { wset(x0, y, T.WALL); wset(x1, y, T.WALL); }
  wset(doorX, doorY, T.DOOR);
}

World.build = function () {
  const R = FF.seededRand;
  World.map = new Uint8Array(World.W * World.H);
  World.npcs = []; World.pickups = []; World.enemySpawns = [];

  // base: alien grass with scrub patches
  for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) {
    wset(x, y, R() < 0.22 ? T.GRASS2 : T.GRASS);
  }
  // decorative blooms
  for (let i = 0; i < 60; i++) wset(2 + Math.floor(R() * 106), 34 + Math.floor(R() * 44), T.BLOOM);

  // rock clusters
  for (let i = 0; i < 26; i++) {
    const cx = 44 + Math.floor(R() * 60), cy = 34 + Math.floor(R() * 42);
    const n = 2 + Math.floor(R() * 4);
    for (let j = 0; j < n; j++) wset(cx + Math.floor(R() * 5) - 2, cy + Math.floor(R() * 5) - 2, T.ROCK);
  }
  // crystal groves
  const groves = [[52, 44], [74, 50], [62, 66]];
  for (const [gx, gy] of groves)
    for (let j = 0; j < 7; j++) wset(gx + Math.floor(R() * 7) - 3, gy + Math.floor(R() * 7) - 3, T.CRYSTAL);

  // lake (east-central)
  for (let y = 48; y < 64; y++) for (let x = 62; x < 80; x++) {
    const dx = (x - 71) / 8, dy = (y - 56) / 6;
    if (dx * dx + dy * dy < 1) wset(x, y, T.WATER);
  }

  // ---- colony compound ----
  wrect(8, 8, 38, 30, T.FLOOR);
  building(10, 10, 18, 16, 14, 16);   // command center
  building(22, 10, 30, 16, 26, 16);   // medbay
  building(10, 20, 18, 26, 14, 20);   // workshop
  wrect(30, 22, 38, 30, T.PAD);       // landing pad
  // consoles inside buildings
  wset(11, 11, T.CONSOLE); wset(17, 11, T.CONSOLE);
  wset(23, 11, T.CONSOLE); wset(29, 11, T.CONSOLE);
  wset(11, 25, T.CONSOLE); wset(17, 25, T.CONSOLE);

  // ---- paths ----
  for (let y = 30; y <= 46; y++) for (let x = 22; x <= 24; x++) wset(x, y, T.PATH); // south exit
  for (let x = 38; x <= 88; x++) for (let y = 58; y <= 60; y++) wset(x, y, T.PATH); // east road
  for (let x = 22; x <= 24; x++) for (let y = 46; y <= 58; y++) wset(x, y, T.PATH);
  for (let y = 58; y <= 60; y++) for (let x = 24; x <= 38; x++) wset(x, y, T.PATH);

  // ---- ruins (far east) ----
  wrect(88, 50, 104, 70, T.RUIN_FLOOR);
  // broken wall segments
  for (let x = 90; x <= 98; x++) wset(x, 52, T.RUIN_WALL);
  for (let x = 96; x <= 104; x++) wset(x, 68, T.RUIN_WALL);
  for (let y = 54; y <= 62; y++) wset(102, y, T.RUIN_WALL);
  wset(94, 52, T.RUIN_FLOOR); // gap
  wset(100, 68, T.RUIN_FLOOR);

  // ---- NPCs (tile coords -> px center) ----
  const P = (tx, ty) => ({ x: tx * FF.TILE + 16, y: ty * FF.TILE + 16 });
  World.npcs = [
    { id: "voss", name: "Commander Voss", sprite: "commander", ...P(14, 12) },
    { id: "chen", name: "Medic Chen", sprite: "medic", ...P(26, 12) },
    { id: "diaz", name: "Engineer Diaz", sprite: "engineer", ...P(14, 24) },
  ];

  // ---- pickups ----
  let pid = 0;
  const pk = (type, tx, ty) => World.pickups.push({ id: "pk" + (pid++), type, ...P(tx, ty), taken: false });
  pk("fuse", 50, 40); pk("fuse", 64, 30); pk("fuse", 44, 58);
  pk("bloom_pick", 58, 48); pk("bloom_pick", 72, 38); pk("bloom_pick", 48, 66); pk("bloom_pick", 80, 60);
  pk("medkit", 36, 34); pk("energy", 40, 52); pk("credits", 55, 55);

  // ---- enemies ----
  let eid = 0;
  const sp = (type, tx, ty) => World.enemySpawns.push({ id: "e" + (eid++), type, ...P(tx, ty) });
  const crawlerSpots = [[46, 42], [52, 52], [58, 36], [66, 44], [48, 62], [72, 56], [60, 68], [76, 40], [54, 60], [68, 64]];
  for (const [x, y] of crawlerSpots) sp("crawler", x, y);
  const spitterSpots = [[53, 45], [75, 51], [63, 67], [84, 58]];
  for (const [x, y] of spitterSpots) sp("spitter", x, y);
  sp("bot", 96, 60); // rogue unit — ruins arena
};

World.solidAt = function (px, py) {
  const tx = Math.floor(px / FF.TILE), ty = Math.floor(py / FF.TILE);
  if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return true;
  return TILE_SOLID.has(World.map[ty * World.W + tx]);
};
// Axis-separated circle-vs-tile collision. Moves e {x,y,r} by (dx,dy), sliding on walls.
World.moveCircle = function (e, dx, dy) {
  const r = e.r, S = FF.TILE;
  let nx = e.x + dx;
  const yT = e.y - r + 2, yB = e.y + r - 2;
  if (dx > 0 && (World.solidAt(nx + r, yT) || World.solidAt(nx + r, e.y) || World.solidAt(nx + r, yB)))
    nx = Math.floor((nx + r) / S) * S - r - 0.01;
  else if (dx < 0 && (World.solidAt(nx - r, yT) || World.solidAt(nx - r, e.y) || World.solidAt(nx - r, yB)))
    nx = (Math.floor((nx - r) / S) + 1) * S + r + 0.01;
  e.x = nx;
  let ny = e.y + dy;
  const xL = e.x - r + 2, xR = e.x + r - 2;
  if (dy > 0 && (World.solidAt(xL, ny + r) || World.solidAt(e.x, ny + r) || World.solidAt(xR, ny + r)))
    ny = Math.floor((ny + r) / S) * S - r - 0.01;
  else if (dy < 0 && (World.solidAt(xL, ny - r) || World.solidAt(e.x, ny - r) || World.solidAt(xR, ny - r)))
    ny = (Math.floor((ny - r) / S) + 1) * S + r + 0.01;
  e.y = ny;
};

World.render = function (ctx) {
  const T32 = FF.TILE, cam = FF.camera;
  const x0 = Math.max(0, Math.floor(cam.x / T32)), y0 = Math.max(0, Math.floor(cam.y / T32));
  const x1 = Math.min(World.W - 1, Math.ceil((cam.x + FF.W) / T32));
  const y1 = Math.min(World.H - 1, Math.ceil((cam.y + FF.H) / T32));
  const waterV = Math.floor(FF.time * 1.6) % 2;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const id = World.map[ty * World.W + tx];
    let v = (tx * 7 + ty * 13) % 3;
    if (id === T.WATER) v = waterV;
    ctx.drawImage(getTile(id, v), tx * T32 - cam.x, ty * T32 - cam.y);
  }
};
