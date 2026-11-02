import "@fontsource/orbitron/700.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "./style.css";
import { ALLIES, ALLY_MAP, availableAllies, requiredAllies, solverSquad, squadLimits, allyStoryState } from "./game/allies";
import {
  activateOverload,
  createGame,
  forecastLines,
  isLegal,
  legalCells,
  placeTile,
  rateStars,
  refreshHand,
  useAbility,
} from "./game/engine";
import type { GameEvent, GameState } from "./game/types";
import { MOD_INFO, allEpisodes, buildStage } from "./game/stage";
import { ENDING_STANDARD, ENDING_TRUE, type Scene, stageCutscene, winCutscene } from "./game/cutscenes";
import { contextualHint, type Hint } from "./ui/hints";
import { bindSettings, buzz, resumeAudio, sfx } from "./ui/audio";
import { flash, mountFx, shake, type Fx } from "./ui/effects";
import {
  bossStars,
  continueTarget,
  isStageUnlocked,
  loadSave,
  recordClear,
  stageKey,
  unlockedEpisode,
  writeSave,
  type SaveData,
} from "./ui/save";

const app = document.getElementById("app")!;
const save = loadSave();
bindSettings(save.settings);

function fitViewport(): void {
  const next = window.innerHeight || document.documentElement.clientHeight || 640;
  document.documentElement.style.setProperty("--app-h", `${Math.round(next)}px`);
}
fitViewport();
window.addEventListener("resize", fitViewport);
window.addEventListener("orientationchange", fitViewport);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitViewport);

type Route =
  | { name: "title" }
  | { name: "episodes" }
  | { name: "squad"; episode: number; stage: number }
  | { name: "cutscene"; scenes: Scene[]; next: Route }
  | { name: "game"; episode: number; stage: number }
  | { name: "result" }
  | { name: "codex" }
  | { name: "settings" }
  | { name: "ending"; scenes: Scene[] };

let route: Route = { name: "title" };
let game: GameState | null = null;
let seed = 1;
let handPick = -1;
let aim: "play" | "breach" | "scrub" = "play";
let fx: Fx | null = null;
let hintTimer = 0;
let lastInput = 0;
let shownHint: Hint | null = null;
let hintLockUntil = 0;
let codexTab: "allies" | "scenes" | "manual" = "allies";
let codexAlly = "";
let picks: string[] = [];
let squadKey = "";

const PORTRAITS = new Set(["steven", "julia", "eli", "dex", "tank", "mira", "nadia", "hale", "crane", "kane"]);

function portraitIdFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("steven")) return "steven";
  if (n.includes("julia") || n.includes("reyes")) return "julia";
  if (n.includes("eli")) return "eli";
  if (n.includes("dex")) return "dex";
  if (n.includes("tank") || n.includes("okafor")) return "tank";
  if (n.includes("mira")) return "mira";
  if (n.includes("nadia")) return "nadia";
  if (n.includes("hale")) return "hale";
  if (n.includes("crane") || n.includes("silas")) return "crane";
  if (n.includes("kane")) return "kane";
  return "";
}

function portraitHtml(id: string, letter: string, color: string): string {
  const mark = esc(letter.slice(0, 1) || "?");
  if (!PORTRAITS.has(id)) {
    return `<span class="avatar silhouette" style="background:${color}"><span class="sil">${mark}</span></span>`;
  }
  const src = `${import.meta.env.BASE_URL}assets/portraits/${id}.webp`;
  return `<span class="avatar photo" style="background:${color}"><img src="${src}" alt="" /><span class="sil">${mark}</span></span>`;
}

function bindPortraits(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>(".avatar.photo img").forEach((img) => {
    const fail = () => img.parentElement?.classList.add("broken");
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener("error", fail);
  });
}

