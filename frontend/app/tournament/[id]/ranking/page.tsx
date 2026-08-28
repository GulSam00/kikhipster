import Link from 'next/link';
import { ArrowLeft, Disc3, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { getRanking } from '@/lib/api/tournaments';
import CommentSection from '@/components/social/CommentSection';
import CoverImage from '@/components/common/CoverImage';
import ShareButton from '@/components/common/ShareButton';
import PoolItemPlayButton from '@/components/tournament/PoolItemPlayButton';
import { ItemFallbackIcon } from '@/components/tournament/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/domain/pool-item';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** 순위 추이 셀. 신규(비교 시점에 표본 없음)는 대시가 아니라 'NEW'로 구분한다. */
function TrendCell({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-sm text-muted-foreground">NEW</span>;
  }
  if (delta === 0) {
    return (
      <span className="flex items-center gap-0.5 text-sm text-muted-foreground">
        <Minus className="size-4" />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className="flex items-center gap-0.5 text-sm tabular-nums">
      {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      {Math.abs(delta)}
    </span>
  );
}

export default async function TournamentRankingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ranking = await getRanking(id);

  const items = await fetchPoolItems(
    ranking.item_type,
    ranking.items.map((i) => i.item_id),
  );
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));
  const label = ITEM_TYPE_LABEL[ranking.item_type];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href={`/tournament/${id}`}>
          <ArrowLeft />
          월드컵으로
        </Link>
      </Button>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold">{ranking.title} 랭킹</h1>
        <ShareButton path={`/tournament/${id}/ranking`} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground tabular-nums">
        누적 플레이 {ranking.total_plays}판 기준
      </p>

      {ranking.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">집계할 후보가 없습니다.</p>
      ) : (
        <Table className="mb-8">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">순위</TableHead>
              <TableHead>{label}</TableHead>
              <TableHead className="text-right">우승 비율</TableHead>
              <TableHead className="text-right">승률</TableHead>
              <TableHead className="text-right">추이</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.items.map((row) => {
              const item = itemMap[row.item_id];
              return (
                <TableRow key={row.item_id}>
                  <TableCell className="py-3 text-lg font-medium tabular-nums">
                    {row.rank}
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <CoverImage
                        src={item?.coverUrl}
                        alt={item?.title ?? ''}
                        fallback={
                          <ItemFallbackIcon itemType={ranking.item_type} className="size-6" />
                        }
                        className="size-16 shrink-0 rounded-md"
                        sizes="64px"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-medium">
                          {item?.title ?? row.item_id}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{item?.subtitle}</p>
                      </div>
                      {item && (
                        // 재생과 앨범으로 가기를 나란히 둔다 — 후보 그리드와 같은 짝이다.
                        <div className="flex shrink-0 items-center gap-1">
                          {ranking.item_type === 'album' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full text-muted-foreground hover:text-foreground"
                              asChild
                            >
                              <Link href={`/albums/${item.id}`} aria-label={`${item.title} 앨범 보기`}>
                                <Disc3 />
                              </Link>
                            </Button>
                          )}
                          <PoolItemPlayButton
                            item={item}
                            itemType={ranking.item_type}
                            className="rounded-full text-muted-foreground hover:text-foreground"
                          />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/*
                    비율과 분수를 위아래로 나눈다. 행이 커지면서 한 줄에 붙여 놓은 두 숫자가
                    빈 가로 공간에 떠 보였다 — 큰 값이 비율, 작은 값이 그 근거라는 관계도 이쪽이 낫다.
                  */}
                  <TableCell className="py-3 text-right tabular-nums">
                    <p className="text-lg">{percent(row.championship_rate)}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.championship_count}/{row.play_count}
                    </p>
                  </TableCell>

                  <TableCell className="py-3 text-right tabular-nums">
                    <p className="text-lg">{percent(row.match_win_rate)}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.match_win_count}/{row.match_count}
                    </p>
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex justify-end">
                      <TrendCell delta={row.rank_delta} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableCaption>
            우승 비율 = 우승 횟수 / 뽑혀 나간 플레이 수, 승률 = 이긴 경기 / 치른 1:1 경기.
            플레이마다 후보가 무작위로 뽑히므로 항목별 참가 수가 다릅니다.
            추이는 {ranking.trend_days}일 전 기준 순위와의 차이입니다.
          </TableCaption>
        </Table>
      )}

      <Separator className="mb-6" />

      <CommentSection targetType="tournament" targetId={id} />
    </div>
  );
}
