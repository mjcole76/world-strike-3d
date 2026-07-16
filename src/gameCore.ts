export type Team = 'home' | 'away';
export type MatchPhase = 'menu' | 'playing' | 'celebration' | 'paused' | 'penalty' | 'freekick' | 'finished';
export type Role = 'GK' | 'DEF' | 'MID' | 'ST';

export interface Score { home: number; away: number }

export function otherTeam(team: Team): Team {
  return team === 'home' ? 'away' : 'home';
}

/** Home attacks the -z goal, away attacks the +z goal. */
export function attackDirection(team: Team): 1 | -1 {
  return team === 'home' ? -1 : 1;
}

export function detectGoal(x: number, y: number, z: number, goalHalfWidth = 9, goalLine = 51, barHeight = 3.1): Team | null {
  if (Math.abs(x) >= goalHalfWidth || y >= barHeight) return null;
  if (z <= -goalLine) return 'home';
  if (z >= goalLine) return 'away';
  return null;
}

export function regulationResult(score: Score): Team | 'penalty' {
  if (score.home > score.away) return 'home';
  if (score.away > score.home) return 'away';
  return 'penalty';
}

/**
 * Decides a shootout after any kick. Kicks alternate home-then-away in pairs.
 * Ends early once a side cannot be caught, and resolves sudden death once both
 * sides have taken the same number of kicks beyond regulation.
 */
export function shootoutWinner(home: boolean[], away: boolean[], regulation = 3): Team | null {
  const homeScored = home.filter(Boolean).length;
  const awayScored = away.filter(Boolean).length;
  const totalKicks = Math.max(regulation, home.length, away.length);
  const homePotential = homeScored + (totalKicks - home.length);
  const awayPotential = awayScored + (totalKicks - away.length);
  if (homeScored > awayPotential) return 'home';
  if (awayScored > homePotential) return 'away';
  if (home.length === away.length && home.length >= regulation && homeScored !== awayScored) {
    return homeScored > awayScored ? 'home' : 'away';
  }
  return null;
}

export interface Restart { type: 'throw-in' | 'corner' | 'goal-kick'; team: Team }

/** Classifies a ball that left the field of play. Returns null while the ball is in play. */
export function classifyRestart(x: number, z: number, lastTouch: Team, halfWidth = 32, endLine = 52): Restart | null {
  if (Math.abs(x) > halfWidth) return { type: 'throw-in', team: otherTeam(lastTouch) };
  if (Math.abs(z) <= endLine) return null;
  const attacker: Team = z < 0 ? 'home' : 'away';
  if (lastTouch === attacker) return { type: 'goal-kick', team: otherTeam(attacker) };
  return { type: 'corner', team: attacker };
}

export type DifficultyId = 'easy' | 'pro' | 'legend';

export interface Difficulty {
  id: DifficultyId;
  label: string;
  /** Base run speed of opponent AI outfielders. */
  aiSpeed: number;
  /** Chance per second that an adjacent opponent dispossesses the ball carrier. */
  stealRate: number;
  /** Save radius of the opponent goalkeeper. */
  keeperReach: number;
  /** How fast the opponent keeper tracks your penalty aim. */
  keeperTrack: number;
  /** Scatter applied to opponent AI shots (bigger = wilder). */
  shotError: number;
  /** Chance the opponent penalty taker picks a well-placed target. */
  penAccuracy: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: { id: 'easy', label: 'EASY', aiSpeed: 7, stealRate: .35, keeperReach: 1.45, keeperTrack: 4.5, shotError: 8, penAccuracy: .5 },
  pro: { id: 'pro', label: 'PRO', aiSpeed: 7.9, stealRate: .7, keeperReach: 1.65, keeperTrack: 7, shotError: 5, penAccuracy: .72 },
  legend: { id: 'legend', label: 'LEGEND', aiSpeed: 8.6, stealRate: 1.15, keeperReach: 1.9, keeperTrack: 9.5, shotError: 3, penAccuracy: .88 },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
