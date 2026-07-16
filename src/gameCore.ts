export type Team = 'aurora' | 'atlas';
export type MatchPhase = 'menu' | 'playing' | 'celebration' | 'paused' | 'penalty' | 'finished';

export interface Score { aurora: number; atlas: number }

export function detectGoal(x: number, z: number, goalHalfWidth = 9, goalLine = 51): Team | null {
  if (Math.abs(x) >= goalHalfWidth) return null;
  if (z <= -goalLine) return 'aurora';
  if (z >= goalLine) return 'atlas';
  return null;
}

export function regulationResult(score: Score): Team | 'penalty' {
  if (score.aurora > score.atlas) return 'aurora';
  if (score.atlas > score.aurora) return 'atlas';
  return 'penalty';
}

export function penaltyResult(aurora: number, atlas: number, kicksEach: number): Team | null {
  if (kicksEach < 3) return null;
  if (aurora === atlas) return null;
  return aurora > atlas ? 'aurora' : 'atlas';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
