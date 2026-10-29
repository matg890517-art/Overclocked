export interface AllyDef {
  id: string;
  name: string;
  role: string;
  ability: string;
  rule: string;
  boss: string;
  color: string;
  bio: string;
  memorial?: string;
  hint: string;
}

export const ALLIES: AllyDef[] = [
  {
    id: "eli",
    name: "Eli Brooks",
    role: "Comms",
    ability: "Signal Boost",
    rule: "Add a [×2] multiplier to your hand.",
    boss: "Aegis, Bio-Drain",
    color: "#ffc14d",
    bio: "Boston comms specialist and the team's punchline. He keeps the channel open until Berlin, where he steps in front of a round meant for Steven.",
    memorial: "Berlin, Episode 16. \"Tell Julia my jokes were funny.\"",
    hint: "Try the ×2 next to the target, Steven!",
  },
  {
    id: "mira",
    name: "Mira Sato",
    role: "Sniper",
    ability: "Overwatch",
    rule: "Deal 6 damage to the weakest target.",
    boss: "Mitosis",
    color: "#ff5a7a",
    bio: "Former JSDF sniper out of Okinawa. She trusts a rifle more than a person, until the people keep coming back for her.",
    hint: "Weakest node is lit. Say the word and I punch it.",
  },
  {
    id: "dex",
    name: "Dex Mercer",
    role: "Hacker",
    ability: "Backdoor",
    rule: "Drop the parity lock for one turn, or strip 5 armor.",
    boss: "Flux, Aegis",
    color: "#5dffb0",
    bio: "An ex-broker who can hear a lie in a log file. He decrypts Julia's lullaby and is still at the keyboard when the rig goes into the storm.",
    hint: "Parity's a suggestion if you let me at the lock.",
  },
  {
    id: "tank",
    name: "Tank Okafor",
    role: "Demolitions",
    ability: "Breach",
    rule: "Remove one tile. Costs no turn.",
    boss: "Gridlock",
    color: "#ff8a3d",
    bio: "Lagos-born engineer. He follows people, not orders, and holds a manual detonator in a Siberian silo until the missile freezes.",
    hint: "Board's getting tight. I can pull a tile for free.",
  },
  {
    id: "nadia",
    name: "Nadia Volkov",
    role: "Double agent",
    ability: "Cipher Read",
    rule: "Preview parity and splits for the next 3 turns.",
    boss: "Flux, Mitosis",
    color: "#c9a0ff",
    bio: "SVR defector who knew Julia's father. She spends the whole story being doubted, then walks into a St. Petersburg kill-box alone.",
    memorial: "St. Petersburg, Episode 22. \"Tell Julia the waltz was real.\"",
    hint: "Read the opposite of what the board is telling you.",
  },
  {
    id: "rosa",
    name: "Rosa Medina",
    role: "Medic",
    ability: "Triage",
    rule: "Add 2 turns to the stability pool.",
    boss: "Countdown",
    color: "#3ee0c5",
    bio: "A surgeon who stitched Steven's unit together in Aleppo, and who refuses to stitch a widower if she can help it.",
    hint: "You're burning time. I can buy two more turns.",
  },
  {
    id: "hale",
    name: "Col. Marcus Hale",
    role: "Command",
    ability: "Briefing",
    rule: "Redraw your opening hand. Unavailable after Episode 15.",
    boss: "Any",
    color: "#e6d7a2",
    bio: "The colonel who pulled Steven out of hell, funded Prometheus through Harrow Holdings, and signed the Aleppo brief.",
    memorial: "Betrayed the unit in Berlin. The coin stopped in Eli's hand.",
    hint: "Those tiles are junk. Redraw before you commit.",
  },
  {
    id: "crane",
    name: "Silas Crane",
    role: "Rival",
    ability: "Last Stand",
    rule: "Episodes 18–23 only. Your next pulse hits ×1.5.",
    boss: "Any boss",
    color: "#d7dde6",
    bio: "Left in the Aleppo rubble and turned into Kane's masked enforcer. The truth about Hale puts the gun down. He holds the elevator.",
    memorial: "North Sea rig, Episode 23. This time, he stayed.",
    hint: "Hit it with everything. I'll put my weight on the pulse.",
  },
  {
    id: "julia",
    name: "Julia Reyes",
    role: "Architect",
    ability: "Root Access",
    rule: "Nullify the boss gimmick for one turn. Required to strip the final armor on HELIX Heart.",
    boss: "Every boss. Mandatory on 25-8.",
    color: "#ff2bd6",
    bio: "MIT cryptographer. She built HELIX with her father and Kane, burned the Geneva lab to stop it becoming a weapon, and hid the kill switch in a lullaby.",
    hint: "I can see the board. Let me shut the gimmick off.",
  },
];

