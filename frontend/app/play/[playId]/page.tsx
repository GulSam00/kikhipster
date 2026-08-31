'use client';

import { BarChart3, GitBranch, Swords, Trophy } from 'lucide-react';
import { animate } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import CountUp from '@/components/reactbits/CountUp';
import ShinyText from '@/components/reactbits/ShinyText';
import StarBorder from '@/components/reactbits/StarBorder';
import CommentSection from '@/components/social/CommentSection';
import BracketBackground from '@/components/tournament/BracketBackground';
import FlapCounter from '@/components/tournament/FlapCounter';
import FullBracket from '@/components/tournament/FullBracket';
import PoolItemPlayButton from '@/components/tournament/PoolItemPlayButton';
import { ItemFallbackIcon } from '@/components/tournament/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

import { getPlay, voteRound } from '@/lib/api/plays';
import { getRanking } from '@/lib/api/tournaments';
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

/**
 * 라운드 제목의 "희귀도".
 *
 * 라운드가 올라갈수록 제목이 더 귀해 보이게 한다. **색상환으로 등급을 나누는 흔한 방식은
 * 여기서 쓸 수 없다** — DESIGN.md § Color budget 이 saturated 토큰을 `primary`(amber)와
 * `destructive` 둘로 제한하는데, 이 화면은 선택 버튼 두 개로 이미 WARN 선에 걸쳐 있다.
 * 대신 § Visual reference 가 다크 UI 에 대해 말하는 축을 쓴다 — **"캔버스가 검을수록
 * 그림자보다 밝기 단계로 위계를 표현한다."** 그래서 등급을 나누는 것은 색상이 아니라
 * ① 광택이 얼마나 밝게 훑는지 ② 얼마나 자주 훑는지 두 가지다.
 *
 * `shine` 은 `--muted-foreground` 에서 `--foreground` 로 가는 비율(%)이다. hex 를 새로
 * 만들지 않고 `color-mix()` 로 두 토큰 사이를 섞으므로 § Color 의 하드코딩 금지에 걸리지
 * 않고, 테마가 바뀌어도 따라간다.
 *
 * 키는 `round_num` 인데 **이건 경기 수가 아니라 지수다** — `roundLabel()` 이
 * `2 ** roundNum` 으로 이름을 만든다(5 → `32강`, 3 → `8강`). 1·2 만 결승·준결승으로 예외.
 *
 * 표에 없는 라운드(64강·128강 = 6·7)는 광택이 아예 없다. 아직 귀할 단계가 아니고,
 * 128강에서부터 제목이 번쩍이면 결승까지 갈 곳이 없다.
 */
