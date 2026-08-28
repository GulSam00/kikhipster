'use client';

import { parentMatch } from '@/lib/domain/bracket';
import type { PoolItem } from '@/lib/domain/pool-item';
import type { Play, PlayRound } from '@/types/tournament';

interface Props {
  play: Play;
  match: PlayRound;
  items: Record<string, PoolItem>;
  /** 방금 고른 항목. 다음 자리로 올라가는 표시를 켠다. */
  justPicked: string | null;
}

/**
 * 대결 카드 뒤에 깔리는 대진표 조각.
 *
 * **전체 트리가 아니라 현재 경기와 그 승자가 올라갈 다음 자리까지만** 그린다
 * (DESIGN.md § Visual reference, 2026-08-27 개정). 128강에서 전체를 깔면 선과 점의
 * 덩어리가 되고, "선택한 쪽이 올라간다"는 것도 이 범위에서 가장 잘 읽힌다.
 *
 * `sm` 미만에서는 렌더하지 않는다 — 좁은 화면에서는 페이지가 가로로 밀리거나
 * 알아볼 수 없을 만큼 줄여야 한다(§ Mobile 예외 조항).
 */
export default function BracketBackground({ play, match, items, justPicked }: Props) {
  const parent = parentMatch(play, match);
  const label = (id: string) => items[id]?.title ?? '…';

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden items-center justify-center overflow-hidden sm:flex"
    >
      <div className="flex w-full max-w-3xl items-center gap-4 px-6 opacity-25">
        {/* 현재 경기의 두 자리 */}
        <div className="flex flex-1 flex-col gap-10">
          {[match.item_a_id, match.item_b_id].map((id) => (
            <div
              key={id}
              className={[
                'truncate rounded-md border border-border px-3 py-2 text-xs transition-opacity duration-500',
                justPicked && justPicked !== id ? 'opacity-30' : '',
              ].join(' ')}
            >
              {label(id)}
            </div>
          ))}
        </div>

        {/* 두 자리를 다음 경기로 잇는 갈래 */}
        <div className="flex h-24 w-10 shrink-0 flex-col justify-between">
          <div className="h-1/2 border-t border-r border-border" />
          <div className="h-1/2 border-r border-b border-border" />
        </div>

        {/* 승자가 올라갈 자리. 결승이면 우승 자리다. */}
        <div className="flex flex-1 justify-start">
          <div
            className={[
              'w-full truncate rounded-md border px-3 py-2 text-xs transition-all duration-500',
              justPicked
                ? 'border-primary text-primary opacity-100'
                : 'border-dashed border-border opacity-60',
            ].join(' ')}
          >
            {justPicked ? label(justPicked) : parent ? '다음 경기' : '우승'}
          </div>
        </div>
      </div>
    </div>
  );
}
