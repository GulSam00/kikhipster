'use client';

import { Check } from 'lucide-react';
import { toRounds } from '@/lib/domain/bracket';
import type { PoolItem } from '@/lib/domain/pool-item';
import type { Play, PlayRound } from '@/types/tournament';

interface Props {
  play: Play;
  items: Record<string, PoolItem>;
  /** 지금 치르는 경기. 어디까지 왔는지 표시한다. */
  currentMatchId: string | null;
}

/**
 * 전체 대진표. 우측 상단 전환 버튼으로 연다.
 *
 * 라운드를 좌→우 열로 놓고 세로로 경기를 쌓는다. 128강이면 열이 7개까지 가므로
 * **가로 스크롤은 이 컨테이너 안에서만** 일어난다 — 페이지가 밀리는 것과는 다르며
 * DESIGN.md § Mobile 예외 조항이 이 경우를 명시한다.
 */
export default function FullBracket({ play, items, currentMatchId }: Props) {
  const rounds = toRounds(play);
  const label = (id: string) => items[id]?.title ?? '알 수 없음';

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {rounds.map((round) => (
          <div key={round.roundNum} className="flex min-w-44 flex-col gap-2">
            <p className="sticky top-0 bg-background pb-1 text-center text-xs font-medium text-muted-foreground">
              {round.label}
            </p>
            {/* 라운드마다 경기 수가 절반씩 줄어 세로로 성기게 놓인다.
                실제 트리 선을 잇는 대신 균등 간격으로 두는 편이 좁은 폭에서 읽기 쉽다. */}
            <div className="flex flex-1 flex-col justify-around gap-2">
              {round.matches.map((m) => (
                <MatchCell
                  key={m.id}
                  match={m}
                  label={label}
                  isCurrent={m.id === currentMatchId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
