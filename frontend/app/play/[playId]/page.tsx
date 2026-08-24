'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import TrackRow from '@/components/music/TrackRow';
import { ItemFallbackIcon } from '@/components/music/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPoolItems, type PoolItem } from '@/lib/pool-item';
import type { Play, PlayRound } from '@/types/tournament';

/** 아직 승자가 없는 경기 중 가장 앞 라운드(=먼저 치러야 할 경기)를 고른다. */
function nextMatch(play: Play): PlayRound | null {
  const pending = play.rounds.filter((r) => !r.winner_id);
  if (pending.length === 0) return null;
  const maxRound = Math.max(...pending.map((r) => r.round_num));
  return (
    pending.filter((r) => r.round_num === maxRound).sort((a, b) => a.match_num - b.match_num)[0] ??
    null
  );
}

/** 남은 경기 수로 현재 라운드 이름을 만든다. 2강이 아니라 '결승'으로 보이게. */
function roundLabel(roundNum: number) {
  return roundNum === 1 ? '결승' : roundNum === 2 ? '준결승' : `${2 ** roundNum}강`;
}

export default function PlayPage() {
  const router = useRouter();
  const { playId } = useParams<{ playId: string }>();

  const [play, setPlay] = useState<Play | null>(null);
  const [items, setItems] = useState<Record<string, PoolItem>>({});
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

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
    try {
      const updated = await apiFetch<Play>(`/api/plays/${playId}/rounds/${roundId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ winner_id: winnerId }),
      });
      setPlay(updated);
      // 다음 라운드가 새로 만들어졌을 수 있다 — 아직 못 받은 후보만 채운다.
      await loadItems(updated);
    } catch {
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
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <p className="mb-1 text-center text-xs text-muted-foreground">{play.tournament_title}</p>
      <p className="mb-2 text-center text-sm text-muted-foreground tabular-nums">
        {roundLabel(match.round_num)} · 남은 경기 {remaining}개
      </p>
      <h2 className="mb-8 text-center font-heading text-xl font-bold">
        어느 쪽이 더 좋으신가요?
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {pair.map((itemId) => {
          const item = items[itemId];
          return (
            <Card
              key={itemId}
              className="transition-colors hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <CardContent className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => vote(itemId, match.id)}
                  disabled={voting}
                  className="flex flex-col items-center gap-3 rounded-lg outline-none disabled:opacity-50"
                >
                  <div className="relative size-28 overflow-hidden rounded-lg bg-muted">
                    {item?.coverUrl ? (
                      <Image src={item.coverUrl} alt={item.title} fill className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ItemFallbackIcon itemType={play.item_type} className="size-7" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{item?.title ?? '알 수 없음'}</p>
                    <p className="text-xs text-muted-foreground">{item?.subtitle}</p>
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
  );
}
