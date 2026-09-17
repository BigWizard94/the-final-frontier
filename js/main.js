/* The Final Frontier — game state, quests, dialogue, HUD, save, boot */
"use strict";

let G = null;

const QUESTS = {
  fuse:  { title: "Lights On", giver: "Commander Voss" },
  nest:  { title: "Nest Clear", giver: "Engineer Diaz" },
  flora: { title: "Field Medicine", giver: "Medic Chen" },
  bot:   { title: "Rogue Unit", giver: "Commander Voss" },
};
function questObjective() {
  const q = G.quest, p = G.player;
  if (q.id === "none") return null;
  if (q.id === "fuse" && q.stage === "active") return `Recover fuse cells ${Math.min(3, p.fuses)}/3`;
  if (q.id === "nest" && q.stage === "active") return `Defeat crawlers ${Math.min(6, p.crawlersSlain)}/6`;
  if (q.id === "flora" && q.stage === "active") return `Sample glowblooms ${Math.min(4, p.blooms)}/4`;
  if (q.id === "bot" && q.stage === "active") return "Destroy rogue unit SB-7 in the eastern ruins";
  if (q.stage === "turnin") return `Return to ${QUESTS[q.id].giver}`;
  return null;
}

/* ---------------- dialogue ---------------- */
function npcDialogue(npc) {
  const q = G.quest, p = G.player;
  const L = []; // lines
  const say = (t) => L.push(t);
  let onEnd = null;

  if (npc.id === "voss") {
    if (q.id === "none") {
      say("You made it. I'm Commander Voss — welcome to Meridian Colony, humanity's toehold on Kepler-1649c.");
      say("We run on auxiliary power since the supply drone went down. Three fuse cells are scattered across the western wilds.");
      say("Bring me 3 fuse cells and I'll sign out a pulse blaster for you. Watch for crawlers out there.");
      onEnd = () => setQuest("fuse", "active");
    } else if (q.id === "fuse" && q.stage === "active") {
      say(`Fuse cells: ${p.fuses}/3. Check the crystal groves and the old landing beacons — the drone broke up over the wilds.`);
    } else if (q.id === "fuse" && q.stage === "turnin") {
      say("That's all three! Power's coming back online across the colony.");
      say("A deal's a deal — take this pulse blaster. It draws from your suit energy. Diaz can tell you about our crawler problem next.");
      onEnd = () => { p.hasBlaster = true; document.getElementById("btn-fire").classList.toggle("hidden", !FF.isTouch || !p.hasBlaster); completeQuest(); setQuest("nest", "active"); };
    } else if (q.id === "bot" && q.stage === "active") {
      say("SB-7 is still out there in the eastern ruins. End it, and Meridian is safe.");
    } else if (q.id === "done") {
      say("Meridian Colony stands because of you. The frontier is a little less final today.");
    } else {
      say("Diaz and Chen have work for able hands. Check in with them.");
    }
  }

  if (npc.id === "diaz") {
    if (q.id === "nest" && q.stage === "active") {
      say(`Crawlers down: ${p.crawlersSlain}/6. They nest near the crystal groves — follow the clicking.`);
    } else if (q.id === "nest" && q.stage === "turnin") {
      say("Six crawlers! The perimeter's quiet for the first time in weeks.");
      say("Let me reinforce that suit — +25 max hull integrity, on the house. Chen's been asking for you, by the way.");
      onEnd = () => { p.maxhp += 25; p.hp = p.maxhp; completeQuest(); setQuest("flora", "active"); };
    } else if (q.id === "none" || q.id === "fuse") {
      say("Engines, reactors, busted drones — if it's broke, I fix it. Come back after you've seen Voss.");
    } else {
      say("Suit's holding together? Good. Keep an eye on your energy reserves out there.");
    }
  }

  if (npc.id === "chen") {
    if (q.id === "flora" && q.stage === "active") {
      say(`Glowblooms sampled: ${p.blooms}/4. The pink ones near water are the most potent. Don't eat them. Probably.`);
    } else if (q.id === "flora" && q.stage === "turnin") {
      say("Four pristine samples! This antivenom will save lives.");
      say("I've tuned your suit's energy cells — +50 max energy and faster recharge. Voss has one last job for you. Make it count.");
      onEnd = () => { p.maxen += 50; p.en = p.maxen; p.enRegen = 9; completeQuest(); setQuest("bot", "active"); };
    } else {
      say("I'm Medic Chen. If the wildlife bites, stings, or spits at you — come see me. Preferably walking.");
    }
  }
  return { name: npc.name, lines: L, onEnd };
}

