/* The Final Frontier — entities: player, NPCs, enemies, projectiles, pickups, combat */
"use strict";

const ENEMY_DEFS = {
  crawler: { hp: 30,  speed: 74, dmg: 8,  xp: 10,  credits: [2, 6],   r: 12, sprite: "crawler", frames: 4, anim: 9, aggro: 240, touchCd: 0.9 },
  spitter: { hp: 26,  speed: 0,  dmg: 10, xp: 14,  credits: [3, 7],   r: 13, sprite: "spitter", frames: 2, anim: 3, aggro: 340, ranged: true, shootCd: 2.2 },
  bot:     { hp: 260, speed: 60, dmg: 16, xp: 140, credits: [40, 60], r: 16, sprite: "bot",     frames: 4, anim: 7, aggro: 480, ranged: true, shootCd: 2.6, boss: true, touchCd: 0.8 },
};

function xpForLevel(lvl) { return 30 + lvl * 25; }

function newPlayer(x, y) {
  return {
    x, y, r: 11, dir: 0, frame: 0, animT: 0, moving: false,
    hp: 100, maxhp: 100, en: 60, maxen: 60, enRegen: 4,
    level: 1, xp: 0, credits: 0,
    attackCd: 0, fireCd: 0, hurtT: 0, attackT: 0,
    hasBlaster: false, fuses: 0, blooms: 0, crawlersSlain: 0,
    dead: false,
  };
}

function spawnEnemy(def) {
  const d = ENEMY_DEFS[def.type];
  return {
    id: def.id, type: def.type, d,
    x: def.x, y: def.y, r: d.r,
    hp: d.hp, maxhp: d.hp,
    frame: 0, animT: Math.random() * 10, hurtT: 0,
    touchT: 0, shootT: 1 + Math.random(),
    dead: false, deathT: 0, flashT: 0,
  };
}