function bossFace(episode: number): string {
  if (episode === 7 || episode === 24) return "kane";
  if (episode === 16 || episode === 20) return "hale";
  if (episode === 8 || episode === 18 || episode === 23) return "crane";
  if (episode === 25) return "julia";
  return "";
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function go(next: Route): void {
  document.querySelectorAll(".modal").forEach((node) => node.remove());
  fx?.stop();
  fx = null;
  window.clearInterval(hintTimer);
  route = next;
  render();
}

function persist(): void {
  writeSave(save);
  bindSettings(save.settings);
}

document.addEventListener("pointerdown", () => resumeAudio(), { once: true });

function render(): void {
  if (route.name === "title") return title();
  if (route.name === "episodes") return episodes();
  if (route.name === "squad") return squad();
  if (route.name === "settings") return settings();
  if (route.name === "codex") return codex();
  if (route.name === "cutscene") return cutscene(route.scenes, route.next);
  if (route.name === "ending") return cutscene(route.scenes, { name: "title" });
  if (route.name === "result") return result();
  if (route.name === "game") return mountGame();
}

function continueLabel(): string {
  const cont = continueTarget(save);
  const ep = allEpisodes()[cont.episode - 1];
  const fresh = Object.keys(save.cleared).length === 0;
  const verb = fresh ? "Start" : cont.episode === 25 && cont.stage === 8 && save.cleared[stageKey(25, 8)] ? "Replay" : "Continue";
  return `${verb} · Stage ${cont.episode}-${cont.stage} · ${ep?.title ?? ""}`;
}

function openContinue(): void {
  sfx("ui");
  const t = continueTarget(save);
  go({ name: "squad", episode: t.episode, stage: t.stage });
}

function title(): void {
  app.innerHTML = `
    <section class="screen">
      <p class="kicker">DELTA // HELIX</p>
      <h1 class="logo">OVER<br/>CLOCKED</h1>
      <p class="tag">Hack the mainframe. Bring her home.</p>
      <p class="footer-note">25 EPISODES · 200 STAGES · 2031</p>
      <div class="menu">
        <button class="btn primary" id="cont">${esc(continueLabel())}</button>
        <button class="btn" id="eps">Episodes</button>
        <button class="btn" id="codex">Allies Codex</button>
        <button class="btn" id="settings">Settings</button>
      </div>
    </section>`;
  app.querySelector("#cont")?.addEventListener("click", () => openContinue());
  app.querySelector("#eps")?.addEventListener("click", () => {
    sfx("ui");
    go({ name: "episodes" });
  });
  app.querySelector("#codex")?.addEventListener("click", () => {
    sfx("ui");
    go({ name: "codex" });
  });
  app.querySelector("#settings")?.addEventListener("click", () => {
    sfx("ui");
    go({ name: "settings" });
  });
}

function episodes(): void {
  const eps = allEpisodes();
  app.innerHTML = `
    <section class="screen">
      <button class="back" id="back">← TITLE</button>
      <p class="kicker">SECTOR MAP</p>
      <button class="btn primary continue-bar" id="play-next">${esc(continueLabel())}</button>
      <div class="ep-list">
        ${eps
          .map((ep) => {
            const open = ep.n === 1 || Boolean(save.cleared[stageKey(ep.n - 1, 8)]);
            const dots = Array.from({ length: 8 }, (_, i) => {
              const stage = i + 1;
              const id = stageKey(ep.n, stage);
              const rec = save.cleared[id];
              const unlocked = open && isStageUnlocked(save, ep.n, stage);
              return `<button class="dot ${stage === 8 ? "boss" : ""} ${rec ? "done" : ""}" data-ep="${ep.n}" data-st="${stage}" ${unlocked ? "" : "disabled"}>${
                stage === 8 ? "☠" : stage
              }${rec ? `<small>${"★".repeat(rec.stars)}</small>` : ""}</button>`;
            }).join("");
            const faces = open
              ? requiredAllies(ep.n, 1)
                  .map((id) => portraitHtml(id, ALLY_MAP[id]?.name ?? id, ALLY_MAP[id]?.color ?? "#39f3ff"))
                  .join("")
              : "";
            const villain = open ? bossFace(ep.n) : "";
            const villainFace = villain ? portraitHtml(villain, villain, "#9ad7ff") : "";
            return `<article class="ep-card ${open ? "" : "locked"}">
              <div class="ep-top"><h2 class="ep-title">${open ? `EP ${String(ep.n).padStart(2, "0")} · ${esc(ep.title)}` : "CLASSIFIED"}</h2><span class="faces">${faces}${villainFace}</span></div>
              <p class="ep-loc">${open ? esc(ep.location) : "Clear the previous boss to unlock."}</p>
              ${open ? `<p class="ep-loc">${esc(ep.logline)}</p>` : ""}
              <div class="dots">${dots}</div>
            </article>`;
          })
          .join("")}
      </div>
    </section>`;
  app.querySelector("#back")?.addEventListener("click", () => go({ name: "title" }));
  app.querySelector("#play-next")?.addEventListener("click", () => openContinue());
  bindPortraits(app);
  app.querySelectorAll(".dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ep = Number((btn as HTMLElement).dataset.ep);
      const st = Number((btn as HTMLElement).dataset.st);
      sfx("ui");
      go({ name: "squad", episode: ep, stage: st });
    });
  });
}

function squad(): void {
  if (route.name !== "squad") return;
  const { episode, stage } = route;
  const def = buildStage(episode, stage);
  const avail = availableAllies(episode);
  const req = requiredAllies(episode, stage).filter((id) => avail.includes(id));
  const limits = squadLimits(episode);
  const key = `${episode}-${stage}`;
  if (squadKey !== key) {
    squadKey = key;
    const remembered = (save.squads[String(episode)] ?? []).filter((id) => avail.includes(id));
    picks = [...new Set([...req, ...remembered])].slice(0, Math.max(limits.max, req.length));
    if (picks.length < limits.min) {
      for (const id of solverSquad(episode, stage)) {
        if (picks.length >= limits.min) break;
        if (avail.includes(id) && !picks.includes(id)) picks.push(id);
      }
    }
  }
  const valid = picks.length >= limits.min && picks.length <= limits.max && req.every((id) => picks.includes(id));
  app.innerHTML = `
    <section class="screen">
      <button class="back" id="back">← EPISODES</button>
      <p class="kicker">${esc(def.act)}</p>
      <h2 class="ep-title">STAGE ${episode}-${stage}${def.boss ? " · BOSS" : ""}</h2>
      <p class="tag" style="font-size:16px">${esc(def.episodeTitle)} · ${esc(def.location)}</p>
      <p class="ep-loc">${def.alliesBanned ? "Black site. You go in alone. Ally abilities are sealed." : `Pick ${limits.min === limits.max ? limits.min : `${limits.min}–${limits.max}`} ${limits.max === 1 ? "operator" : "operators"}. Story locks are already on the board.`}</p>
      <div class="ally-pick">
        ${avail
          .map((id) => {
            const a = ALLY_MAP[id];
            const on = picks.includes(id);
            const locked = req.includes(id);
            return `<button class="ally-opt ${on ? "on" : ""}" data-id="${id}" ${locked ? "disabled" : ""}>
              ${portraitHtml(id, a.name, a.color)}
              <span class="meta"><strong>${esc(a.name)}</strong><span>${esc(a.ability)} · ${esc(a.rule)}</span></span>
            </button>`;
          })
          .join("")}
      </div>
      <button class="btn primary" id="go" ${valid ? "" : "disabled"}>${def.alliesBanned ? "Enter alone" : "Deploy"}</button>
    </section>`;
  app.querySelector("#back")?.addEventListener("click", () => {
    picks = [];
    squadKey = "";
    go({ name: "episodes" });
  });
  bindPortraits(app);
  app.querySelectorAll(".ally-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset.id!;
      if (req.includes(id)) return;
      if (picks.includes(id)) picks = picks.filter((x) => x !== id);
      else if (picks.length < limits.max) picks = [...picks, id];
      sfx("ui");
      squad();
    });
  });
  app.querySelector("#go")?.addEventListener("click", () => {
    if (!valid) return;
    save.squads[String(episode)] = picks;
    persist();
    sfx("ui");
    const chosen = [...picks];
    picks = [];
    go({
      name: "cutscene",
      scenes: stageCutscene(episode, stage),
      next: { name: "game", episode, stage },
    });
    pendingSquad = chosen;
  });
}

