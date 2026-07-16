import { describe, expect, it } from 'vitest';
import { detectGoal, formatClock, penaltyResult, regulationResult } from './gameCore';

describe('goal detection', () => {
  it('scores for Aurora at the north goal', () => expect(detectGoal(0, -52)).toBe('aurora'));
  it('scores for Atlas at the south goal', () => expect(detectGoal(4, 52)).toBe('atlas'));
  it('rejects a shot outside the posts', () => expect(detectGoal(10, -52)).toBeNull());
});

describe('match state', () => {
  it('selects the regulation winner', () => expect(regulationResult({ aurora: 2, atlas: 1 })).toBe('aurora'));
  it('sends a draw to penalties', () => expect(regulationResult({ aurora: 1, atlas: 1 })).toBe('penalty'));
  it('requires three kicks before a penalty result', () => expect(penaltyResult(2, 1, 2)).toBeNull());
  it('resolves a completed shootout', () => expect(penaltyResult(3, 2, 3)).toBe('aurora'));
  it('formats the match clock', () => expect(formatClock(179.2)).toBe('03:00'));
});