// Draw a sprite frame bottom-anchored at (x, y), centered on x
function drawSpriteFrame(canvas, x, y, dw, dh, flip) {
  const ctx = FF.ctx, cam = FF.camera;
  const dx = Math.round(x - cam.x - dw / 2), dy = Math.round(y - cam.y - dh);
  if (flip) { ctx.save(); ctx.translate(dx + dw / 2, 0); ctx.scale(-1, 1); ctx.drawImage(canvas, -dw / 2, dy, dw, dh); ctx.restore(); }
  else ctx.drawImage(canvas, dx, dy, dw, dh);
}
function drawShadow(x, y, r) {
  const ctx = FF.ctx, cam = FF.camera;
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.beginPath();
  ctx.ellipse(x - cam.x, y - cam.y, r, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- player ---------- */
function updatePlayer(dt) {
  const p = G.player;
  if (p.dead) return;
  const mv = FF.moveVector();
  const speed = 148;
  p.moving = mv.mag > 0.12;
  if (p.moving) {
    // facing: dominant axis
    if (Math.abs(mv.x) > Math.abs(mv.y)) p.dir = mv.x > 0 ? 3 : 2;
    else p.dir = mv.y > 0 ? 0 : 1;
    p.animT += dt * 9;
    p.frame = Math.floor(p.animT) % 4;
    World.moveCircle(p, mv.x * speed * dt * Math.min(1, mv.mag + 0.25), mv.y * speed * dt * Math.min(1, mv.mag + 0.25));
  } else { p.frame = 0; p.animT = 0; }

  p.attackCd = Math.max(0, p.attackCd - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.attackT = Math.max(0, p.attackT - dt);
  // energy regen
  p.en = Math.min(p.maxen, p.en + p.enRegen * dt);

  const press = FF.consumePresses();
  if (press.attack && p.attackCd <= 0) { playerMelee(); }
  if (press.fire && p.hasBlaster && p.fireCd <= 0) { playerFire(); }

  FF.updateCamera(p.x, p.y, World.W * FF.TILE, World.H * FF.TILE);

  // interact prompt
  const npc = nearestNPC(52);
  G.nearNPC = npc;
  document.getElementById("btn-talk").classList.toggle("hidden", !npc);
  if (press.interact && npc) FF.startDialogue(npc);
}

function playerMelee() {
  const p = G.player;
  p.attackCd = 0.38; p.attackT = 0.22;
  const dmg = 12 + (p.level - 1) * 4;
  const dirs = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  const [dx, dy] = dirs[p.dir];
  const cx = p.x + dx * 30, cy = p.y + dy * 30;
  FF.sfx("swing");
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (FF.dist(cx, cy, e.x, e.y) < 46 + e.r) {
      damageEnemy(e, dmg, dx * 160, dy * 160);
    }
  }
}

function playerFire() {
  const p = G.player;
  if (p.en < 10) { FF.banner("Not enough energy"); FF.sfx("deny"); return; }
  p.en -= 10; p.fireCd = 0.45;
  const dirs = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  const [dx, dy] = dirs[p.dir];
  G.projectiles.push({
    x: p.x + dx * 18, y: p.y + dy * 18 - 6,
    vx: dx * 340, vy: dy * 340, dmg: 10 + (p.level - 1) * 3,
    from: "player", r: 5, life: 1.2, color: "#38e1ff",
  });
  FF.sfx("zap");
}

function damagePlayer(dmg, sx, sy) {
  const p = G.player;
  if (p.dead || p.hurtT > 0) return;
  p.hp -= dmg; p.hurtT = 0.6;
  const d = Math.hypot(sx - p.x, sy - p.y) || 1;
  World.moveCircle(p, (p.x - sx) / d * 14, (p.y - sy) / d * 14);
  FF.sfx("hurt");
  FF.updateHUD();
  if (p.hp <= 0) { p.hp = 0; p.dead = true; FF.gameOver(); }
}

function gainXp(n) {
  const p = G.player;
  p.xp += n;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    p.maxhp += 10; p.hp = Math.min(p.maxhp, p.hp + 30);
    FF.banner("Level up! LV " + p.level);
    FF.sfx("levelup");
  }
  FF.updateHUD();
}

/* ---------- enemies ---------- */
function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) { e.deathT += dt; continue; }
    e.animT += dt * e.d.anim;
    e.frame = Math.floor(e.animT) % e.d.frames;
    e.hurtT = Math.max(0, e.hurtT - dt);
    e.touchT = Math.max(0, e.touchT - dt);
    const dist = FF.dist(e.x, e.y, p.x, p.y);
    if (dist < e.d.aggro && !p.dead) {
      if (e.d.speed > 0 && dist > e.r + p.r + 2) {
        const dx = (p.x - e.x) / dist, dy = (p.y - e.y) / dist;
        World.moveCircle(e, dx * e.d.speed * dt, dy * e.d.speed * dt);
      }
      // touch damage
      if (dist < e.r + p.r + 4 && e.touchT <= 0) {
        damagePlayer(e.d.dmg, e.x, e.y);
        e.touchT = e.d.touchCd || 0.9;
      }
      // ranged
      if (e.d.ranged) {
        e.shootT -= dt;
        if (e.shootT <= 0 && dist < e.d.aggro) {
          e.shootT = e.d.shootCd;
          enemyShoot(e, p);
        }
      }
    }
    // soft separation
    for (const o of G.enemies) {
      if (o === e || o.dead) continue;
      const dd = FF.dist(e.x, e.y, o.x, o.y);
      if (dd < e.r + o.r && dd > 0.01) {
        const push = (e.r + o.r - dd) * 0.5;
        const nx = (e.x - o.x) / dd, ny = (e.y - o.y) / dd;
        World.moveCircle(e, nx * push, ny * push);
      }
    }
  }
}

function enemyShoot(e, p) {
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const shots = e.d.boss ? [-0.25, 0, 0.25] : [0];
  for (const off of shots) {
    const a = base + off;
    G.projectiles.push({
      x: e.x, y: e.y - 6,
      vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
      dmg: e.d.dmg, from: "enemy", r: 6, life: 3,
      color: e.d.boss ? "#ff4d6d" : "#b6ff5a",
    });
  }
  FF.sfx("eshoot");
}

