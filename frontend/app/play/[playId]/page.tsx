'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, GitBranch, Pause, Play as PlayIcon, Swords, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { getPlay, voteRound } from '@/lib/api/plays';
import { getRanking } from '@/lib/api/tournaments';
import BracketBackground from '@/components/tournament/BracketBackground';
import FullBracket from '@/components/tournament/FullBracket';
import { ItemFallbackIcon } from '@/components/tournament/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { usePoolPlayer } from '@/lib/hooks/use-pool-player';
import { nextMatch, roundLabel } from '@/lib/domain/bracket';
import { fetchPoolItems, type PoolItem } from '@/lib/domain/pool-item';
import type { Play, PlayRound, TournamentRankingItem } from '@/types/tournament';

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
  // 우승 화면에 붙일 이 항목의 누적 성적. 랭킹 응답에서 그 한 줄만 꺼낸다.
  const [winnerStats, setWinnerStats] = useState<TournamentRankingItem | null>(null);

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
        const p = await getPlay(playId);
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

  /**
   * 판이 끝나면 우승 항목의 누적 성적을 받아 온다.
   *
   * 랭킹은 서버가 전체 플레이를 집계해 주는 값이라 **방금 끝난 이 판까지 반영돼 있다**
   * (마지막 투표가 이미 기록된 뒤에 부른다). 실패해도 우승 자체는 보여 준다.
   */
  const winnerItemId = play?.winner_item_id ?? null;
  const tournamentId = play?.tournament_id ?? null;
  useEffect(() => {
    if (!winnerItemId || !tournamentId) return;
    let alive = true;
    (async () => {
      try {
        const ranking = await getRanking(tournamentId);
        if (alive) {
          setWinnerStats(ranking.items.find((i) => i.item_id === winnerItemId) ?? null);
        }
      } catch {
        // 우승 화면의 부가 정보다 — 없으면 성적 칸만 빠진다.
      }
    })();
    return () => {
      alive = false;
    };
  }, [winnerItemId, tournamentId]);

  async function vote(winnerId: string, roundId: string) {
    if (voting) return;
    setVoting(true);
    // 서버 응답을 기다리기 전에 표시를 먼저 바꿄다 — 누른 직후가 이 피드백이 의미 있는 순간이다.
    setJustPicked(winnerId);
    try {
      const updated = await voteRound(playId, roundId, winnerId);
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
      <div className="mx-auto w-full max-w-md px-4 py-12 text-center">
        <Trophy className="mx-auto mb-2 size-10 text-primary" />
        <p className="mb-4 text-sm text-primary">최종 우승</p>

        {/* 우승은 이 화면의 주인공이라 커버를 크게 놓는다 — 대결 카드보다 크다. */}
        <div className="relative mx-auto mb-4 aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-muted">
          {winner?.coverUrl ? (
            <Image
              src={winner.coverUrl}
              alt={winner.title}
              fill
              sizes="320px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ItemFallbackIcon itemType={play.item_type} className="size-12" />
            </div>
          )}
        </div>

        <h2 className="mb-1 font-heading text-2xl font-bold">{winner?.title ?? '알 수 없음'}</h2>
        <p className="mb-6 text-muted-foreground">{winner?.subtitle}</p>

        {/*
          누적 성적. 이 판 한 번의 결과가 아니라 이 월드컵 전체에서의 성적이라 분수를 같이
          둔다 — 랭킹표와 같은 조합(비율 크게, 근거 작게)이다.
        */}
        {winnerStats && (
          <div className="mb-8 grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-1">
                <p className="text-xs text-muted-foreground">우승 비율</p>
                <p className="text-xl font-bold tabular-nums">
                  {Math.round(winnerStats.championship_rate * 100)}%
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {winnerStats.championship_count}/{winnerStats.play_count}판
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-1">
                <p className="text-xs text-muted-foreground">승률</p>
                <p className="text-xl font-bold tabular-nums">
                  {Math.round(winnerStats.match_win_rate * 100)}%
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {winnerStats.match_win_count}/{winnerStats.match_count}경기
                </p>
              </CardContent>
            </Card>
          </div>
        )}

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

  const pair = [match.item_a_id, match.item_b_id];
  // 이 라운드의 경기들 중 몇 번째인지. `match_num` 이 0부터인지 서버 구현에 기대지 않고
  // 정렬된 자리로 센다.
  const roundMatches = play.rounds
    .filter((r) => r.round_num === match.round_num)
    .sort((a, b) => a.match_num - b.match_num);
  const progress = {
    index: roundMatches.findIndex((r) => r.id === match.id) + 1,
    total: roundMatches.length,
  };

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      {/* 우측 상단 전환 — 대결 화면 ↔ 전체 대진표 */}
      <div className="mb-2 flex items-start justify-between gap-2">
        {/* 라운드·진행은 화면 가운데에 크게 나오므로 여기서는 월드컵 이름만 남긴다. */}
        <p className="min-w-0 truncate text-sm text-muted-foreground">{play.tournament_title}</p>
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
          progress={progress}
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
  progress,
}: {
  play: Play;
  match: PlayRound;
  pair: string[];
  items: Record<string, PoolItem>;
  voting: boolean;
  justPicked: string | null;
  onVote: (winnerId: string, roundId: string) => void;
  /** 이 라운드에서 몇 번째 경기인지. `8강 1/4` 로 보여 준다. */
  progress: { index: number; total: number };
}) {
  // 고르기 전에 들어볼 수 있어야 한다 — 곡이면 그 곡, 앨범이면 수록곡 전체가 재생목록으로 간다.
  const { playItem, pendingId, currentId, isPlaying } = usePoolPlayer(play.item_type);

  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <BracketBackground play={play} match={match} items={items} justPicked={justPicked} />

      <div className="relative">
        {/*
          예전엔 "어느 쪽이 더 좋으신가요?" 가 있던 자리다. 매 경기 같은 문장을 읽는 것보다
          지금 몇 강의 몇 번째인지가 훨씬 쓸모 있다 — 128강이면 이게 없으면 끝이 안 보인다.
        */}
        <p className="mb-6 text-center font-heading text-2xl font-bold tabular-nums">
          {roundLabel(match.round_num)} {progress.index}/{progress.total}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {pair.map((itemId) => {
          const item = items[itemId];
          const playable = !!item && (play.item_type === 'album' || !!item.previewUrl);
          const nowPlaying = !!item && currentId === item.id && isPlaying;
          return (
            <Card
              key={itemId}
              className={[
                'transition-all duration-300',
                // 고른 쪽은 남고 진 쪽은 물러난다. 배경 대진표에서 승자가 올라가는 것과 같은 박자다.
                justPicked === itemId ? 'border-primary' : '',
                justPicked && justPicked !== itemId ? 'scale-95 opacity-40' : '',
              ].join(' ')}
            >
              <CardContent className="flex flex-col items-center gap-3">
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

                  {/*
                    재생은 커버 위에, 투표는 카드 아래에. 예전에는 커버를 누르는 것이 곧
                    투표라 미리듣기 버튼을 그 위에 얹을 수 없었다 — 커버에서 투표를 떼어
                    내면서 후보 그리드 타일과 같은 자리(커버 우측 상단)를 쓸 수 있게 됐다.
                  */}
                  {playable && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-2 right-2 size-9 rounded-full bg-secondary/90"
                      onClick={() => void playItem(item)}
                      disabled={pendingId === item.id}
                      aria-label={`${item.title} ${nowPlaying ? '일시정지' : '미리듣기'}`}
                    >
                      {pendingId === item.id ? (
                        <Spinner />
                      ) : nowPlaying ? (
                        <Pause />
                      ) : (
                        <PlayIcon />
                      )}
                    </Button>
                  )}
                </div>

                <div className="w-full text-center">
                  <p className="truncate text-sm font-medium sm:text-base">
                    {item?.title ?? '알 수 없음'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item?.subtitle}</p>
                </div>

                {/*
                  이 화면에서 primary 는 이 두 개뿐이다. 화면의 목적 자체가 둘 중 하나를
                  고르는 것이라 DESIGN.md § Color budget 의 WARN 선(2개)까지 쓴다.
                */}
                <Button
                  size="lg"
                  className="h-11 w-full"
                  onClick={() => onVote(itemId, match.id)}
                  disabled={voting}
                >
                  선택
                </Button>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    </div>
  );
}
