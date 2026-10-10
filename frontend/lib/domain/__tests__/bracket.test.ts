import { describe, expect, it } from 'vitest';

import { nextMatch, parentMatch, roundLabel, toRounds } from '@/lib/domain/bracket';

import type { Play, PlayRound } from '@/types/tournament';

const round = (
  round_num: number,
  match_num: number,
  winner_id: string | null = null,
): PlayRound => ({
  id: `r${round_num}-${match_num}`,
  round_num,
  match_num,
  item_a_id: `a${round_num}${match_num}`,
  item_b_id: `b${round_num}${match_num}`,
  winner_id,
});

function play(rounds: PlayRound[]): Play {
  return { rounds } as Play;
}

/** 8강(round_num 3) 4경기 + 준결승 2 + 결승 1. 서버는 섞인 평평한 배열로 준다. */
const full = play([
  round(1, 0),
  round(3, 2),
  round(2, 1),
  round(3, 0),
  round(3, 3),
  round(2, 0),
  round(3, 1),
]);

describe('roundLabel', () => {
  it('1 은 결승, 2 는 준결승, 나머지는 2 의 거듭제곱 강', () => {
    expect(roundLabel(1)).toBe('결승');
    expect(roundLabel(2)).toBe('준결승');
    expect(roundLabel(3)).toBe('8강');
    expect(roundLabel(5)).toBe('32강');
    expect(roundLabel(7)).toBe('128강');
  });
});

describe('toRounds', () => {
  it('앞 라운드에서 결승 순으로 묶고 경기는 match_num 순으로 정렬한다', () => {
    const rounds = toRounds(full);
    expect(rounds.map((r) => r.label)).toEqual(['8강', '준결승', '결승']);
    expect(rounds[0].matches.map((m) => m.match_num)).toEqual([0, 1, 2, 3]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const before = full.rounds.map((r) => r.id);
    toRounds(full);
    expect(full.rounds.map((r) => r.id)).toEqual(before);
  });
});

describe('nextMatch', () => {
  it('승자가 없는 경기 중 가장 앞 라운드의 첫 경기', () => {
    expect(nextMatch(full)?.id).toBe('r3-0');
  });

  it('앞 라운드가 끝났으면 다음 라운드로 넘어간다', () => {
    const p = play(full.rounds.map((r) => (r.round_num === 3 ? { ...r, winner_id: 'x' } : r)));
    expect(nextMatch(p)?.id).toBe('r2-0');
  });

  it('전부 끝났으면 null', () => {
    expect(nextMatch(play(full.rounds.map((r) => ({ ...r, winner_id: 'x' }))))).toBeNull();
  });
});

describe('parentMatch', () => {
  const find = (id: string) => full.rounds.find((r) => r.id === id)!;

  it('다음 라운드의 match_num 은 현재의 절반(내림)', () => {
    expect(parentMatch(full, find('r3-0'))?.id).toBe('r2-0');
    expect(parentMatch(full, find('r3-1'))?.id).toBe('r2-0');
    expect(parentMatch(full, find('r3-2'))?.id).toBe('r2-1');
    expect(parentMatch(full, find('r3-3'))?.id).toBe('r2-1');
    expect(parentMatch(full, find('r2-1'))?.id).toBe('r1-0');
  });

  it('결승에는 다음 경기가 없다', () => {
    expect(parentMatch(full, find('r1-0'))).toBeNull();
  });
});