FF.startDialogue = function (npc) {
  const dlg = npcDialogue(npc);
  G.dialogue = { name: dlg.name, lines: dlg.lines, i: 0, onEnd: dlg.onEnd };
  FF.state = "dialogue";
  document.getElementById("dlg-name").textContent = dlg.name;
  document.getElementById("dlg-text").textContent = dlg.lines[0];
  document.getElementById("dialogue").classList.remove("hidden");
  FF.sfx("talk");
};
FF.advanceDialogue = function () {
  const d = G.dialogue;
  if (!d) return;
  d.i++;
  if (d.i >= d.lines.length) {
    document.getElementById("dialogue").classList.add("hidden");
    FF.state = "play";
    if (d.onEnd) d.onEnd();
    G.dialogue = null;
    FF.updateHUD(); saveGame();
  } else {
    document.getElementById("dlg-text").textContent = d.lines[d.i];
    FF.sfx("talk");
  }
};

/* ---------------- quests ---------------- */
function setQuest(id, stage) {
  G.quest = { id, stage };
  const q = QUESTS[id];
  if (q && stage === "active") FF.banner("New quest: " + q.title);
  FF.updateHUD(); saveGame();
}
function completeQuest() { G.quest.stage = "complete"; }
FF.checkQuestProgress = function () {
  const q = G.quest, p = G.player;
  if (q.stage !== "active") return;
  if (q.id === "fuse" && p.fuses >= 3) { q.stage = "turnin"; FF.banner("Return to Commander Voss"); }
  if (q.id === "nest" && p.crawlersSlain >= 6) { q.stage = "turnin"; FF.banner("Return to Engineer Diaz"); }
  if (q.id === "flora" && p.blooms >= 4) { q.stage = "turnin"; FF.banner("Return to Medic Chen"); }
  FF.updateHUD(); saveGame();
};
FF.bossDefeated = function () {
  if (G.quest.id === "bot") {
    G.quest = { id: "done", stage: "complete" };
    const p = G.player;
    document.getElementById("victory-text").textContent =
      `SB-7 destroyed. Meridian Colony is safe — Level ${p.level}, ${p.credits} credits earned. The frontier is yours.`;
    FF.state = "victory";
    document.getElementById("victory").classList.remove("hidden");
    document.getElementById("hud").classList.add("hidden");
    FF.sfx("levelup");
    saveGame();
  }
};
FF.gameOver = function () {
  FF.state = "gameover";
  document.getElementById("gameover").classList.remove("hidden");
  document.getElementById("hud").classList.add("hidden");
};

/* ---------------- HUD / banner ---------------- */
FF.updateHUD = function () {
  const p = G.player;
  document.getElementById("hp-fill").style.width = (100 * p.hp / p.maxhp) + "%";
  document.getElementById("en-fill").style.width = (100 * p.en / p.maxen) + "%";
  document.getElementById("hp-text").textContent = Math.ceil(p.hp) + "/" + p.maxhp;
  document.getElementById("en-text").textContent = Math.floor(p.en) + "/" + p.maxen;
  document.getElementById("level-num").textContent = p.level;
  document.getElementById("credits-num").textContent = p.credits;
  const obj = questObjective();
  const qt = document.getElementById("quest-tracker");
  if (obj && G.quest.id !== "done") {
    qt.classList.remove("hidden");
    document.getElementById("quest-title").textContent = QUESTS[G.quest.id].title;
    document.getElementById("quest-obj").textContent = obj;
  } else qt.classList.add("hidden");
};
let bannerT = null;
FF.banner = function (text, ms = 2300) {
  const b = document.getElementById("banner");
  b.textContent = text;
  b.classList.remove("hidden");
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.add("hidden"), ms);
};

