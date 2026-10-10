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

  /**
   * 준결승·결승에서는 배경을 한 단계 진하게 낸다.
   *
   * 초반 라운드에서 이 조각은 "아직 갈 길이 멀다"는 배경 무늬에 가깝지만, 남은 경기가
   * 한두 개가 되면 **다음 자리에 '우승'이라고 적혀 있는 것 자체가 읽을 값어치가 있다**.
   * 그래도 배경은 배경이라 카드보다 앞서지 않을 만큼만 올린다.
   */
  const prominent = match.round_num <= 2;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden items-center justify-center overflow-hidden sm:flex"
    >
      {/*
        **고르는 순간에는 이 층 전체를 걷는다(2026-08-30).**

        예전엔 여기서 "선택한 쪽이 다음 자리로 올라가는" 것을 보여 줬다 — 오른쪽 자리가
        이긴 항목의 제목으로 바뀌고 `text-primary` 로 밝아졌다. 그런데 **이긴 카드가 직접
        상대를 튕겨 내고 중앙으로 오는 연출이 생기면서 같은 말을 두 번 하게 됐고**, 하필
        그 배경 상자가 카드가 도착하는 자리에 있어서 **움직이는 카드 뒤로 그 카드의 제목이
        비치는 것처럼 보였다.** 승자가 어디로 가는지는 이제 카드 자신이 말한다.

        걷는 것은 이 순간뿐이다 — 다음 경기가 올라오면 트리는 그대로 돌아온다.
      */}
      <div
        className={[
          'flex w-full max-w-3xl items-center gap-4 px-6 transition-opacity duration-300',
          justPicked ? 'opacity-0' : prominent ? 'opacity-40' : 'opacity-25',
        ].join(' ')}
      >
        {/* 현재 경기의 두 자리 */}
        <div className="flex flex-1 flex-col gap-10">
          {[match.item_a_id, match.item_b_id].map((id) => (
            <div key={id} className="border-border truncate rounded-md border px-3 py-2 text-xs">
              {label(id)}
            </div>
          ))}
        </div>

        {/* 두 자리를 다음 경기로 잇는 갈래 */}
        <div className="flex h-24 w-10 shrink-0 flex-col justify-between">
          <div className="border-border h-1/2 border-t border-r" />
          <div className="border-border h-1/2 border-r border-b" />
        </div>

        {/*
          승자가 올라갈 자리. 결승이면 우승 자리다.
          **여기에 이긴 항목의 제목을 채워 넣지 않는다** — 위 주석 참고.
        */}
        <div className="flex flex-1 justify-start">
          <div className="border-border w-full truncate rounded-md border border-dashed px-3 py-2 text-xs opacity-60">
            {parent ? '다음 경기' : '우승'}
          </div>
        </div>
      </div>
    </div>
  );
}