let pendingSquad: string[] = [];

function settings(): void {
  const row = (key: keyof SaveData["settings"], label: string) =>
    `<div class="toggle"><span>${label}</span><button class="switch ${save.settings[key] ? "on" : ""}" data-k="${key}"><i></i></button></div>`;
  app.innerHTML = `
    <section class="screen">
      <button class="back" id="back">← TITLE</button>
      <p class="kicker">RIG CONFIG</p>
      <div class="scroll">
        ${row("sound", "Sound effects")}
        ${row("hints", "Ally hints")}
        ${row("haptics", "Haptics")}
        ${row("shake", "Screen shake")}
        <p class="ep-loc">Hints pop in when you hesitate, the clock gets thin, or a boss rule is about to bite.</p>
      </div>
    </section>`;
  app.querySelector("#back")?.addEventListener("click", () => go({ name: "title" }));
  app.querySelectorAll(".switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = (btn as HTMLElement).dataset.k as keyof SaveData["settings"];
      save.settings[key] = !save.settings[key];
      persist();
      sfx("ui");
      settings();
    });
  });
}

function codex(): void {
  const ep = unlockedEpisode(save);
  const body =
    codexTab === "allies"
      ? alliesCodex(ep)
      : codexTab === "scenes"
        ? sceneCodex()
        : manual();
  app.innerHTML = `
    <section class="screen">
      <button class="back" id="back">← TITLE</button>
      <div class="tabs">
        <button class="btn tiny ${codexTab === "allies" ? "primary" : ""}" data-tab="allies">Allies</button>
        <button class="btn tiny ${codexTab === "scenes" ? "primary" : ""}" data-tab="scenes">Cutscenes</button>
        <button class="btn tiny ${codexTab === "manual" ? "primary" : ""}" data-tab="manual">Manual</button>
      </div>
      <div class="scroll">${body}</div>
    </section>`;
  app.querySelector("#back")?.addEventListener("click", () => go({ name: "title" }));
  bindPortraits(app);
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      codexTab = (btn as HTMLElement).dataset.tab as typeof codexTab;
      codex();
    });
  });
  app.querySelectorAll("[data-ally]").forEach((btn) => {
    btn.addEventListener("click", () => {
      codexAlly = (btn as HTMLElement).dataset.ally === codexAlly ? "" : (btn as HTMLElement).dataset.ally!;
      codex();
    });
  });
  app.querySelectorAll("[data-scene]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [e, s] = (btn as HTMLElement).dataset.scene!.split(":");
      const episode = Number(e);
      const scenes = s === "win" ? winCutscene(episode) : stageCutscene(episode, Number(s));
      go({ name: "cutscene", scenes, next: { name: "codex" } });
    });
  });
  app.querySelector("#ending")?.addEventListener("click", () => {
    const scenes = bossStars(save) >= 65 ? ENDING_TRUE : ENDING_STANDARD;
    go({ name: "ending", scenes });
  });
}

function alliesCodex(ep: number): string {
  return `<div class="codex-grid">${ALLIES.map((a) => {
    const state = allyStoryState(a.id, ep);
    if (state === "classified") {
      return `<button class="cardish" disabled><b>CLASSIFIED</b><div class="ep-loc">Not yet in the field.</div></button>`;
    }
    const open = codexAlly === a.id;
    const ribbon = state === "memorial" ? "MEMORIAL" : state === "betrayed" ? "BETRAYED" : state === "wounded" ? "WOUNDED · ACTIVE" : "ACTIVE";
    return `<button class="cardish ${state}" data-ally="${a.id}">
      ${portraitHtml(a.id, a.name, a.color)}
      <b>${esc(a.name)}</b>
      <div class="ep-loc">${ribbon}</div>
      ${open ? `<p>${esc(a.bio)}</p><p><b>${esc(a.ability)}</b> — ${esc(a.rule)}</p>${a.memorial && state !== "active" && state !== "wounded" ? `<p>${esc(a.memorial)}</p>` : ""}` : ""}
    </button>`;
  }).join("")}</div>`;
}

