'use client';

import { Check } from 'lucide-react';
import { toRounds } from '@/lib/domain/bracket';
import { useBoxSize } from '@/lib/hooks/use-box-size';
import type { PoolItem } from '@/lib/domain/pool-item';
import type { Play, PlayRound } from '@/types/tournament';

interface Props {
  play: Play;
  items: Record<string, PoolItem>;
  /** 지금 치르는 경기. 어디까지 왔는지 표시한다. */
  currentMatchId: string | null;
}

/** 열 하나의 너비(px, `w-44`)와 열 사이 간격(px, `gap-4`). 연결선 좌표 계산의 기준이다. */
const COL_WIDTH = 176;
const COL_GAP = 16;
const COL_STRIDE = COL_WIDTH + COL_GAP;

/**
 * 라운드 k의 i번째 경기(위에서부터 0-index) 중심의 세로 좌표.
 *
 * 각 열은 `justify-content: space-around` 로 N개 경기를 같은 높이 H 안에 고르게 놓는다.
 * space-around 는 각 경기에 높이 H/N 짜리 "몫"을 주고 그 몫의 정가운데에 경기를 두므로
 * center(i, N) = H * (i + 0.5) / N 이다 — 경기 카드 자체의 높이와 무관하다.
 *
 * 이 공식의 핵심 성질: 다음 라운드 부모 경기 j의 중심은 **그 두 자식(2j, 2j+1)의 중심의
 * 평균과 정확히 같다** — H*(2j+0.5)/N 과 H*(2j+1.5)/N 의 평균이 H*(2j+1)/(N/2) 이기 때문.
 * 그래서 자식 쪽 가로선 두 개를 세로선으로 이었을 때, 그 세로선의 중점이 부모로 가는
 * 가로선의 시작점과 저절로 맞아떨어진다 — 카드 높이를 재지 않고도 정확한 좌표를 낸다.
 */
function centerY(i: number, n: number, height: number): number {
  return (height * (i + 0.5)) / n;
}

/**
 * 전체 대진표. 우측 상단 전환 버튼으로 연다.
 *
 * 라운드를 좌→우 열로 놓고, 열 사이는 **실제 트리 연결선**(SVG)으로 잇는다
 * (2026-08-28, 이전에는 균등 간격으로만 배치해서 큰 강수에서 짝이 어디로 합쳐지는지
 * 눈으로 따라갈 수 없었다). 128강이면 열이 7개까지 가므로 **가로 스크롤은 이 컨테이너
 * 안에서만** 일어난다 — 페이지가 밀리는 것과는 다르며 DESIGN.md § Mobile 예외 조항이
 * 이 경우를 명시한다.
 */
export default function FullBracket({ play, items, currentMatchId }: Props) {
  const rounds = toRounds(play);
  const label = (id: string) => items[id]?.title ?? '알 수 없음';
  const [areaRef, area] = useBoxSize<HTMLDivElement>();

  const totalWidth = rounds.length * COL_WIDTH + Math.max(rounds.length - 1, 0) * COL_GAP;

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: totalWidth }}>
        <div className="mb-1 flex gap-4">
          {rounds.map((round) => (
            <p
              key={round.roundNum}
              className="sticky top-0 w-44 shrink-0 bg-background text-center text-xs font-medium text-muted-foreground"
            >
              {round.label}
            </p>
          ))}
        </div>

        <div ref={areaRef} className="relative flex gap-4">
          {/* 연결선은 경기 카드 뒤에 깔린다 — 카드가 없는 빈 공간에서만 보이면 된다. */}
          {area.height > 0 && (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 stroke-border"
              width={totalWidth}
              height={area.height}
              fill="none"
            >
              {rounds.slice(0, -1).map((round, k) => (
                <RoundConnectors
                  key={round.roundNum}
                  childCount={round.matches.length}
                  parentCount={rounds[k + 1].matches.length}
                  height={area.height}
                  colIndex={k}
                />
              ))}
            </svg>
          )}

          {rounds.map((round) => (
            <div key={round.roundNum} className="flex w-44 shrink-0 flex-col justify-around gap-2">
              {round.matches.map((m) => (
                <MatchCell key={m.id} match={m} label={label} isCurrent={m.id === currentMatchId} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 한 라운드 경계(자식 열 → 부모 열)의 연결선 전부. */
function RoundConnectors({
  childCount,
  parentCount,
  height,
  colIndex,
}: {
  childCount: number;
  parentCount: number;
  height: number;
  colIndex: number;
}) {
  const xRight = colIndex * COL_STRIDE + COL_WIDTH;
  const xLeft = (colIndex + 1) * COL_STRIDE;
  const midX = xRight + COL_GAP / 2;

  return (
    <>
      {Array.from({ length: parentCount }, (_, j) => {
        const topY = centerY(2 * j, childCount, height);
        const botY = centerY(2 * j + 1, childCount, height);
        const parentY = centerY(j, parentCount, height);
        return (
          <g key={j}>
            {/* 두 자식 경기를 하나의 세로선으로 묶는다. */}
            <path d={`M ${xRight} ${topY} H ${midX} V ${botY} H ${xRight}`} strokeWidth={1.5} />
            {/* 세로선의 중점(=부모 중심)에서 부모 경기로 이어진다. */}
            <path d={`M ${midX} ${parentY} H ${xLeft}`} strokeWidth={1.5} />
          </g>
        );
      })}
    </>
  );
}

function MatchCell({
  match,
  label,
  isCurrent,
}: {
  match: PlayRound;
  label: (id: string) => string;
  isCurrent: boolean;
}) {
  return (
    <div
      className={[
        'rounded-md border text-xs',
        isCurrent ? 'border-primary' : 'border-border',
      ].join(' ')}
    >
      {[match.item_a_id, match.item_b_id].map((id, i) => {
        const won = match.winner_id === id;
        const lost = match.winner_id != null && !won;
        return (
          <div
            key={id}
            className={[
              'flex items-center gap-1 px-2 py-1.5',
              i === 0 ? 'border-b border-border' : '',
              won ? 'font-medium text-foreground' : '',
              lost ? 'text-muted-foreground line-through' : '',
            ].join(' ')}
          >
            <span className="truncate">{label(id)}</span>
            {won && <Check className="size-3 shrink-0 text-primary" />}
          </div>
        );
      })}
    </div>
  );
}
