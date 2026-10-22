'use client';

import type { CSSProperties } from 'react';

import { useBoxSize, type BoxSize } from '@/lib/hooks/use-box-size';

export type { BoxSize };
/**
 * 격자가 들어갈 영역의 크기를 실측한다. 실체는 `use-box-size.ts` 의 범용 훅이다 —
 * 기존 import 경로(`@/lib/hooks/use-topster-grid`)를 쓰는 곳이 이미 있어 여기서도 내보낸다.
 *
 * 왜 CSS로 안 하나: 셀 크기를 `grid-template-rows: repeat(h, min(100%, ...)/h)` 처럼 쓰면
 * **행 트랙의 백분율은 블록 크기 기준**인데 그 값이 불확정이라 트랙이 무너진다
 * (실측: 3x3 셀이 16x5px로 찌그러졌다). 열은 되고 행은 안 되는 비대칭이라 CSS만으로
 * 우회하기 어려워 영역을 재서 px로 못 박는다.
 */
export { useBoxSize };

/**
 * 셀 한 변(px).
 *
 * **격자 자체의 모양은 칸 수에 따라 달라지지만, 격자가 들어가는 영역은 고정이다.**
 * 셀은 정사각형이어야 하고(커버가 정사각형) 격자가 영역을 넘으면 안 되므로
 * 두 축 중 더 빡빡한 쪽이 셀 크기를 정한다:
 *
 *   cell = min((영역폭 - gap*(w-1)) / w, (영역높이 - gap*(h-1)) / h)
 *
 * 영역을 정사각형으로 못 박지 않기 때문에 1x5 같은 세로 격자는 높이를 꽉 쓰고,
 * 5x5는 좁은 축에 맞춰진다. 어느 쪽이든 차지하는 자리는 같다.
 */
export function computeCell(width: number, height: number, gap: number, box: BoxSize): number {
  return Math.max(
    0,
    Math.floor(
      Math.min((box.width - gap * (width - 1)) / width, (box.height - gap * (height - 1)) / height),
    ),
  );
}

/** 격자 스타일. 셀 크기는 computeCell 이 낸 값을 그대로 쓴다. */
export function topsterGridStyle(
  width: number,
  height: number,
  gap: number,
  cell: number,
): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${width}, ${cell}px)`,
    gridTemplateRows: `repeat(${height}, ${cell}px)`,
    gap: `${gap}px`,
  };
}

/**
 * 격자가 영역 안에서 세로 가운데 정렬될 때 위쪽에 생기는 여백(px).
 *
 * 목록을 격자 첫 행에 맞추려면 이만큼 내려서 시작해야 한다. 목록을 통째로 가운데
 * 정렬하는 방법도 있지만, 내용이 영역보다 길어지면 flex 의 auto 마진이 위쪽을
 * 잘라먹는다 — 줄바꿈으로 목록이 길어질 수 있으므로 패딩으로 맞춘다.
 */
export function gridOffsetTop(height: number, gap: number, cell: number, box: BoxSize): number {
  const gridHeight = height * cell + (height - 1) * gap;
  return Math.max(0, Math.round((box.height - gridHeight) / 2));
}