function sceneCodex(): string {
  const blocks: string[] = [];
  for (let e = 1; e <= 25; e++) {
    const rows: string[] = [];
    for (let s = 1; s <= 8; s++) {
      const id = `e${String(e).padStart(2, "0")}-s${String(s).padStart(2, "0")}`;
      const seen = save.seen.includes(id);
      rows.push(`<button class="btn tiny" data-scene="${e}:${s}" ${seen ? "" : "disabled"}>${s === 8 ? "Boss" : s}</button>`);
    }
    const winId = `e${String(e).padStart(2, "0")}-win`;
    rows.push(`<button class="btn tiny" data-scene="${e}:win" ${save.seen.includes(winId) ? "" : "disabled"}>Win</button>`);
    const known = e === 1 || save.cleared[stageKey(e - 1, 8)] || save.seen.some((id) => id.startsWith(`e${String(e).padStart(2, "0")}`));
    if (!known) continue;
    blocks.push(`<h3 class="ep-title">EP ${e}</h3><div class="mods">${rows.join("")}</div>`);
  }
  if (save.cleared[stageKey(25, 8)]) {
    blocks.push(`<button class="btn" id="ending">Replay ending · ${bossStars(save) >= 65 ? "Overclocked Hearts" : "System Stable"}</button>`);
  }
  return blocks.join("") || `<p class="ep-loc">Cutscenes unlock as you play them.</p>`;
}

function manual(): string {
  const mods = Object.values(MOD_INFO)
    .map((m) => `<li><b>${esc(m.name)}</b> · ${esc(m.cat)} — ${esc(m.blurb)}</li>`)
    .join("");
  return `<div class="manual">
    <h3>THE LOOP</h3>
    <p>You have a hand of 3 math tiles. Value nodes look like [-4]. Multipliers look like [×2]. Play one tile orthogonal to a target or to a tile already touching the network.</p>
    <p>Every connected tile fires on every placement. Pulse = (sum of value nodes) × (product of multipliers). Older tiles re-fire, so the chain gets louder.</p>
    <p>Each placement spends 1 turn from the Sector Stability Pool. If a target hits 0, it blows. Tiles that no longer touch a living target are purged. Then your hand refills from an infinite deck.</p>
    <h3>OVERCLOCK</h3>
    <p>+5% gauge per tile, +15% per clear, +30% on a multi-clear. At 100% you can fire System Overload: Pulse ×2, or Manual Scrub to delete a tile for free.</p>
    <p>From Episode 3 the Rig carries an Overclock Shield. Once per stage, if you would collapse, it grants extra turns and scrubs weak tiles.</p>
    <h3>MODIFIERS</h3>
    <ul>${mods}</ul>
    <h3>BOSSES</h3>
    <ul>
      <li><b>Aegis Core</b> — armor layers. The core takes 0 while armor remains.</li>
      <li><b>Bio-Drain</b> — regenerates HP every turn.</li>
      <li><b>Flux Node</b> — only odd or even values hit, flipping each turn.</li>
      <li><b>Mitosis</b> — at half HP the core splits.</li>
      <li><b>Countdown Prime</b> — five turns, then the sector goes.</li>
    </ul>
    <h3>STARS</h3>
    <p>Clear with 40% of the clock left for 3 stars, 15% for 2, anything else for 1. Boss stars total 65 or more for the true ending.</p>
  </div>`;
}

