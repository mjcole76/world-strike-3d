import { describe, expect, it } from 'vitest';
import { applyResult, createTable, ordinal, roundRobinRounds, simulateScore, sortTable } from './league';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('round robin schedule', () => {
  const rounds = roundRobinRounds(IDS);

  it('creates a double round robin for six teams', () => {
    expect(rounds).toHaveLength(10);
    for (const round of rounds) expect(round).toHaveLength(3);
  });

  it('fields every team exactly once per round', () => {
    for (const round of rounds) {
      const seen = round.flatMap((f) => [f.home, f.away]).sort();
      expect(seen).toEqual([...IDS].sort());
    }
  });

  it('plays every pairing twice with venues swapped', () => {
    const meetings = new Map<string, number>();
    const venues = new Set<string>();
    for (const fixture of rounds.flat()) {
      const key = [fixture.home, fixture.away].sort().join('-');
      meetings.set(key, (meetings.get(key) ?? 0) + 1);
      venues.add(`${fixture.home}>${fixture.away}`);
    }
    for (const count of meetings.values()) expect(count).toBe(2);
    expect(venues.size).toBe(30);
  });
});

describe('league table', () => {
  it('applies results and sorts by points then goal difference', () => {
    const table = createTable(IDS);
    applyResult(table, 'a', 'b', 3, 0);
    applyResult(table, 'c', 'd', 1, 1);
    applyResult(table, 'e', 'f', 0, 2);
    const rows = sortTable(table);
    expect(rows[0].id).toBe('a');
    expect(rows[0].pts).toBe(3);
    expect(rows[1].id).toBe('f');
    expect(table.c.pts).toBe(1);
    expect(table.d.pts).toBe(1);
    expect(table.b.l).toBe(1);
  });

  it('breaks point ties on goal difference', () => {
    const table = createTable(['x', 'y', 'z']);
    applyResult(table, 'x', 'z', 4, 0);
    applyResult(table, 'y', 'z', 1, 0);
    const rows = sortTable(table);
    expect(rows[0].id).toBe('x');
    expect(rows[1].id).toBe('y');
  });
});

describe('simulation helpers', () => {
  it('produces bounded scores', () => {
    const [hg, ag] = simulateScore(1.2, 1, () => .05);
    expect(hg).toBe(5);
    expect(ag).toBe(5);
    const [h2, a2] = simulateScore(1, 1, () => .99);
    expect(h2).toBe(0);
    expect(a2).toBe(0);
  });

  it('formats ordinals', () => {
    expect(ordinal(1)).toBe('1ST');
    expect(ordinal(2)).toBe('2ND');
    expect(ordinal(3)).toBe('3RD');
    expect(ordinal(6)).toBe('6TH');
  });
});