function damageEnemy(e, dmg, kx, ky) {
  if (e.dead) return;
  e.hp -= dmg; e.hurtT = 0.18;
  World.moveCircle(e, kx * 0.06, ky * 0.06);
  FF.sfx("hit");
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true; e.deathT = 0;
  const p = G.player;
  gainXp(e.d.xp);
  const cr = e.d.credits[0] + Math.floor(Math.random() * (e.d.credits[1] - e.d.credits[0]));
  p.credits += cr;
  FF.sfx("die");
  // drops
  const roll = Math.random();
  if (roll < 0.22) G.pickups.push({ id: "drop" + FF.time + Math.random(), type: "medkit", x: e.x, y: e.y, taken: false, bobT: 0 });
  else if (roll < 0.4) G.pickups.push({ id: "drop" + FF.time + Math.random(), type: "energy", x: e.x, y: e.y, taken: false, bobT: 0 });
  if (e.type === "crawler") { p.crawlersSlain++; FF.checkQuestProgress(); }
  if (e.d.boss) FF.bossDefeated();
  FF.updateHUD();
}

/* ---------- projectiles ---------- */
function updateProjectiles(dt) {
  const p = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    let kill = pr.life <= 0 || World.solidAt(pr.x, pr.y);
    if (!kill) {
      if (pr.from === "player") {
        for (const e of G.enemies) {
          if (!e.dead && FF.dist(pr.x, pr.y, e.x, e.y) < pr.r + e.r) {
            damageEnemy(e, pr.dmg, pr.vx * 0.25, pr.vy * 0.25);
            kill = true; break;
          }
        }
      } else if (!p.dead && FF.dist(pr.x, pr.y, p.x, p.y) < pr.r + p.r) {
        damagePlayer(pr.dmg, pr.x - pr.vx * 0.1, pr.y - pr.vy * 0.1);
        kill = true;
      }
    }
    if (kill) G.projectiles.splice(i, 1);
  }
}

/* ---------- pickups ---------- */
const PICKUP_INFO = {
  medkit:    { label: "+35 HP", color: "#ff5a6e" },
  energy:    { label: "+30 EN", color: "#38e1ff" },
  credits:   { label: "+credits", color: "#ffd76a" },
  fuse:      { label: "Fuse cell", color: "#ffb400" },
  bloom_pick:{ label: "Glowbloom", color: "#ff7ad9" },
};
function updatePickups(dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.bobT = (pk.bobT || 0) + dt;
    const d = FF.dist(p.x, p.y, pk.x, pk.y);
    if (d < 30 && !p.dead) { // magnet
      pk.x += (p.x - pk.x) * dt * 6; pk.y += (p.y - pk.y) * dt * 6;
    }
    if (d < 16 && !p.dead) collectPickup(pk);
  }
}
function collectPickup(pk) {
  const p = G.player;
  pk.taken = true;
  FF.sfx("pickup");
  switch (pk.type) {
    case "medkit": p.hp = Math.min(p.maxhp, p.hp + 35); FF.banner("+35 HP"); break;
    case "energy": p.en = Math.min(p.maxen, p.en + 30); FF.banner("+30 energy"); break;
    case "credits": { const c = 8 + Math.floor(Math.random() * 10); p.credits += c; FF.banner("+" + c + " credits"); break; }
    case "fuse": p.fuses++; FF.banner("Fuse cell acquired (" + p.fuses + "/3)"); FF.checkQuestProgress(); break;
    case "bloom_pick": p.blooms++; FF.banner("Glowbloom sampled (" + p.blooms + "/4)"); FF.checkQuestProgress(); break;
  }
  FF.updateHUD();
}