function cutscene(scenes: Scene[], next: Route): void {
  let index = 0;
  let timer = 0;
  const root = document.createElement("section");
  root.className = "screen cut";
  app.innerHTML = "";
  app.appendChild(root);

  const paint = (instant: boolean) => {
    const scene = scenes[index];
    if (!scene) {
      window.clearInterval(timer);
      go(next);
      return;
    }
    if (!save.seen.includes(scene.cutId)) {
      save.seen.push(scene.cutId);
      persist();
    }
    const hue = scene.speaker ? ALLY_MAP[scene.speaker.split(" ")[0].toLowerCase()]?.color : "#39f3ff";
    const face = portraitIdFromName(scene.speaker);
    root.innerHTML = `
      <div class="scene-frame" id="frame">
        <div class="letterbox">
          <img id="art" alt="" />
        </div>
        <div class="scene-fallback" id="fall" hidden>
          <div class="who-row">${face ? portraitHtml(face, scene.speaker || "?", hue ?? "#39f3ff") : `<div class="who" style="background:${hue ?? "#39f3ff"}">${esc((scene.speaker || "OC").slice(0, 2).toUpperCase())}</div>`}</div>
          <div class="caption">${esc(scene.caption || "Signal lost. The picture never came through.")}</div>
          <div class="bubble">${scene.speaker ? `<span class="who">${esc(scene.speaker)}</span>` : ""}<span id="line"></span></div>
        </div>
        <div class="cut-ui">
          <button class="skip" id="skip">SKIP</button>
          <button class="skip" id="next">CONTINUE</button>
        </div>
      </div>`;
    const img = root.querySelector("#art") as HTMLImageElement;
    const fall = root.querySelector("#fall") as HTMLElement;
    const line = root.querySelector("#line");
    if (line) line.textContent = scene.line || "…";
    bindPortraits(root);
    img.src = `${import.meta.env.BASE_URL}${scene.art}`;
    const showArt = () => {
      fall.hidden = true;
      img.classList.add("show");
    };
    const showFallback = () => {
      img.remove();
      fall.hidden = false;
    };
    if (img.complete && img.naturalWidth > 0) showArt();
    else {
      img.addEventListener("load", showArt);
      img.addEventListener("error", showFallback);
    }
    window.clearInterval(timer);
    const advance = () => {
      index += 1;
      if (index >= scenes.length) {
        sfx("ui");
        go(next);
      } else paint(false);
    };
    root.querySelector("#frame")?.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).id === "skip") return;
      advance();
    });
    root.querySelector("#next")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      advance();
    });
    root.querySelector("#skip")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      sfx("ui");
      window.clearInterval(timer);
      go(next);
    });
  };
  paint(false);
}

function mountGame(): void {
  if (route.name !== "game") return;
  const stage = buildStage(route.episode, route.stage);
  const allies = stage.alliesBanned ? [] : pendingSquad.length ? pendingSquad : solverSquad(route.episode, route.stage);
  pendingSquad = allies;
  seed = (Date.now() ^ (route.episode * 100 + route.stage)) >>> 0;
  game = createGame(stage, allies, seed || 1);
  handPick = -1;
  aim = "play";
  shownHint = null;
  lastInput = Date.now();
  app.innerHTML = `
    <section class="screen game-screen" id="shake-root">
      <div class="topbar">
        <div>
          <div class="sector" id="sector"></div>
          <div class="locline" id="locline"></div>
        </div>
        <button class="btn tiny" id="pause">II</button>
      </div>
      <div class="hud-stats">
        <div class="pill" id="turns"></div>
        <div class="pill shield" id="shield"></div>
        <div class="gauge" title="Overclock"><i id="gauge"></i></div>
        <div class="pill" id="oc">0%</div>
      </div>
      <div class="bossbox" id="bossbox"></div>
      <div class="board-wrap" id="wrap">
        <canvas id="fx"></canvas>
        <div class="board" id="board"></div>
      </div>
      <div id="hint"></div>
      <div id="forecast" class="ep-loc"></div>
      <div class="prompt" id="prompt"></div>
      <div class="ally-row" id="allies"></div>
      <div class="hand" id="hand"></div>
      <div class="mods" id="mods"></div>
    </section>`;
  const canvas = document.getElementById("fx") as HTMLCanvasElement;
  fx = mountFx(canvas);
  document.getElementById("pause")?.addEventListener("click", openPause);
  sync();
  fx.resize();
  hintTimer = window.setInterval(tickHint, 1000);
  openBriefing();
}

function openBriefing(): void {
  if (!game) return;
  const stage = game.stage;
  const pages: { title: string; body: string }[] = [];
  if (stage.id === "1-1" && !save.coachSeen) {
    pages.push(
      { title: "TARGET NODES", body: "The glowing block is a security node. Drop its HP to zero." },
      { title: "ONE TILE", body: "Play a math tile orthogonal to the target, or to a tile already in the chain. Diagonals do not connect." },
      { title: "THE PULSE", body: "Damage = (sum of values) × (product of multipliers). Every tile already placed fires again." },
      { title: "THE CLOCK", body: "Each placement spends a turn. Run the pool dry and the sector collapses." },
    );
    save.coachSeen = true;
    persist();
  }
  if (stage.tutorial === "sealed") {
    pages.push({ title: "BLACK SITE", body: "No backup. Ally abilities are sealed for this entire episode. It's just you and the Rig." });
  } else if (stage.tutorial && ALLY_MAP[stage.tutorial]) {
    const a = ALLY_MAP[stage.tutorial];
    pages.push({ title: a.ability.toUpperCase(), body: `${a.name}: ${a.rule} Once per stage. The button glows until you use it.` });
  }
  if (stage.boss) pages.push({ title: stage.bossName.toUpperCase(), body: stage.gimmick });
  if (stage.modifiers.length && (stage.stage === 2 || stage.stage === 5)) {
    const m = MOD_INFO[stage.modifiers[0]];
    pages.push({ title: `NEW · ${m.name.toUpperCase()}`, body: `${m.cat}. ${m.blurb}` });
  }
  if (pages.length) showSheets(pages);
}

function showSheets(pages: { title: string; body: string }[]): void {
  let i = 0;
  const draw = () => {
    const page = pages[i];
    const hold = document.createElement("div");
    hold.className = "modal";
    hold.innerHTML = `<div class="sheet"><h2>${esc(page.title)}</h2><p>${esc(page.body)}</p><button class="btn primary" id="ok">${i < pages.length - 1 ? "Next" : "Engage"}</button></div>`;
    document.body.appendChild(hold);
    hold.querySelector("#ok")?.addEventListener("click", () => {
      hold.remove();
      i += 1;
      if (i < pages.length) draw();
      else sfx("ui");
    });
  };
  draw();
}

function sync(): void {
  if (!game || route.name !== "game") return;
  const g = game;
  const sector = document.getElementById("sector");
  const locline = document.getElementById("locline");
  if (sector) sector.textContent = `EP ${String(g.stage.episode).padStart(2, "0")} · ${g.stage.episodeTitle.toUpperCase()}`;
  if (locline) locline.textContent = `${g.stage.id} · ${g.stage.boardLabel} · ${g.stage.location}`;
  const turns = document.getElementById("turns");
  if (turns) {
    turns.textContent = g.mixClock != null ? `T-${g.mixClock}` : `TURNS ${g.turnsLeft}`;
    turns.className = `pill ${g.turnsLeft <= 2 ? "danger" : ""}`;
  }
  const shield = document.getElementById("shield");
  if (shield) {
    shield.textContent = !g.stage.shield ? "NO SHIELD" : g.shieldBroken ? "SHIELD BROKEN" : "SHIELD";
    shield.className = `pill shield ${!g.stage.shield ? "" : g.shieldBroken ? "broke" : "on"}`;
  }
  const gauge = document.getElementById("gauge") as HTMLElement | null;
  if (gauge) gauge.style.width = `${g.gauge}%`;
  const oc = document.getElementById("oc");
  if (oc) oc.textContent = `${g.gauge}%`;
  const boss = document.getElementById("bossbox");
  if (boss) {
    if (!g.stage.boss) boss.innerHTML = "";
    else {
      const face = bossFace(g.stage.episode);
      const bars = g.targets
        .map((t, i) => {
          const name = g.targets.length > 1 ? `NODE ${i + 1}` : "CORE";
          const hpPct = Math.max(0, (t.hp / Math.max(1, t.maxHp)) * 100);
          const arPct = t.armorMax ? Math.max(0, (t.armor / t.armorMax) * 100) : 0;
          return `
            ${t.layers > 0 ? `<div class="bar-label"><span>${name} ARMOR ${t.layers}×${t.armorMax}</span><span>${t.armor}</span></div><div class="bar armor"><i style="width:${arPct}%"></i></div>` : ""}
            <div class="bar-label"><span>${name}</span><span>${t.hp}</span></div>
            <div class="bar hp"><i style="width:${hpPct}%"></i></div>`;
        })
        .join("");
      boss.innerHTML = `
        <div class="bar-label boss-who"><span class="boss-name">${face ? portraitHtml(face, face, "#d7dde6") : ""}<span>${esc(g.stage.bossName)}</span></span><span>${g.mixPhase !== "none" ? g.mixPhase.toUpperCase() : g.stage.bossType.toUpperCase()}</span></div>
        ${bars}`;
    }
  }
  const board = document.getElementById("board");
  if (board) {
    board.style.gridTemplateColumns = `repeat(${g.stage.cols}, 1fr)`;
    const legal = new Set(legalCells(g).map(([r, c]) => `${r},${c}`));
    const cells: string[] = [];
    for (let r = 0; r < g.stage.rows; r++) {
      for (let c = 0; c < g.stage.cols; c++) {
        const cell = g.cells[r][c];
        const target = cell.targetId != null ? g.targets.find((t) => t.id === cell.targetId) : undefined;
        let cls = "cell";
        let label = "";
        if (cell.blocked) cls += " blocked";
        else if (target) {
          cls += " target";
          label = `<span class="hp">${target.hp}</span>${target.layers ? `<span class="sub">ARM ${target.layers}</span>` : ""}`;
        } else if (cell.tile) {
          cls += cell.tile.kind === "mult" ? " tile-m" : " tile-v";
          if (cell.tile.crit) cls += " crit";
          label = cell.tile.kind === "mult" ? `×${cell.tile.value}` : `-${cell.tile.value}`;
        } else if (g.stage.checker && cell.checker) cls += " checker";
        if (!cell.blocked && !cell.tile && !target && handPick >= 0 && legal.has(`${r},${c}`)) cls += " legal";
        if ((aim === "breach" || aim === "scrub") && cell.tile) cls += " legal";
        cells.push(`<button class="${cls}" data-r="${r}" data-c="${c}">${label}</button>`);
      }
    }
    board.innerHTML = cells.join("");
    board.querySelectorAll(".cell").forEach((btn) => {
      btn.addEventListener("click", () => onCell(Number((btn as HTMLElement).dataset.r), Number((btn as HTMLElement).dataset.c)));
    });
  }
  const allies = document.getElementById("allies");
  if (allies) {
    allies.innerHTML =
      g.allies
        .map((id) => {
          const a = ALLY_MAP[id];
          const late = id === "hale" && g.turnsUsed > 0 && !g.used[id];
          const aiming = id === "tank" && aim === "breach";
          const hot = g.stage.tutorial === id && !g.used[id] && !late;
          const label = g.used[id] ? "SPENT" : late ? "TOO LATE" : aiming ? "CANCEL" : "READY";
          return `<button class="ability ${g.used[id] || late ? "used" : ""} ${hot ? "hot" : ""}" data-ally="${id}">
            ${portraitHtml(id, a.name, a.color)}
            <b>${esc(a.ability)}</b><small>${label}</small>
          </button>`;
        })
        .join("") || `<p class="ep-loc">No allies on comms.</p>`;
    allies.querySelectorAll("[data-ally]").forEach((btn) => {
      btn.addEventListener("click", () => onAlly((btn as HTMLElement).dataset.ally!));
    });
  }
  const hand = document.getElementById("hand");
  if (hand) {
    hand.innerHTML = g.hand
      .map(
        (t, i) =>
          `<button class="card ${t.kind === "mult" ? "mult" : ""} ${handPick === i ? "on" : ""}" data-h="${i}">${t.kind === "mult" ? `×${t.value}` : `-${t.value}`}</button>`,
      )
      .join("");
    hand.querySelectorAll("[data-h]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number((btn as HTMLElement).dataset.h);
        handPick = handPick === i ? -1 : i;
        aim = "play";
        touch();
        sync();
      });
    });
  }
  const mods = document.getElementById("mods");
  if (mods) {
    const chips = g.stage.modifiers.map((id) => `<span class="chip">${esc(MOD_INFO[id].name)}</span>`).join("");
    const extra = g.overloadReady ? `<button class="btn tiny magenta" id="over">Overload</button>` : "";
    const refresh = g.refreshLeft > 0 ? `<button class="btn tiny" id="refresh">Refresh hand</button>` : "";
    mods.innerHTML = chips + extra + refresh;
    mods.querySelector("#over")?.addEventListener("click", chooseOverload);
    mods.querySelector("#refresh")?.addEventListener("click", () => {
      if (!game || !refreshHand(game)) return;
      touch();
      afterAct();
    });
  }
  const forecast = document.getElementById("forecast");
  if (forecast) {
    const lines = g.forecast > 0 ? forecastLines(g) : [];
    forecast.textContent = lines.join("  ·  ");
  }
  bindPortraits(document.getElementById("shake-root") ?? app);
  const prompt = document.getElementById("prompt");
  if (prompt) {
    if (aim === "breach" || aim === "scrub") {
      const verb = aim === "breach" ? "TAP A TILE — BREACH" : "TAP A TILE — MANUAL SCRUB";
      prompt.innerHTML = `<button class="btn tiny" id="cancel-aim">${verb} · CANCEL</button>`;
      prompt.querySelector("#cancel-aim")?.addEventListener("click", () => {
        aim = "play";
        touch();
        sync();
      });
    } else {
      const flux = g.stage.bossType === "flux" || g.mixPhase === "flux";
      prompt.textContent = flux ? `PARITY ${g.parity.toUpperCase()}` : "";
    }
  }
  drawHint();
}

function touch(): void {
  lastInput = Date.now();
}

function onCell(r: number, c: number): void {
  if (!game || game.status !== "play") return;
  touch();
  if (aim === "breach") {
    if (!useAbility(game, "tank", { r, c })) return;
    aim = "play";
    afterAct();
    return;
  }
  if (aim === "scrub") {
    if (!activateOverload(game, "scrub", { r, c })) return;
    aim = "play";
    afterAct();
    return;
  }
  if (handPick < 0) return;
  if (!isLegal(game, r, c)) return;
  const ok = placeTile(game, handPick, r, c);
  if (!ok) return;
  handPick = -1;
  sfx("place");
  buzz(10);
  afterAct();
}

function onAlly(id: string): void {
  if (!game || game.used[id]) return;
  touch();
  if (id === "hale" && game.turnsUsed > 0) {
    game.events = [{ type: "banner", text: "BRIEFING CLOSED" }];
    afterAct();
    return;
  }
  if (id === "tank") {
    aim = aim === "breach" ? "play" : "breach";
    handPick = -1;
    sync();
    return;
  }
  aim = "play";
  if (!useAbility(game, id)) return;
  sfx("ui");
  buzz(15);
  afterAct();
}

function chooseOverload(): void {
  if (!game?.overloadReady) return;
  const hold = document.createElement("div");
  hold.className = "modal";
  hold.innerHTML = `<div class="sheet"><h2>SYSTEM OVERLOAD</h2><p>The gauge is redlined. Spend it.</p>
    <button class="btn primary" id="x2">Pulse ×2</button>
    <button class="btn" id="scrub">Manual scrub</button>
    <button class="btn ghost" id="cancel">Hold</button></div>`;
  document.body.appendChild(hold);
  hold.querySelector("#cancel")?.addEventListener("click", () => hold.remove());
  hold.querySelector("#x2")?.addEventListener("click", () => {
    hold.remove();
    if (!game) return;
    activateOverload(game, "x2");
    afterAct();
  });
  hold.querySelector("#scrub")?.addEventListener("click", () => {
    hold.remove();
    aim = "scrub";
    handPick = -1;
    sync();
  });
}

function afterAct(): void {
  if (!game) return;
  const events = game.events.slice();
  sync();
  fx?.resize();
  present(events);
  if (game.status === "win") window.setTimeout(() => finish(true), 650);
  if (game.status === "lose") window.setTimeout(() => finish(false), 650);
}

function present(events: GameEvent[]): void {
  const root = document.getElementById("shake-root");
  let tier = 0;
  let banner = "";
  for (const ev of events) {
    if (ev.type === "pulse") {
      const big = ev.damage >= 100 ? 3 : ev.damage >= 40 ? 2 : ev.damage >= 15 ? 1 : 0;
      tier = Math.max(tier, big);
      if (ev.damage > 0) floater(ev.r, ev.c, `-${ev.damage}`, big);
      if (big >= 2) sfx("big");
      else sfx("pulse");
      if (big >= 2) buzz(big >= 3 ? [20, 30, 40] : 25);
      burstCell(ev.r, ev.c, big >= 2 ? "#ff2bd6" : "#39f3ff", 10 + ev.damage / 4, 1 + big);
    }
    if (ev.type === "hit" && ev.damage >= 20) floater(ev.r, ev.c, `-${ev.damage}`, ev.damage >= 60 ? 2 : 1);
    if (ev.type === "kill") {
      sfx("kill");
      burstCell(ev.r, ev.c, "#ff2bd6", 28, 3);
      tier = Math.max(tier, 2);
    }
    if (ev.type === "banner") banner = ev.text;
    if (ev.type === "shield") {
      sfx("shield");
      tier = Math.max(tier, 3);
      banner = `SHIELD BREAK +${ev.bonus}`;
    }
    if (ev.type === "overload") {
      sfx("overload");
      tier = 3;
    }
    if (ev.type === "regen") floater(ev.r, ev.c, `+${ev.amount}`, 0);
  }
  if (events.some((e) => e.type === "win") && game?.stage.boss) {
    tier = 3;
    banner = "BOSS DOWN";
    burstCell(Math.floor((game?.stage.rows ?? 2) / 2), Math.floor((game?.stage.cols ?? 2) / 2), "#ffffff", 40, 4);
  }
  if (save.settings.shake && root && tier) shake(root, tier);
  if (tier) flash(tier);
  if (banner) showBanner(banner);
}

function cellPoint(r: number, c: number): { x: number; y: number } | null {
  const wrap = document.getElementById("wrap");
  const el = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  if (!wrap || !el) return null;
  const a = wrap.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
}

function floater(r: number, c: number, text: string, tier: number): void {
  const wrap = document.getElementById("wrap");
  const pt = cellPoint(r, c);
  if (!wrap || !pt) return;
  const node = document.createElement("div");
  node.className = "floater";
  node.textContent = text;
  const size = 14 + Math.min(28, Math.log2(Math.abs(parseInt(text, 10)) + 1) * 6) + tier * 4;
  node.style.fontSize = `${size}px`;
  node.style.left = `${pt.x}px`;
  node.style.top = `${pt.y}px`;
  node.style.color = text.startsWith("+") ? "#5dffb0" : tier >= 2 ? "#ff2bd6" : "#e9f7ff";
  wrap.appendChild(node);
  window.setTimeout(() => node.remove(), 750);
}

function burstCell(r: number, c: number, color: string, n: number, speed: number): void {
  const pt = cellPoint(r, c);
  if (!pt || !fx) return;
  fx.burst(pt.x, pt.y, color, Math.min(48, Math.floor(n)), speed);
}

function showBanner(text: string): void {
  const wrap = document.getElementById("wrap");
  if (!wrap) return;
  const node = document.createElement("div");
  node.className = "banner";
  node.textContent = text;
  wrap.appendChild(node);
  window.setTimeout(() => node.remove(), 900);
}

function tickHint(): void {
  if (!game || !save.settings.hints || route.name !== "game") return;
  if (Date.now() < hintLockUntil) return;
  const hint = contextualHint(game, Date.now() - lastInput);
  if (!hint || hint.key === shownHint?.key) return;
  shownHint = hint;
  hintLockUntil = Date.now() + 16000;
  drawHint();
}

function drawHint(): void {
  const slot = document.getElementById("hint");
  if (!slot) return;
  if (!shownHint || !save.settings.hints) {
    slot.innerHTML = "";
    return;
  }
  const pid = portraitIdFromName(shownHint.speaker);
  slot.innerHTML = `<div class="hint">${portraitHtml(pid, shownHint.speaker, shownHint.color)}<p><b>${esc(shownHint.speaker)}</b> — ${esc(shownHint.text)}</p><button id="dismiss" aria-label="Dismiss hint">✕</button></div>`;
  bindPortraits(slot);
  slot.querySelector("#dismiss")?.addEventListener("click", () => {
    shownHint = null;
    hintLockUntil = Date.now() + 8000;
    drawHint();
  });
}

function finish(won: boolean): void {
  if (!game || route.name !== "game") return;
  sfx(won ? "win" : "lose");
  buzz(won ? [30, 40, 30, 40, 80] : 40);
  if (won) {
    const stars = rateStars(game.turnsLeft, game.stage.turns);
    recordClear(save, game.stage.id, {
      stars,
      turnsLeft: game.turnsLeft,
      overkill: game.overkill,
      overclock: game.peakGauge,
    });
    persist();
    if (game.stage.boss) {
      const ep = game.stage.episode;
      go({ name: "cutscene", scenes: winCutscene(ep), next: { name: "result" } });
      return;
    }
  }
  go({ name: "result" });
}

function result(): void {
  if (!game) {
    go({ name: "title" });
    return;
  }
  const won = game.status === "win";
  const stars = won ? rateStars(game.turnsLeft, game.stage.turns) : 0;
  const last = game.stage.episode === 25 && game.stage.stage === 8 && won;
  const nextEp = game.stage.stage === 8 ? game.stage.episode + 1 : game.stage.episode;
  const nextSt = game.stage.stage === 8 ? 1 : game.stage.stage + 1;
  const hasNext = won && nextEp <= 25;
  app.innerHTML = `
    <section class="screen result">
      <p class="kicker">${won ? "UPLINK CLOSED" : "SECTOR LOST"}</p>
      <h2>${won ? "MISSION COMPLETE" : "SECTOR COLLAPSED"}</h2>
      <p class="tag">${won ? "SECTOR STABILIZED" : esc(game.loseReason || "timeout").toUpperCase()}</p>
      <div class="stars">${won ? [1, 2, 3].map((n) => `<span class="star" style="opacity:${n <= stars ? 1 : 0.2}">${n <= stars ? "★" : "☆"}</span>`).join("") : "—"}</div>
      <div class="stats">
        <div class="stat"><b>${game.turnsLeft}</b><span>TURNS LEFT</span></div>
        <div class="stat"><b>${game.overkill}</b><span>OVERKILL</span></div>
        <div class="stat"><b>${game.peakGauge}%</b><span>OVERCLOCK</span></div>
      </div>
      ${last ? `<p class="ep-loc">Boss stars ${bossStars(save)} / 75. ${bossStars(save) >= 65 ? "True ending unlocked." : "Standard ending."}</p>` : ""}
      <button class="btn primary" id="next">${last ? "Ending" : won && hasNext ? `Next · ${nextEp}-${nextSt}` : "Retry"}</button>
      <button class="btn" id="map">Episode map</button>
      <button class="btn ghost" id="retry">Retry stage</button>
    </section>`;
  app.querySelector("#map")?.addEventListener("click", () => go({ name: "episodes" }));
  app.querySelector("#retry")?.addEventListener("click", () => {
    go({ name: "game", episode: game!.stage.episode, stage: game!.stage.stage });
  });
  app.querySelector("#next")?.addEventListener("click", () => {
    if (!game) return;
    if (last) {
      const scenes = bossStars(save) >= 65 ? ENDING_TRUE : ENDING_STANDARD;
      go({ name: "ending", scenes });
      return;
    }
    if (won && hasNext) go({ name: "squad", episode: nextEp, stage: nextSt });
    else go({ name: "game", episode: game.stage.episode, stage: game.stage.stage });
  });
}

function openPause(): void {
  if (!game) return;
  const hold = document.createElement("div");
  hold.className = "modal";
  hold.innerHTML = `<div class="sheet"><h2>PAUSED</h2>
    <button class="btn primary" id="resume">Resume</button>
    <button class="btn" id="quit">Quit to map</button></div>`;
  document.body.appendChild(hold);
  hold.querySelector("#resume")?.addEventListener("click", () => hold.remove());
  hold.querySelector("#quit")?.addEventListener("click", () => {
    hold.remove();
    go({ name: "episodes" });
  });
}

render();
