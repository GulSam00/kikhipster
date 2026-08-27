'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, GitBranch, Swords, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import BracketBackground from '@/components/music/BracketBackground';
import FullBracket from '@/components/music/FullBracket';
import TrackRow from '@/components/music/TrackRow';
import { ItemFallbackIcon } from '@/components/music/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { nextMatch, roundLabel } from '@/lib/bracket';
import { fetchPoolItems, type PoolItem } from '@/lib/pool-item';
import type { Play, PlayRound } from '@/types/tournament';

export default function PlayPage() {
  const router = useRouter();
  const { playId } = useParams<{ playId: string }>();

  const [play, setPlay] = useState<Play | null>(null);
  const [items, setItems] = useState<Record<string, PoolItem>>({});
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  // 방금 고른 항목. 배경 대진표에서 '다음 자리로 올라가는' 표시를 잠긐 보여주기 위해 둔다.
  const [justPicked, setJustPicked] = useState<string | null>(null);

  const loadItems = useCallback(async (p: Play) => {
    const ids = Array.from(new Set(p.rounds.flatMap((r) => [r.item_a_id, r.item_b_id])));
    if (ids.length === 0) return;
    try {
      const fetched = await fetchPoolItems(p.item_type, ids);
      setItems(Object.fromEntries(fetched.map((i) => [i.id, i])));
    } catch {
      // 메타데이터는 부가 정보다. 실패해도 대진 진행 자체는 막지 않는다.
      toast.error('후보 정보를 불러오지 못했습니다');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await apiFetch<Play>(`/api/plays/${playId}`);
        setPlay(p);
        await loadItems(p);
      } catch {
        toast.error('플레이를 불러오지 못했습니다');
        router.push('/tournament');
      } finally {
        setLoading(false);
      }
    })();
  }, [playId, router, loadItems]);

  async function vote(winnerId: string, roundId: string) {
    if (voting) return;
    setVoting(true);
    // 서버 응답을 기다리기 전에 표시를 먼저 바꿄다 — 누른 직후가 이 피드백이 의미 있는 순간이다.
    setJustPicked(winnerId);
    try {
      const updated = await apiFetch<Play>(`/api/plays/${playId}/rounds/${roundId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ winner_id: winnerId }),
      });
      // 올라가는 표시를 한 박자 보여준 뒤 다음 경기로 넘긴다.
      // prefers-reduced-motion 이면 전환을 기다리게 할 이유가 없어 곱바로 넘긴다.
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) await new Promise((r) => setTimeout(r, 450));

      setPlay(updated);
      setJustPicked(null);
      // 다음 라운드가 새로 만들어졌을 수 있다 — 아직 못 받은 후보만 채운다.
      await loadItems(updated);
    } catch {
      setJustPicked(null);
      toast.error('투표를 반영하지 못했습니다');
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Skeleton className="mx-auto mb-8 h-6 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="aspect-square" />
          <Skeleton className="aspect-square" />
        </div>
      </div>
    );
  }

  if (!play) return null;

  const match = nextMatch(play);

  if (!match) {
    const winner = play.winner_item_id ? items[play.winner_item_id] : undefined;
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <Trophy className="mx-auto mb-3 size-10 text-primary" />
        <p className="mb-2 text-sm text-primary">최종 우승</p>
        <h2 className="mb-1 font-heading text-2xl font-bold">{winner?.title ?? '알 수 없음'}</h2>
        <p className="mb-8 text-muted-foreground">{winner?.subtitle}</p>

        <div className="flex flex-col gap-2">
          {/* Trophy + "최종 우승"이 이미 primary라 여기까지 primary면 색 예산을 넘긴다. */}
          <Button asChild variant="secondary" size="lg" className="h-11 rounded-full">
            <Link href={`/tournament/${play.tournament_id}/ranking`}>
              <BarChart3 />
              랭킹 보기
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 rounded-full">
            <Link href={`/tournament/${play.tournament_id}`}>다시 하기</Link>
          </Button>
        </div>
      </div>
    );
  }

  const remaining = play.rounds.filter((r) => !r.winner_id).length;
  const pair = [match.item_a_id, match.item_b_id];

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      {/* 우측 상단 전환 — 대결 화면 ↔ 전체 대진표 */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{play.tournament_title}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {roundLabel(match.round_num)} · 남은 경기 {remaining}개
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBracket((v) => !v)}
          aria-pressed={showBracket}
          className="shrink-0"
        >
          {showBracket ? <Swords /> : <GitBranch />}
          {showBracket ? '대결로' : '대진표'}
        </Button>
      </div>

      {showBracket ? (
        <FullBracket play={play} items={items} currentMatchId={match.id} />
      ) : (
        <PlayMatch
          play={play}
          match={match}
          pair={pair}
          items={items}
          voting={voting}
          justPicked={justPicked}
          onVote={vote}
        />
      )}
    </div>
  );
}

/** 대결 화면. 배경에 대진표 조각을 깔고 그 위에 카드 두 장을 크게 놓는다. */
function PlayMatch({
  play,
  match,
  pair,
  items,
  voting,
  justPicked,
  onVote,
}: {
  play: Play;
  match: PlayRound;
  pair: string[];
  items: Record<string, PoolItem>;
  voting: boolean;
  justPicked: string | null;
  onVote: (winnerId: string, roundId: string) => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <BracketBackground play={play} match={match} items={items} justPicked={justPicked} />

      <div className="relative">
        <h2 className="mb-6 text-center font-heading text-xl font-bold">
          어느 쪽이 더 좋으신가요?
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {pair.map((itemId) => {
          const item = items[itemId];
          return (
            <Card
              key={itemId}
              className={[
                'transition-all duration-300 hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring',
                // 고른 쪽은 남고 진 쪽은 물러난다. 배경 대진표에서 승자가 올라가는 것과 같은 박자다.
                justPicked === itemId ? 'border-primary' : '',
                justPicked && justPicked !== itemId ? 'scale-95 opacity-40' : '',
              ].join(' ')}
            >
              <CardContent className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => onVote(itemId, match.id)}
                  disabled={voting}
                  className="flex w-full flex-col items-center gap-3 rounded-lg outline-none disabled:opacity-50"
                >
                  {/* 카드가 화면을 크게 쓰도록 커버를 정사각으로 꽉 채운다(예전엔 112px 고정). */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                    {item?.coverUrl ? (
                      <Image
                        src={item.coverUrl}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 45vw, 380px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ItemFallbackIcon itemType={play.item_type} className="size-10" />
                      </div>
                    )}
                  </div>
                  <div className="w-full text-center">
                    <p className="truncate text-sm font-medium sm:text-base">
                      {item?.title ?? '알 수 없음'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item?.subtitle}</p>
                  </div>
                </button>

                {play.item_type === 'track' && item?.previewUrl && (
                  <div className="w-full">
                    <TrackRow
                      track={{
                        id: item.id,
                        name: item.title,
                        duration_ms: item.durationMs ?? 0,
                        explicit: item.explicit ?? false,
                        preview_url: item.previewUrl,
                      }}
                      artist={item.subtitle}
                      albumCover={item.coverUrl}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    </div>
  );
}