/* ---------------- sound ---------------- */
FF.sfx = function (name) {
  try {
    FF._ac = FF._ac || new (window.AudioContext || window.webkitAudioContext)();
    if (FF._ac.state === "suspended") FF._ac.resume();
    const ac = FF._ac, t = ac.currentTime;
    const cfg = {
      swing: [320, 130, 0.09, "sawtooth"], zap: [880, 240, 0.12, "square"],
      hit: [210, 90, 0.08, "square"], hurt: [170, 60, 0.22, "sawtooth"],
      die: [420, 50, 0.28, "sawtooth"], pickup: [660, 990, 0.12, "sine"],
      levelup: [523, 784, 0.32, "sine"], deny: [150, 110, 0.16, "square"],
      eshoot: [520, 300, 0.1, "square"], talk: [700, 700, 0.05, "sine"],
    }[name];
    if (!cfg) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = cfg[3];
    o.frequency.setValueAtTime(cfg[0], t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, cfg[1]), t + cfg[2]);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + cfg[2]);
    o.start(t); o.stop(t + cfg[2] + 0.03);
  } catch (e) { /* audio unavailable */ }
};

/* ---------------- save / load ---------------- */
const SAVE_KEY = "tff_save_v1";
function saveGame() {
  if (!G || !G.player) return;
  const p = G.player;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, player: {
        x: p.x, y: p.y, hp: p.hp, maxhp: p.maxhp, en: p.en, maxen: p.maxen,
        enRegen: p.enRegen, level: p.level, xp: p.xp, credits: p.credits,
        hasBlaster: p.hasBlaster, fuses: p.fuses, blooms: p.blooms,
        crawlersSlain: p.crawlersSlain,
      },
      quest: G.quest,
      deadEnemies: G.enemies.filter(e => e.dead).map(e => e.id),
      takenPickups: G.pickups.filter(k => k.taken).map(k => k.id),
      bossDead: G.enemies.some(e => e.d && e.d.boss && e.dead),
    }));
  } catch (e) { /* storage unavailable */ }
}
function loadGameData() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
FF.hasSave = function () { const s = loadGameData(); return !!(s && s.v === 1); };

/* ---------------- game setup ---------------- */
function freshState() {
  World.build();
  const p = newPlayer(20 * FF.TILE + 16, 28 * FF.TILE + 16);
  G = {
    player: p,
    enemies: World.enemySpawns.map(spawnEnemy),
    projectiles: [],
    pickups: World.pickups.map(k => ({ ...k })),
    npcStates: World.npcs.map(n => ({ ...n })),
    nearNPC: null, dialogue: null,
    quest: { id: "none", stage: "none" },
    saveT: 0,
  };
  FF.camera.x = p.x - FF.W / 2; FF.camera.y = p.y - FF.H / 2;
}
function applySave(s) {
  freshState();
  const p = G.player, sp = s.player;
  Object.assign(p, {
    x: sp.x, y: sp.y, hp: sp.hp, maxhp: sp.maxhp, en: sp.en, maxen: sp.maxen,
    enRegen: sp.enRegen, level: sp.level, xp: sp.xp, credits: sp.credits,
    hasBlaster: sp.hasBlaster, fuses: sp.fuses, blooms: sp.blooms,
    crawlersSlain: sp.crawlersSlain,
  });
  G.quest = s.quest;
  const dead = new Set(s.deadEnemies || []);
  G.enemies = G.enemies.filter(e => !dead.has(e.id));
  const taken = new Set(s.takenPickups || []);
  for (const k of G.pickups) if (taken.has(k.id)) k.taken = true;
  FF.camera.x = p.x - FF.W / 2; FF.camera.y = p.y - FF.H / 2;
}