const TITLE_RARITY: Record<number, { shine: number; speed: number; delay: number }> = {
  5: { shine: 35, speed: 6, delay: 4 }, // 32강
  4: { shine: 55, speed: 5, delay: 3 }, // 16강
  3: { shine: 75, speed: 4, delay: 2.5 }, // 8강
  2: { shine: 90, speed: 3.5, delay: 2 }, // 준결승
  1: { shine: 100, speed: 3, delay: 1.5 }, // 결승 — 여기가 천장이라 이 값은 건드리지 않는다
};

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
  const reduced = useReducedMotion();

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
      // 620ms 짜리 튕겨내기 연출이 끝나고 한 박자 뒤에 다음 경기로 넘긴다
      // (`--animate-battle-winner`).
      if (!reduced) await new Promise((r) => setTimeout(r, 680));

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
        <Trophy className="text-primary mx-auto mb-4 size-15" />

        {/* 우승은 이 화면의 주인공이라 커버를 크게 놓는다 — 대결 카드보다 크다. */}
        <div className="bg-muted relative mx-auto mb-4 aspect-square w-full max-w-xs overflow-hidden rounded-xl">
          {winner?.coverUrl ? (
            <Image
              src={winner.coverUrl}
              alt={winner.title}
              fill
              sizes="320px"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
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

        <h2 className="font-heading mb-1 text-2xl font-bold">{winner?.title ?? '알 수 없음'}</h2>
        <p className="text-muted-foreground mb-6">{winner?.subtitle}</p>

        {/*
          누적 성적. 이 판 한 번의 결과가 아니라 이 월드컵 전체에서의 성적이라 분수를 같이
          둔다 — 랭킹표와 같은 조합(비율 크게, 근거 작게)이다.
        */}
        {winnerStats && (
          <div className="mb-8 grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-1">
                <p className="text-muted-foreground text-xs">우승 비율</p>
                <p className="text-xl font-bold tabular-nums">
                  {reduced ? (
                    Math.round(winnerStats.championship_rate * 100)
                  ) : (
                    <CountUp to={Math.round(winnerStats.championship_rate * 100)} duration={1.2} />
                  )}
                  %
                </p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {winnerStats.championship_count}/{winnerStats.play_count}판
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-0.5 py-1">
                <p className="text-muted-foreground text-xs">승률</p>
                <p className="text-xl font-bold tabular-nums">
                  {reduced ? (
                    Math.round(winnerStats.match_win_rate * 100)
                  ) : (
                    <CountUp to={Math.round(winnerStats.match_win_rate * 100)} duration={1.2} />
                  )}
                  %
                </p>
                <p className="text-muted-foreground text-xs tabular-nums">
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

        {/*
          결과를 보고 난 자리가 이야기가 나오는 자리다.

          **판(play)이 아니라 월드컵에 단다.** 판은 사람마다 매번 새로 생기므로 판별 댓글은
          아무도 다시 안 본다 — 월드컵 상세(`/tournament/{id}`)와 **같은 실**을 써야 대화가
          쌓인다. `targetType` 만 맞추면 같은 컴포넌트가 그대로 돌아간다.
        */}
        <div className="mt-10 text-left">
          <CommentSection targetType="tournament" targetId={play.tournament_id} />
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
        <p className="text-muted-foreground min-w-0 truncate text-sm">{play.tournament_title}</p>
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
  const reduced = useReducedMotion();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /**
   * 고른 카드가 상대를 튕겨 내보내고 가운데로 온다.
   *
   * **왜 CSS keyframes 가 아니라 스프링인가**(2026-08-30 교체, 이전 판은
   * `backup/2026-08-30-battle-css-keyframes/`). keyframes 는 정해진 궤적을 재생할 뿐이라
   * 부딪히는 순간의 반동이 손으로 찍은 값이었다. 스프링은 **목표를 지나쳤다가 되돌아오는
   * 것이 계산 결과**라 밀고 들어갔다 자리 잡는 동작이 저절로 나온다. 그러면서도 스프링은
   * 목표값으로 **수렴**하므로 "이긴 카드가 정확히 가운데에 선다"는 요구가 깨지지 않는다
   * — 물리 엔진(matter-js 등)을 안 쓴 이유가 이것이다. 강체 시뮬레이션은 정해진 좌표에
   * 서지 않는다.
   *
   * 이동 거리를 CSS `calc` 로 만들지 않고 **두 카드의 실제 화면 좌표를 재서** 쓴다.
   * 두 중심의 중점이 곧 격자의 중앙이라 간격을 따로 알 필요가 없다.
   */
  useEffect(() => {
    if (!justPicked || reduced) return;

    const winnerEl = cardRefs.current[justPicked];
    const loserId = justPicked === match.item_a_id ? match.item_b_id : match.item_a_id;
    const loserEl = cardRefs.current[loserId];
    if (!winnerEl || !loserEl) return;

    const w = winnerEl.getBoundingClientRect();
    const l = loserEl.getBoundingClientRect();
    const toCenter = (l.left + l.width / 2 - (w.left + w.width / 2)) / 2;
    const dir = Math.sign(toCenter) || 1;
    // 진 카드가 화면 밖으로 완전히 빠지는 거리. 여유 40px.
    const fly = dir > 0 ? window.innerWidth - l.left + 40 : -(l.right + 40);

    /*
      **먼저 반대쪽으로 살짝 뺐다가 출발한다**(anticipation). 치기 전에 뒤로 당기는 그
      동작이라, 이게 있어야 "밀어냈다" 로 읽히고 없으면 그냥 미끄러지는 것으로 보인다.

      이 한 구간만 스프링이 아니라 **키프레임으로 직접 그린다.** 스프링은 목표를 지나쳤다
      돌아오는 것(follow-through)은 저절로 만들지만 **출발 전에 반대로 빼는 것은 만들지
      않는다** — 초기 속도를 음수로 주면 비슷해지지만 그러면 수렴 시간이 열려 있어 다음
      경기가 애니메이션 도중에 끼어들 수 있다. 여기서는 끝나는 시각이 정해져 있어야 한다
      (투표 핸들러가 680ms 뒤에 판을 넘긴다).

      두 번째 구간의 베지어는 y2 가 1 을 넘어 **중앙을 지나쳐 상대 쪽으로 더 갔다가**
      돌아온다 — 스프링의 `bounce` 가 하던 일을 그대로 한다.
    */
    const windup = Math.min(Math.abs(toCenter) * 0.16, 26);
    animate(
      winnerEl,
      { x: [0, -dir * windup, toCenter] },
      {
        duration: 0.62,
        times: [0, 0.2, 1],
        ease: ['easeOut', [0.22, 1.1, 0.36, 1]],
      },
    );
    // 커지는 것은 궤적과 무관하므로 스프링 그대로 둔다.
    animate(winnerEl, { scale: 1.06 }, { type: 'spring', duration: 0.5, bounce: 0.35 });

    /*
      맞고 나가는 쪽은 튕기지 않는다(`bounce: 0`). **뒤로 뺐다가 되돌아온 이긴 카드가
      실제로 닿는 시점**(0.2초 언저리)에 출발해야 맞아서 밀리는 것으로 읽힌다.
      0.2 + 0.45 = 0.65초라 대기(680ms) 안에 들어간다.
    */
    animate(
      loserEl,
      { x: fly, rotate: dir * 18 },
      { type: 'spring', duration: 0.45, bounce: 0, delay: 0.2 },
    );
    // 날아가는 내내 불투명해야 한다 — 반투명해지면 그 뒤로 이긴 카드가 비쳐 보인다.
    animate(loserEl, { opacity: [1, 1, 0] }, { duration: 0.45, times: [0, 0.75, 1], delay: 0.2 });
  }, [justPicked, reduced, match.item_a_id, match.item_b_id]);

  /*
    예전엔 여기서 준결승·결승에 "이기는 쪽이 우승합니다" 같은 한 줄을 제목 아래 붙였다.
    뺐다 — 판이 끝나 간다는 건 제목과 배경 대진표('우승' 자리)가 이미 말하고 있어서,
    같은 말을 문장으로 한 번 더 하는 것이 거슬렸다.
  */
  const rarity = TITLE_RARITY[match.round_num];
  const title = roundLabel(match.round_num);

  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <BracketBackground play={play} match={match} items={items} justPicked={justPicked} />

      <div className="relative">
        {/*
          예전엔 "어느 쪽이 더 좋으신가요?" 가 있던 자리다. 매 경기 같은 문장을 읽는 것보다
          지금 몇 강의 몇 번째인지가 훨씬 쓸모 있다 — 128강이면 이게 없으면 끝이 안 보인다.
        */}
        {/*
          제목과 진행도를 세로로 나눈다. 예전엔 `16강 1/4` 한 덩어리였는데, 둘은 성격이
          다른 값이다 — **제목은 라운드마다 귀해지는 것이고(희귀도), 진행도는 어느
          라운드에서나 똑같이 읽히는 계기판**이다. 한 줄에 붙여 두면 제목에 건 광택이
          숫자까지 훑어서 그 구분이 사라진다.
        */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <p
            className={[
              'font-heading flex items-center justify-center gap-2 font-bold',
              // h1급을 키우는 것은 이 화면에서 이 한 줄뿐이다(§ Typography 계층 규칙).
              isFinal ? 'text-3xl' : 'text-2xl',
            ].join(' ')}
          >
            {/*
              트로피는 색을 입히지 않는다. 이 화면의 primary 는 선택 버튼 두 개로
              이미 § Color budget 의 WARN 선(2개)에 걸쳐 있다.
            */}
            {isFinal && <Trophy className="size-7" />}
            {/*
              제목을 라운드별로 다르게 훑는다(React Bits `ShinyText`, 등급표는 위
              `TITLE_RARITY`). 광택은 `--muted-foreground` 바탕 위를 `--foreground` 쪽으로
              섞인 색이 지나가는 것이라 전부 무채색이다 — § Color budget 의 primary 2개
              (선택 버튼)는 어느 라운드에서도 그대로다.

              `color`/`shineColor` 에 hex 대신 CSS 변수와 `color-mix()` 를 넘긴다. 원본
              기본값은 `#b5b5b5`/`#ffffff` 하드코딩인데, 이 값들은 그대로
              `linear-gradient()` 문자열에 들어가므로 색 함수도 똑같이 동작한다.

              `key` 에 라운드를 넣어야 라운드가 바뀔 때 광택 주기가 처음부터 다시 돈다 —
              안 그러면 32강의 느린 주기를 물려받은 채로 결승에 들어간다.
            */}
            {rarity && !reduced ? (
              <ShinyText
                key={match.round_num}
                text={title}
                speed={rarity.speed}
                delay={rarity.delay}
                color="var(--muted-foreground)"
                shineColor={`color-mix(in oklch, var(--foreground) ${rarity.shine}%, var(--muted-foreground))`}
              />
            ) : (
              <span>{title}</span>
            )}
          </p>

          {/*
            결승은 한 경기뿐이라 `1/1` 이 정보가 아니다 — 계기판 자체를 걸지 않는다.
          */}
          {!isFinal && <FlapCounter index={progress.index} total={progress.total} />}
        </div>

        {/*
          진 카드가 화면 밖으로 날아가도 **페이지가 가로로 늘어나면 안 된다**
          (§ Mobile 의 가로 스크롤 금지는 BLOCK 사안이다). 그래서 가로만 잘라낸다.
          `overflow-x: clip` 은 `overflow-y: visible` 을 `auto` 로 강등시키지 않으므로
          (다른 축이 `clip` 이면 `visible` 이 유지된다) 이긴 카드가 커지는 `scale` 은
          위아래로 안 잘린다. `overflow-x-hidden` 이었으면 잘린다.

          **문제는 잘리는 선이 격자와 정확히 같은 폭이었다는 것이다.** 카드가 칸을 꽉
          채우고 있어서, 중앙으로 가기 전에 바깥쪽으로 빼는 반동(anticipation)이 나오는
          족족 잘렸다. 잘리는 선을 카드 바깥으로 밀어 여유를 만든다 — 두 가지를 같이 쓴다.

          ① `-mx-4 px-4` — 래퍼를 페이지 컨테이너의 좌우 여백(`px-4`)만큼 넓히고 그
             안쪽 패딩으로 격자를 제자리에 돌려놓는다. **레이아웃은 그대로인데 잘리는
             선만 16px 씩 바깥으로 간다**(clip 은 패딩 상자 기준이라 패딩 안은 안 잘린다).
             `-mx-4` 가 안전한 최대치다 — 이보다 키우면 래퍼가 컨테이너 바깥으로 나가
             좁은 화면에서 진짜 가로 스크롤이 생긴다.
          ② `overflow-clip-margin` — 잘리는 선을 거기서 24px 더 민다. 지원하지 않는
             브라우저에서는 무시되고 ①의 16px 만 남는다(깨지지 않는다).

          그래서 반동이 안 잘리고 보이는 한계는 **약 40px**(미지원 브라우저는 16px)이다.
          `windup` 상한을 그보다 크게 잡으면 다시 잘린다.
        */}
        <div className="-mx-4 overflow-x-clip px-4 py-2 [overflow-clip-margin:1.5rem]">
          {/*
          결승은 두 장만 남은 화면이라 카드 사이를 벌려 한 장씩 크게 보이게 한다.
          예전엔 이 간격을 `--battle-gap` 변수로 들고 CSS keyframes 가 읽어 갔는데,
          이제 이동 거리를 **두 카드의 실제 화면 좌표를 재서** 구하므로 필요 없다.
        */}
          <div
            className={['grid grid-cols-2', isFinal ? 'gap-4 sm:gap-8' : 'gap-3 sm:gap-6'].join(
              ' ',
            )}
          >
            {pair.map((itemId) => {
              const item = items[itemId];
              const won = justPicked === itemId;

              const card = (
                <Card
                  key={itemId}
                  className={[
                    'h-full transition-colors duration-300',
                    // 고른 쪽은 테두리로 표시한다. 움직임은 래퍼에 걸린 스프링이 맡는다.
                    won ? 'border-primary' : '',
                    // 동작 줄이기를 켰으면 날리지 않고 물러나기만 한다.
                    reduced && justPicked && !won ? 'scale-95 opacity-40' : '',
                  ].join(' ')}
                >
                  <CardContent className="flex flex-col items-center gap-3">
                    {/* 카드가 화면을 크게 쓰도록 커버를 정사각으로 꽉 채운다(예전엔 112px 고정). */}
                    <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg">
                      {item?.coverUrl ? (
                        <Image
                          src={item.coverUrl}
                          alt={item.title}
                          fill
                          sizes="(max-width: 640px) 45vw, 380px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="text-muted-foreground flex size-full items-center justify-center">
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
                      <p className="text-muted-foreground truncate text-xs">{item?.subtitle}</p>
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

              /*
              결승 두 장에만 테두리를 두른다(React Bits `StarBorder`). 준결승은 라벨·캡션
              연출까지만 — 둘을 똑같이 꾸미면 "결승이 마지막"이라는 위계가 사라진다.

              커서를 따라가는 `SpotlightCard`/`GlareHover` 대신 이걸 고른 이유는
              **월드컵은 대부분 휴대폰에서 돌리기 때문**이다. 마우스가 필요한 연출은
              모바일에서 아무 일도 일어나지 않는다.
            */
              const inner =
                isFinal && !reduced ? (
                  <StarBorder className="h-full" speed="7s">
                    {card}
                  </StarBorder>
                ) : (
                  card
                );

              return (
                /*
                애니메이션은 카드가 아니라 이 래퍼에 건다 — 결승에서는 카드가 `StarBorder`
                안에 들어가서 격자 칸의 주인이 바뀌기 때문이다. 래퍼가 항상 칸의 주인이면
                두 경우를 같은 코드로 다룰 수 있다.

                **`key` 에 경기 id 를 섞는 게 중요하다.** 이긴 항목은 다음 경기에도 나오므로
                `key` 가 항목 id 뿐이면 React 가 같은 DOM 노드를 재사용하는데, 그 노드에는
                `motion` 이 남긴 인라인 transform(가운데로 옮겨 놓은 값)이 그대로 붙어 있다.
                경기가 바뀌면 새 노드가 되게 해서 그 잔상을 없앤다.
              */
                <div
                  key={`${match.id}-${itemId}`}
                  ref={(el) => {
                    cardRefs.current[itemId] = el;
                  }}
                  className={[
                    'h-full',
                    // 밀려나는 카드가 위에 그려져야 한다. 겹치는 구간에서 이긴 카드가
                    // 진 카드를 뚫고 나오면 안 된다.
                    justPicked ? (won ? 'relative z-10' : 'relative z-20') : '',
                  ].join(' ')}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
