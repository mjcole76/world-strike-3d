export interface Fixture { home: string; away: string }

export interface TableRow { id: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }

export interface LeagueState {
  playerTeam: string;
  round: number;
  rounds: Fixture[][];
  table: Record<string, TableRow>;
}

/** Double round-robin schedule via the circle method. Every team plays every round. */
export function roundRobinRounds(ids: string[]): Fixture[][] {
  const teams = [...ids];
  if (teams.length % 2) teams.push('BYE');
  const n = teams.length;
  const rotation = teams.slice(1);
  const firstLeg: Fixture[][] = [];
  for (let r = 0; r < n - 1; r += 1) {
    const left = [teams[0], ...rotation.slice(0, n / 2 - 1)];
    const right = rotation.slice(n / 2 - 1).reverse();
    const fixtures: Fixture[] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = left[i];
      const b = right[i];
      if (a === 'BYE' || b === 'BYE') continue;
      fixtures.push(r % 2 ? { home: b, away: a } : { home: a, away: b });
    }
    firstLeg.push(fixtures);
    rotation.push(rotation.shift()!);
  }
  const secondLeg = firstLeg.map((round) => round.map((f) => ({ home: f.away, away: f.home })));
  return [...firstLeg, ...secondLeg];
}

export function createTable(ids: string[]): Record<string, TableRow> {
  const table: Record<string, TableRow> = {};
  for (const id of ids) table[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return table;
}

export function createLeague(ids: string[], playerTeam: string): LeagueState {
  return { playerTeam, round: 0, rounds: roundRobinRounds(ids), table: createTable(ids) };
}

export function applyResult(table: Record<string, TableRow>, homeId: string, awayId: string, homeGoals: number, awayGoals: number): void {
  const home = table[homeId];
  const away = table[awayId];
  home.p += 1; away.p += 1;
  home.gf += homeGoals; home.ga += awayGoals;
  away.gf += awayGoals; away.ga += homeGoals;
  if (homeGoals > awayGoals) { home.w += 1; home.pts += 3; away.l += 1; }
  else if (awayGoals > homeGoals) { away.w += 1; away.pts += 3; home.l += 1; }
  else { home.d += 1; away.d += 1; home.pts += 1; away.pts += 1; }
}

export function sortTable(table: Record<string, TableRow>): TableRow[] {
  return Object.values(table).sort((a, b) =>
    b.pts - a.pts
    || (b.gf - b.ga) - (a.gf - a.ga)
    || b.gf - a.gf
    || a.id.localeCompare(b.id));
}

/** Quick score simulation for AI-vs-AI fixtures, weighted by team strength (~1). */
export function simulateScore(homeStrength: number, awayStrength: number, rand: () => number = Math.random): [number, number] {
  const goals = (strength: number): number => {
    let scored = 0;
    for (let i = 0; i < 5; i += 1) if (rand() < .17 * strength) scored += 1;
    return scored;
  };
  return [goals(homeStrength * 1.15), goals(awayStrength)];
}

export function ordinal(position: number): string {
  const suffix = position === 1 ? 'ST' : position === 2 ? 'ND' : position === 3 ? 'RD' : 'TH';
  return `${position}${suffix}`;
}
