import { ArrowLeft, Disc3, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import CoverImage from '@/components/common/CoverImage';
import ShareButton from '@/components/common/ShareButton';
import CommentSection from '@/components/social/CommentSection';
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

import { getRanking } from '@/lib/api/tournaments';
import { fetchPoolItems } from '@/lib/domain/pool-item';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** 순위 추이 셀. 신규(비교 시점에 표본 없음)는 대시가 아니라 '신규'로 구분한다. */
function TrendCell({ delta }: { delta: number | null }) {
  const t = useTranslations('Ranking');
  if (delta === null) {
    return <span className="text-muted-foreground text-sm">{t('new')}</span>;
  }
  if (delta === 0) {
    return (
      <span className="text-muted-foreground flex items-center gap-0.5 text-sm">
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
  const [ranking, t, tt, tp] = await Promise.all([
    getRanking(id),
    getTranslations('Ranking'),
    getTranslations('ItemType'),
    getTranslations('PoolItem'),
  ]);

  const items = await fetchPoolItems(
    ranking.item_type,
    ranking.items.map((i) => i.item_id),
  );
  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));
  const label = tt(ranking.item_type);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href={`/tournament/${id}`}>
          <ArrowLeft />
          {t('backToTournament')}
        </Link>
      </Button>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold">{t('title', { title: ranking.title })}</h1>
        <ShareButton path={`/tournament/${id}/ranking`} />
      </div>
      <p className="text-muted-foreground mb-6 text-sm tabular-nums">
        {t('basis', { plays: ranking.total_plays })}
      </p>

      {ranking.items.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t('empty')}</p>
      ) : (
        <Table className="mb-8">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{t('rank')}</TableHead>
              <TableHead>{label}</TableHead>
              <TableHead className="text-right">{t('championshipRate')}</TableHead>
              <TableHead className="text-right">{t('winRate')}</TableHead>
              <TableHead className="text-right">{t('trend')}</TableHead>
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
                        <p className="truncate text-lg font-medium">{item?.title ?? row.item_id}</p>
                        <p className="text-muted-foreground truncate text-sm">{item?.subtitle}</p>
                      </div>
                      {item && (
                        // 재생과 앨범으로 가기를 나란히 둔다 — 후보 그리드와 같은 짝이다.
                        <div className="flex shrink-0 items-center gap-1">
                          {ranking.item_type === 'album' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground rounded-full"
                              asChild
                            >
                              <Link
                                href={`/albums/${item.id}`}
                                aria-label={tp('viewAlbum', { title: item.title })}
                              >
                                <Disc3 />
                              </Link>
                            </Button>
                          )}
                          <PoolItemPlayButton
                            item={item}
                            itemType={ranking.item_type}
                            className="text-muted-foreground hover:text-foreground rounded-full"
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
                    <p className="text-muted-foreground text-sm">
                      {row.championship_count}/{row.play_count}
                    </p>
                  </TableCell>

                  <TableCell className="py-3 text-right tabular-nums">
                    <p className="text-lg">{percent(row.match_win_rate)}</p>
                    <p className="text-muted-foreground text-sm">
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
          <TableCaption>{t('caption', { days: ranking.trend_days })}</TableCaption>
        </Table>
      )}

      <Separator className="mb-6" />

      <CommentSection targetType="tournament" targetId={id} />
    </div>
  );
}
