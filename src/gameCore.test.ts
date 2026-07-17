import { describe, expect, it } from 'vitest';
import { classifyRestart, detectGoal, DIFFICULTIES, formatClock, regulationResult, shootoutWinner } from './gameCore';

describe('goal detection', () => {
  it('scores for home at the -z goal', () => expect(detectGoal(0, 1, -52)).toBe('home'));
  it('scores for away at the +z goal', () => expect(detectGoal(4, 2, 52)).toBe('away'));
  it('rejects a shot outside the posts', () => expect(detectGoal(10, 1, -52)).toBeNull());
  it('rejects a shot over the crossbar', () => expect(detectGoal(0, 3.5, -52)).toBeNull());
  it('accepts a shot just under the bar', () => expect(detectGoal(0, 3, -52)).toBe('home'));
});

describe('match state', () => {
  it('selects the regulation winner', () => expect(regulationResult({ home: 2, away: 1 })).toBe('home'));
  it('sends a draw to penalties', () => expect(regulationResult({ home: 1, away: 1 })).toBe('penalty'));
  it('formats the match clock', () => expect(formatClock(179.2)).toBe('03:00'));
});

describe('penalty shootout', () => {
  it('stays open while both sides can still win', () => expect(shootoutWinner([true, true], [false])).toBeNull());
  it('resolves a completed best-of-three', () => expect(shootoutWinner([true, true, true], [true, true, false])).toBe('home'));
  it('ends early when a side cannot be caught', () => expect(shootoutWinner([true, true, true], [false, false])).toBe('home'));
  it('ends early for the away side too', () => expect(shootoutWinner([false, false], [true, true])).toBe('away'));
  it('continues into sudden death when level', () => expect(shootoutWinner([true, true, false], [true, true, false])).toBeNull());
  it('waits for the trailing kick in sudden death', () => expect(shootoutWinner([true, true, false, true], [true, true, false])).toBeNull());
  it('resolves sudden death after a full pair', () => expect(shootoutWinner([true, true, false, true], [true, true, false, false])).toBe('home'));
});

describe('restarts', () => {
  it('keeps the ball in play inside the field', () => expect(classifyRestart(10, 30, 'home')).toBeNull());
  it('awards a throw-in against the last touch', () => expect(classifyRestart(33, 10, 'home')).toEqual({ type: 'throw-in', team: 'away' }));
  it('awards a goal kick when the attacker puts it out', () => expect(classifyRestart(20, -53, 'home')).toEqual({ type: 'goal-kick', team: 'away' }));
  it('awards a corner when the defender puts it out', () => expect(classifyRestart(20, -53, 'away')).toEqual({ type: 'corner', team: 'home' }));
  it('mirrors the +z end', () => expect(classifyRestart(-15, 53, 'away')).toEqual({ type: 'goal-kick', team: 'home' }));
});

describe('difficulty', () => {
  it('defines all four tiers', () => expect(Object.keys(DIFFICULTIES)).toEqual(['easy', 'pro', 'legend', 'world']));
  it('scales opponent pressure upward', () => {
    expect(DIFFICULTIES.easy.stealRate).toBeLessThan(DIFFICULTIES.pro.stealRate);
    expect(DIFFICULTIES.pro.stealRate).toBeLessThan(DIFFICULTIES.legend.stealRate);
    expect(DIFFICULTIES.legend.stealRate).toBeLessThan(DIFFICULTIES.world.stealRate);
    expect(DIFFICULTIES.easy.aiSpeed).toBeLessThan(DIFFICULTIES.world.aiSpeed);
    expect(DIFFICULTIES.world.keeperReach).toBeGreaterThan(DIFFICULTIES.legend.keeperReach);
    expect(DIFFICULTIES.world.shootDistance).toBeGreaterThan(DIFFICULTIES.pro.shootDistance);
    expect(DIFFICULTIES.world.passRate).toBeGreaterThan(DIFFICULTIES.legend.passRate);
  });
});