export const ALLY_MAP: Record<string, AllyDef> = Object.fromEntries(ALLIES.map((a) => [a.id, a]));

const REQUIRED: Record<number, string[]> = {
  1: ["eli"],
  2: ["eli", "mira"],
  3: ["mira", "dex"],
  4: ["dex", "tank"],
  5: ["tank", "nadia"],
  6: ["mira", "rosa"],
  7: ["eli", "tank"],
  8: ["mira", "dex"],
  9: ["dex", "nadia"],
  10: ["eli", "mira"],
  11: ["tank", "dex"],
  12: ["rosa", "eli"],
  13: ["dex", "nadia"],
  14: ["nadia", "tank"],
  15: ["mira", "rosa"],
  16: ["eli", "dex"],
  17: [],
  18: ["mira", "tank"],
  19: ["julia", "dex"],
  20: ["nadia", "dex"],
  21: ["julia", "tank"],
  22: ["nadia", "mira"],
  23: [],
  24: ["julia", "dex"],
  25: ["julia"],
};

export function availableAllies(episode: number): string[] {
  if (episode === 17) return [];
  const ids: string[] = [];
  if (episode >= 1 && episode <= 16) ids.push("eli");
  if (episode >= 2) ids.push("mira");
  if (episode >= 3) ids.push("dex");
  if (episode >= 3 && episode <= 15) ids.push("hale");
  if (episode >= 4) ids.push("tank");
  if (episode >= 5 && episode <= 22) ids.push("nadia");
  if (episode >= 6) ids.push("rosa");
  if (episode >= 18 && episode <= 23) ids.push("crane");
  if (episode >= 19) ids.push("julia");
  return ids;
}

export function requiredAllies(episode: number, stage: number): string[] {
  const base = [...(REQUIRED[episode] ?? [])];
  if (episode === 3 && stage === 5 && !base.includes("hale")) base.push("hale");
  if (episode === 18 && stage === 3 && !base.includes("crane")) base.push("crane");
  return base.filter((id) => availableAllies(episode).includes(id) || episode !== 17);
}

export function squadLimits(episode: number): { min: number; max: number } {
  const avail = availableAllies(episode);
  if (episode === 17 || avail.length === 0) return { min: 0, max: 0 };
  if (episode === 23) return { min: 3, max: 3 };
  if (episode === 25) return { min: 3, max: 3 };
  const min = Math.min(2, avail.length);
  const max = Math.min(3, avail.length);
  return { min, max: Math.max(min, max) };
}

/** Squad the solver uses: required allies, then the strongest available fillers. */
export function solverSquad(episode: number, stage: number): string[] {
  if (episode === 17) return [];
  const req = requiredAllies(episode, stage).filter((id) => availableAllies(episode).includes(id));
  const prefer = ["rosa", "eli", "julia", "dex", "crane", "hale", "tank", "mira", "nadia"];
  const picks = [...req];
  const { max } = squadLimits(episode);
  const cap = Math.max(max, picks.length);
  for (const id of prefer) {
    if (picks.length >= cap) break;
    if (!picks.includes(id) && availableAllies(episode).includes(id)) picks.push(id);
  }
  return picks.slice(0, Math.max(cap, picks.length));
}

export type AllyStoryState = "classified" | "active" | "memorial" | "betrayed" | "wounded";

/** `unlockedEpisode` is the highest episode the player may enter (1–26). */
export function allyStoryState(id: string, unlockedEpisode: number): AllyStoryState {
  const metAt: Record<string, number> = {
    eli: 1,
    mira: 2,
    dex: 3,
    hale: 3,
    tank: 4,
    nadia: 5,
    rosa: 6,
    crane: 18,
    julia: 19,
  };
  if (unlockedEpisode < (metAt[id] ?? 99)) return "classified";
  if (id === "eli" && unlockedEpisode >= 17) return "memorial";
  if (id === "hale" && unlockedEpisode >= 16) return "betrayed";
  if (id === "nadia" && unlockedEpisode >= 23) return "memorial";
  if (id === "crane" && unlockedEpisode >= 24) return "memorial";
  if (id === "tank" && unlockedEpisode >= 22) return "wounded";
  return "active";
}

export function tutorialFor(episode: number, stage: number): string | null {
  const key = `${episode}-${stage}`;
  const map: Record<string, string> = {
    "1-3": "eli",
    "2-3": "mira",
    "3-3": "dex",
    "3-5": "hale",
    "4-3": "tank",
    "5-3": "nadia",
    "6-3": "rosa",
    "17-1": "sealed",
    "18-3": "crane",
    "19-3": "julia",
  };
  return map[key] ?? null;
}