function enterPlay() {
  FF.state = "play";
  for (const id of ["title", "gameover", "victory"]) document.getElementById(id).classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  if (FF.isTouch) {
    document.getElementById("touch").classList.remove("hidden");
    document.getElementById("btn-fire").classList.toggle("hidden", !G.player.hasBlaster);
  }
  FF.updateHUD();
  FF.banner("Meridian Colony — Kepler-1649c");
}
FF.newGame = function () {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  freshState(); enterPlay();
};
FF.continueGame = function () {
  const s = loadGameData();
  if (!s) { FF.newGame(); return; }
  applySave(s); enterPlay();
};
FF.toTitle = function () {
  FF.state = "title";
  for (const id of ["gameover", "victory", "hud", "touch", "dialogue", "quest-tracker"]) document.getElementById(id).classList.add("hidden");
  document.getElementById("title").classList.remove("hidden");
  document.getElementById("btn-continue").classList.toggle("hidden", !FF.hasSave());
};

/* ---------------- update / render ---------------- */
function update(dt) {
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updatePickups(dt);
  G.saveT += dt;
  if (G.saveT > 20) { G.saveT = 0; saveGame(); }
}
function render() {
  const ctx = FF.ctx;
  ctx.fillStyle = "#05030f";
  ctx.fillRect(0, 0, FF.W, FF.H);
  if (FF.state === "title" || !G) return;
  World.render(ctx);
  renderEntities(ctx);
  // vignette
  const vg = ctx.createRadialGradient(FF.W / 2, FF.H / 2, Math.min(FF.W, FF.H) * 0.42, FF.W / 2, FF.H / 2, Math.max(FF.W, FF.H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(5,2,18,.42)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, FF.W, FF.H);
}

/* ---------------- automated smoke test (?fftest=1) ---------------- */
function runFFTest() {
  const R = { errors: [], log: [] };
  window.addEventListener("error", e => R.errors.push(String((e.error && e.error.stack) || e.message).slice(0, 200)));
  try {
    FF.newGame();
    const P = () => G.player;
    R.log.push("spawn:" + Math.round(P().x) + "," + Math.round(P().y) + " enemies:" + G.enemies.length + " pickups:" + G.pickups.length + " npcs:" + G.npcStates.length);
    // walk right
    FF.input.keys["d"] = true;
    for (let i = 0; i < 90; i++) update(1 / 60);
    FF.input.keys["d"] = false;
    R.log.push("walk:" + Math.round(P().x) + "," + Math.round(P().y) + " moving:" + P().moving);
    render();
    // melee a crawler
    const e0 = G.enemies.find(e => e.type === "crawler" && !e.dead);
    if (e0) {
      P().x = e0.x - 40; P().y = e0.y; P().dir = 3;
      const hp0 = e0.hp;
      FF.input.attackQueued = true;
      for (let i = 0; i < 30; i++) update(1 / 60);
      R.log.push("melee:hp" + hp0 + "->" + Math.round(Math.max(0, e0.hp)) + " dead:" + e0.dead + " xp:" + P().xp + " credits:" + P().credits);
    }
    // talk to Voss -> quest start
    const voss = G.npcStates.find(n => n.id === "voss");
    P().x = voss.x; P().y = voss.y + 40;
    for (let i = 0; i < 5; i++) update(1 / 60);
    R.log.push("nearNPC:" + (G.nearNPC && G.nearNPC.id));
    FF.input.interactQueued = true;
    for (let i = 0; i < 5; i++) update(1 / 60);
    R.log.push("dlgState:" + FF.state);
    let guard = 0;
    while (FF.state === "dialogue" && guard++ < 20) FF.advanceDialogue();
    R.log.push("quest:" + G.quest.id + "/" + G.quest.stage + " state:" + FF.state);
    // collect all fuses
    for (const pk of G.pickups.filter(k => k.type === "fuse" && !k.taken)) {
      P().x = pk.x; P().y = pk.y;
      for (let i = 0; i < 10; i++) update(1 / 60);
    }
    R.log.push("fuses:" + P().fuses + " quest:" + G.quest.id + "/" + G.quest.stage);
    // turn in to Voss
    P().x = voss.x; P().y = voss.y + 40;
    for (let i = 0; i < 5; i++) update(1 / 60);
    FF.input.interactQueued = true;
    for (let i = 0; i < 5; i++) update(1 / 60);
    guard = 0;
    while (FF.state === "dialogue" && guard++ < 20) FF.advanceDialogue();
    R.log.push("blaster:" + P().hasBlaster + " quest:" + G.quest.id + "/" + G.quest.stage);
    // fire blaster
    P().dir = 3; P().en = P().maxen;
    FF.input.fireQueued = true;
    for (let i = 0; i < 10; i++) update(1 / 60);
    R.log.push("projectiles:" + G.projectiles.length + " en:" + Math.round(P().en));
    // spitter shoots back
    const sp = G.enemies.find(e => e.type === "spitter" && !e.dead);
    if (sp) {
      P().x = sp.x - 200; P().y = sp.y; P().hp = P().maxhp; P().hurtT = 0;
      for (let i = 0; i < 220; i++) update(1 / 60);
      R.log.push("enemyFire:php" + Math.round(P().hp) + "/" + P().maxhp);
    }
    // boss kill -> victory path check (quest forced to bot stage)
    const bot = G.enemies.find(e => e.d && e.d.boss && !e.dead);
    if (bot) {
      G.quest = { id: "bot", stage: "active" };
      P().x = bot.x - 60; P().y = bot.y; P().hp = P().maxhp; P().hurtT = 0; P().dir = 3;
      bot.hp = 5;
      FF.input.attackQueued = true;
      for (let i = 0; i < 30; i++) update(1 / 60);
      R.log.push("bossDead:" + bot.dead + " state:" + FF.state + " quest:" + G.quest.id);
    }
    // save roundtrip
    saveGame();
    const s = loadGameData();
    R.log.push("save:" + !!s + " q:" + (s && s.quest.id) + " lvl:" + (s && s.player.level));
    // scenic final pose for screenshot
    if (FF.state === "victory") { document.getElementById("victory").classList.add("hidden"); }
    FF.state = "play";
    document.getElementById("hud").classList.remove("hidden");
    P().x = 23 * FF.TILE; P().y = 24 * FF.TILE; P().dir = 0; P().hp = P().maxhp;
    for (let i = 0; i < 30; i++) update(1 / 60);
    render();
  } catch (err) { R.errors.push("test:" + String((err && err.stack) || err).slice(0, 300)); }
  document.title = "FFTEST:" + JSON.stringify(R);
}

/* Debug teleport (only present in ?fftest=1 runs) */
if (location.search.includes("fftest")) {
  window.__ffteleport = (tx, ty, dir = 0) => {
    const p = G.player;
    p.x = tx * FF.TILE + 16; p.y = ty * FF.TILE + 16; p.dir = dir; p.hp = p.maxhp;
  };
}

/* ---------------- boot ---------------- */
window.addEventListener("load", async () => {
  World.build();
  const btnNew = document.getElementById("btn-new");
  btnNew.textContent = "⏳ Loading assets…";
  try {
    await FF.loadAssets();
  } catch (e) {
    btnNew.textContent = "⚠ Asset load failed — retry";
    btnNew.onclick = () => window.location.reload();
    return;
  }
  btnNew.textContent = "▶ New Expedition";
  document.getElementById("btn-continue").classList.toggle("hidden", !FF.hasSave());
  btnNew.onclick = () => { FF.sfx("talk"); FF.newGame(); };
  document.getElementById("btn-continue").onclick = () => { FF.sfx("talk"); FF.continueGame(); };
  document.getElementById("btn-retry").onclick = () => FF.continueGame();
  document.getElementById("btn-title1").onclick = FF.toTitle;
  document.getElementById("btn-title2").onclick = FF.toTitle;
  document.getElementById("btn-again").onclick = () => {
    document.getElementById("victory").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
    FF.state = "play";
  };
  // audio unlock on first gesture
  const unlock = () => { FF.sfx("talk"); window.removeEventListener("touchstart", unlock); window.removeEventListener("click", unlock); };
  window.addEventListener("touchstart", unlock); window.addEventListener("click", unlock);
  FF.boot(update, render);
  if (location.search.includes("fftest")) setTimeout(runFFTest, 1200);
});