/* ---------- NPCs ---------- */
function nearestNPC(maxD) {
  let best = null, bd = maxD;
  for (const n of G.npcStates) {
    const d = FF.dist(G.player.x, G.player.y, n.x, n.y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/* ---------- rendering entities ---------- */
function renderEntities(ctx) {
  const p = G.player;
  // pickups
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(pk.bobT * 4) * 3;
    const info = PICKUP_INFO[pk.type];
    drawShadow(pk.x, pk.y, 8);
    ctx.fillStyle = info.color;
    const x = pk.x - FF.camera.x, y = pk.y - FF.camera.y + bob;
    if (pk.type === "fuse") { ctx.fillRect(x - 5, y - 16, 10, 12); ctx.fillStyle = "#fff"; ctx.fillRect(x - 2, y - 13, 4, 3); }
    else if (pk.type === "bloom_pick") { ctx.beginPath(); ctx.arc(x, y - 10, 7, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y - 10, 8, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(x - 3, y - 13, 6, 2); }
  }
  // NPCs
  for (const n of G.npcStates) {
    const a = FF.assets[n.sprite];
    drawShadow(n.x, n.y, 11);
    drawSpriteFrame(a.canvas, n.x, n.y, 40, 40 * a.h / a.w);
    if (G.nearNPC === n) { // "!" marker
      const x = n.x - FF.camera.x, y = n.y - FF.camera.y - 52 + Math.sin(FF.time * 5) * 3;
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("!", x, y);
    }
  }
  // enemies (y-sorted with player below)
  const drawables = [];
  for (const e of G.enemies) drawables.push({ y: e.y, e });
  drawables.push({ y: p.y + 0.5, p: true });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    if (d.p) renderPlayer(ctx);
    else renderEnemy(ctx, d.e);
  }
  // projectiles
  for (const pr of G.projectiles) {
    const x = pr.x - FF.camera.x, y = pr.y - FF.camera.y;
    ctx.fillStyle = pr.color;
    ctx.shadowColor = pr.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, pr.r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function renderPlayer(ctx) {
  const p = G.player;
  if (p.dead) return;
  if (p.hurtT > 0 && Math.floor(FF.time * 20) % 2 === 0) return; // i-frame blink
  const A = FF.assets.player;
  const scale = 46 / A.fh;
  const dw = A.fw * scale, dh = 46;
  drawShadow(p.x, p.y, 11);
  drawSpriteFrame(A.frames[p.dir][p.frame], p.x, p.y, dw, dh);
  // melee swing arc
  if (p.attackT > 0) {
    const dirs = [[0, 1], [0, -1], [-1, 0], [1, 0]];
    const [dx, dy] = dirs[p.dir];
    const x = p.x - FF.camera.x + dx * 30, y = p.y - FF.camera.y + dy * 30 - 8;
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 5;
    ctx.beginPath();
    const base = Math.atan2(dy, dx);
    ctx.arc(x, y, 22, base - 0.9, base + 0.9);
    ctx.stroke();
  }
}

const tintCache = new WeakMap();
function tintedRed(frameCanvas) {
  let t = tintCache.get(frameCanvas);
  if (!t) {
    t = document.createElement("canvas");
    t.width = frameCanvas.width; t.height = frameCanvas.height;
    const g = t.getContext("2d");
    g.drawImage(frameCanvas, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "rgba(255,70,80,.9)";
    g.fillRect(0, 0, t.width, t.height);
    tintCache.set(frameCanvas, t);
  }
  return t;
}

function renderEnemy(ctx, e) {
  if (e.dead && e.deathT > 0.35) return;
  const A = FF.assets[e.d.sprite];
  const h = e.d.boss ? 56 : 40;
  const scale = h / A.fh, dw = A.fw * scale;
  if (e.dead) { // fade out
    ctx.globalAlpha = Math.max(0, 1 - e.deathT * 3);
  }
  drawShadow(e.x, e.y, e.r);
  const frame = A.frames[0][e.frame % A.frames[0].length];
  drawSpriteFrame(e.hurtT > 0 ? tintedRed(frame) : frame, e.x, e.y, dw, h);
  ctx.globalAlpha = 1;
  // hp bar for damaged enemies / boss
  if (!e.dead && (e.hp < e.maxhp)) {
    const w = e.d.boss ? 64 : 30;
    const x = e.x - FF.camera.x - w / 2, y = e.y - FF.camera.y - h - 10;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = e.d.boss ? "#ff4d6d" : "#ffb400";
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxhp), 5);
  }
}
