import type { DifficultyId } from './gameCore';

export type MatchMode = 'friendly' | 'cup';

export interface SaveData {
  muted: boolean;
  difficulty: DifficultyId;
  teamId: string;
  mode: MatchMode;
  matchLength: number;
  cupsWon: number;
  wins: number;
}

const KEY = 'world-strike-3d:v1';

const DEFAULTS: SaveData = { muted: false, difficulty: 'pro', teamId: 'aurora', mode: 'friendly', matchLength: 180, cupsWon: 0, wins: 0 };

export function loadSave(): SaveData {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SaveData> };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveData(patch: Partial<SaveData>): SaveData {
  const next = { ...loadSave(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Storage unavailable (private mode) - play without persistence. */
  }
  return next;
}
