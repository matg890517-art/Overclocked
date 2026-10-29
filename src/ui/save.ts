export interface ClearRecord {
  stars: number;
  turnsLeft: number;
  overkill: number;
  overclock: number;
}

export interface Settings {
  sound: boolean;
  hints: boolean;
  haptics: boolean;
  shake: boolean;
}

export interface SaveData {
  cleared: Record<string, ClearRecord>;
  seen: string[];
  squads: Record<string, string[]>;
  settings: Settings;
  coachSeen: boolean;
}

const KEY = "overclocked-save-v1";

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  hints: true,
  haptics: true,
  shake: true,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as SaveData;
    return {
      cleared: parsed.cleared ?? {},
      seen: parsed.seen ?? [],
      squads: parsed.squads ?? {},
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      coachSeen: Boolean(parsed.coachSeen),
    };
  } catch {
    return empty();
  }
}

function empty(): SaveData {
  return { cleared: {}, seen: [], squads: {}, settings: { ...DEFAULT_SETTINGS }, coachSeen: false };
}

export function writeSave(save: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function stageKey(episode: number, stage: number): string {
  return `${episode}-${stage}`;
}

export function isStageUnlocked(save: SaveData, episode: number, stage: number): boolean {
  if (episode === 1 && stage === 1) return true;
  if (stage > 1) return Boolean(save.cleared[stageKey(episode, stage - 1)]);
  return Boolean(save.cleared[stageKey(episode - 1, 8)]);
}

export function unlockedEpisode(save: SaveData): number {
  if (save.cleared[stageKey(25, 8)]) return 26;
  let ep = 1;
  for (let e = 2; e <= 25; e++) {
    if (save.cleared[stageKey(e - 1, 8)]) ep = e;
    else break;
  }
  return ep;
}

export function bossStars(save: SaveData): number {
  let sum = 0;
  for (let e = 1; e <= 25; e++) sum += save.cleared[stageKey(e, 8)]?.stars ?? 0;
  return sum;
}

export function continueTarget(save: SaveData): { episode: number; stage: number } {
  for (let e = 1; e <= 25; e++) {
    for (let s = 1; s <= 8; s++) {
      if (!isStageUnlocked(save, e, s)) return { episode: Math.max(1, e), stage: 1 };
      if (!save.cleared[stageKey(e, s)]) return { episode: e, stage: s };
    }
  }
  return { episode: 25, stage: 8 };
}

export function recordClear(save: SaveData, id: string, rec: ClearRecord): void {
  const prev = save.cleared[id];
  if (!prev || rec.stars > prev.stars || (rec.stars === prev.stars && rec.turnsLeft > prev.turnsLeft)) {
    save.cleared[id] = rec;
  }
}
