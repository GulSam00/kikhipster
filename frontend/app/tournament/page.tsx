'use client';

import { Plus, Search, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import InfiniteListFooter from '@/components/common/InfiniteListFooter';
import TournamentCard from '@/components/tournament/TournamentCard';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { useInfiniteList } from '@/lib/hooks/use-infinite-list';

import { tournamentListPath } from '@/lib/api/tournaments';

import type { TournamentSort, TournamentSummary } from '@/types/tournament';

const SORTS: TournamentSort[] = ['recent', 'popular_all', 'popular_year', 'popular_month'];

export default function TournamentDashboardPage() {
  const t = useTranslations('TournamentList');
  const tl = useTranslations('List');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<TournamentSort>('recent');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildUrl = useCallback(
    (page: { limit: number; offset: number }) => tournamentListPath(page, { sort, q: debouncedQ }),
    [sort, debouncedQ],
  );

  const { items, loading, loadingMore, reachedEnd, failed, retry, sentinelRef, limit } =
    useInfiniteList<TournamentSummary>({
      key: `${sort}|${debouncedQ}`,
      buildUrl,
      errorMessage: t('loadFailed'),
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">{t('title')}</h1>
        <Button asChild size="lg">
          <Link href="/tournament/new">
            <Plus />
            {t('new')}
          </Link>
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 pl-9"
        />
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        value={sort}
        onValueChange={(v) => v && setSort(v as TournamentSort)}
        className="mb-6"
      >
        {SORTS.map((s) => (
          <ToggleGroupItem key={s} value={s}>
            {tl(`sort.${s}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy />
            </EmptyMedia>
            <EmptyTitle>{debouncedQ ? tl('noResults') : t('empty')}</EmptyTitle>
            <EmptyDescription>
              {debouncedQ ? tl('noResultsDescription') : t('emptyDescription')}
            </EmptyDescription>
          </EmptyHeader>
          {!debouncedQ && (
            <EmptyContent>
              <Button asChild>
                <Link href="/tournament/new">{t('first')}</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}

      <InfiniteListFooter
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
        failed={failed}
        retry={retry}
        reachedEnd={reachedEnd}
        loadedCount={items.length}
        limit={limit}
        skeleton={
          <div
            role="status"
            aria-label={tl('loadingMore')}
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        }
      />
    </div>
  );
}
