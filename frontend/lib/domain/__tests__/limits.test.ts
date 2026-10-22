import { describe, expect, it } from 'vitest';

import {
  clampTopsterSide,
  TOPSTER_MAX_CELLS,
  TOPSTER_MAX_SIDE,
  TOPSTER_MIN_SIDE,
  VALID_PLAY_SIZES,
} from '@/lib/domain/limits';

describe('clampTopsterSide', () => {
  it('범위 안의 값은 그대로', () => {
    expect(clampTopsterSide('3', 3)).toBe(3);
  });

  it('한 변은 1~5 로 눌러 담는다', () => {
    expect(clampTopsterSide('0', 3)).toBe(TOPSTER_MIN_SIDE);
    expect(clampTopsterSide('99', 1)).toBe(TOPSTER_MAX_SIDE);
  });

  it('숫자가 아니면 최소값', () => {
    expect(clampTopsterSide('abc', 3)).toBe(TOPSTER_MIN_SIDE);
    expect(clampTopsterSide('', 3)).toBe(TOPSTER_MIN_SIDE);
  });

  it('소수는 반올림한다', () => {
    expect(clampTopsterSide('2.6', 3)).toBe(3);
  });

  it('전체 칸 수(가로×세로)가 25 를 넘지 않게 반대 축에 맞춰 줄인다', () => {
    for (let other = 1; other <= TOPSTER_MAX_SIDE; other++) {
      const side = clampTopsterSide('5', other);
      expect(side * other).toBeLessThanOrEqual(TOPSTER_MAX_CELLS);
    }
  });
});

describe('백엔드와 맞춰야 하는 상수', () => {
  it('강수는 4 에서 128 까지 2 의 거듭제곱', () => {
    expect([...VALID_PLAY_SIZES]).toEqual([4, 8, 16, 32, 64, 128]);
  });
});
