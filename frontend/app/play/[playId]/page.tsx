'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, GitBranch, Swords, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { getPlay, voteRound } from '@/lib/api/plays';
import { getRanking } from '@/lib/api/tournaments';
import BracketBackground from '@/components/tournament/BracketBackground';
import FullBracket from '@/components/tournament/FullBracket';
import PoolItemPlayButton from '@/components/tournament/PoolItemPlayButton';
import { ItemFallbackIcon } from '@/components/tournament/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { nextMatch, roundLabel } from '@/lib/domain/bracket';
import { fetchPoolItems, type PoolItem } from '@/lib/domain/pool-item';
import type { Play, PlayRound, TournamentRankingItem } from '@/types/tournament';

/**
 * 커버 정중앙에 얹는 재생 버튼. 대결 화면과 우승 화면이 같은 자리·같은 크기를 쓴다.
 *
 * 56px(모바일)·64px(그 이상) 둘 다 § Mobile 의 44px 최소 히트 영역을 넘는다. 320px 에서
 * 두 카드가 나란히 설 때 커버 폭이 110px 안팎이라 거기까지 64px 을 쓰면 앨범 아트가
 * 거의 안 보인다 — 그래서 좁은 화면만 한 단계 줄인다. 반투명 배경 + 블러라 무엇을
 * 고르는 중인지는 버튼 뒤로 비쳐 보인다.
 *
 * **움직임은 뺐다.** Button 프리미티브의 기본값인 hover 색 전환(`transition-all`)과
 * 누를 때 1px 내려가는 것(`active:…translate-y-px`)을 끈다 — 이 화면에서 움직이는 것은
 * 고른 카드가 올라가고 진 카드가 물러나는 전환 하나여야 하고, 커버 한가운데 64px 버튼이
 * 같이 들썩이면 그쪽으로 눈이 간다. hover 색 자체는 남는다(즉시 바뀔 뿐이다) —
 * § Component states 의 hover 피드백은 필수다.
 *
 * `active:` 만 붙여서는 못 끈다. 기본값이 `active:not-aria-[haspopup]:` 라 variant 가
 * 다르면 twMerge 가 둘 다 남기고 specificity 에서 기본값이 이긴다(CLAUDE.md).
 *
 * 가운데 정렬을 `-translate-1/2` 가 아니라 **`inset-0 m-auto`** 로 하는 이유도 같다 —
 * 정렬을 transform 으로 잡아 두면 `active:…translate-y-*` 가 그 transform 을 덮어써서
 * 누르는 순간 버튼이 자기 높이의 절반만큼 아래로 튄다. 크기가 확정된 요소라
 * `inset-0 m-auto` 로 정렬하면 transform 은 비워 둘 수 있다.
 */
const COVER_PLAY_BUTTON =
  'absolute inset-0 m-auto size-14 rounded-full bg-secondary/80 shadow-lg backdrop-blur-sm transition-none active:not-aria-[haspopup]:translate-y-0 sm:size-16';
const COVER_PLAY_ICON = 'size-6 sm:size-7';

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

          {/*
            우승한 곡을 그 자리에서 들을 수 있어야 한다 — 판이 끝나고 나서가 오히려
            "이게 뭐였더라" 하고 눌러 보는 순간이다. 자리·크기는 대결 화면과 같게
            맞췄다(커버 정중앙). 색은 secondary — 이 화면의 primary 는 이미
            Trophy 와 '최종 우승' 두 개다(DESIGN.md § Color budget).
          */}
          {winner && (
            <PoolItemPlayButton
              item={winner}
              itemType={play.item_type}
              variant="secondary"
              className={COVER_PLAY_BUTTON}
              iconClassName={COVER_PLAY_ICON}
            />
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
  /**
   * 준결승·결승은 다르게 차린다.
   *
   * 꾸미기 위한 구분이 아니라 **이 두 라운드에서만 "이기면 어디로 가는지"가 확정된
   * 정보이기 때문**이다. 16강에서 "이기면 8강" 은 당연해서 쓸모가 없지만, 준결승의
   * "이기면 결승"·결승의 "이기면 우승" 은 판이 끝나 간다는 신호다. 남은 경기가 한두
   * 개뿐이라 배경 대진표도 이때부터 실제로 읽힌다.
   */
  const isFinal = match.round_num === 1;
  const isSemi = match.round_num === 2;
  const stake = isFinal
    ? '이기는 쪽이 우승합니다'
    : isSemi
      ? '이기는 쪽이 결승에 오릅니다'
      : null;

  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <BracketBackground play={play} match={match} items={items} justPicked={justPicked} />

      <div className="relative">
        {/*
          예전엔 "어느 쪽이 더 좋으신가요?" 가 있던 자리다. 매 경기 같은 문장을 읽는 것보다
          지금 몇 강의 몇 번째인지가 훨씬 쓸모 있다 — 128강이면 이게 없으면 끝이 안 보인다.
        */}
        <div className="mb-6 text-center">
          <p
            className={[
              'flex items-center justify-center gap-2 font-heading font-bold tabular-nums',
              // h1급을 키우는 것은 이 화면에서 이 한 줄뿐이다(§ Typography 계층 규칙).
              isFinal ? 'text-3xl' : 'text-2xl',
            ].join(' ')}
          >
            {/*
              트로피는 색을 입히지 않는다. 이 화면의 primary 는 선택 버튼 두 개로
              이미 § Color budget 의 WARN 선(2개)에 걸쳐 있다.
            */}
            {isFinal && <Trophy className="size-7" />}
            <span>
              {roundLabel(match.round_num)}
              {/* 결승은 한 경기뿐이라 `1/1` 이 정보가 아니다. */}
              {!isFinal && ` ${progress.index}/${progress.total}`}
            </span>
          </p>
          {stake && <p className="mt-1 text-sm text-muted-foreground">{stake}</p>}
        </div>

        {/* 결승은 두 장만 남은 화면이라 카드 사이를 벌려 한 장씩 크게 보이게 한다. */}
        <div
          className={['grid grid-cols-2', isFinal ? 'gap-4 sm:gap-8' : 'gap-3 sm:gap-6'].join(' ')}
        >
        {pair.map((itemId) => {
          const item = items[itemId];
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
                    내면서 커버를 통째로 재생 자리로 쓸 수 있게 됐다.

                    우측 상단 `size-9` 이던 것을 **정중앙 `size-16`** 으로 옮겼다. 이 화면에서
                    듣기는 곁다리가 아니라 고르기 전에 반드시 하는 일이고, 모서리의 작은
                    버튼은 대결 카드가 커진 지금 눈에 잘 안 들어왔다.
                  */}
                  {item && (
                    <PoolItemPlayButton
                      item={item}
                      itemType={play.item_type}
                      variant="secondary"
                      className={COVER_PLAY_BUTTON}
                      iconClassName={COVER_PLAY_ICON}
                    />
                  )}
                </div>

                <div className="w-full text-center">
                  {/* 카드 내부 제목은 `text-lg` 를 넘지 않는다(§ Typography 계층 규칙). */}
                  <p
                    className={[
                      'truncate font-medium',
                      isFinal ? 'text-base sm:text-lg' : 'text-sm sm:text-base',
                    ].join(' ')}
                  >
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
