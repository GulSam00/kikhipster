import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import CommentSection from '@/components/music/CommentSection';
import ShareButton from '@/components/music/ShareButton';
import { ItemFallbackIcon } from '@/components/music/PoolItemTile';
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
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/pool-item';
import type { TournamentRanking } from '@/types/tournament';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** 순위 추이 셀. 신규(비교 시점에 표본 없음)는 대시가 아니라 'NEW'로 구분한다. */
function TrendCell({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-muted-foreground">NEW</span>;
  }
  if (delta === 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className="flex items-center gap-0.5 text-xs tabular-nums">
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
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
  const ranking = await apiFetch<TournamentRanking>(`/api/tournaments/${id}/ranking`);

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
              <TableHead className="w-10">순위</TableHead>
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
                  <TableCell className="font-medium tabular-nums">{row.rank}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item?.coverUrl ? (
                          <Image
                            src={item.coverUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <ItemFallbackIcon itemType={ranking.item_type} className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item?.title ?? row.item_id}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{item?.subtitle}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    <span className="text-sm">{percent(row.championship_rate)}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {row.championship_count}/{row.play_count}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    <span className="text-sm">{percent(row.match_win_rate)}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {row.match_win_count}/{row.match_count}
                    </span>
                  </TableCell>

                  <TableCell>
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
