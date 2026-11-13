'use client';

import { LayoutGrid, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import InfiniteListFooter from '@/components/common/InfiniteListFooter';
import TopsterCard from '@/components/topster/TopsterCard';
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

import { topsterListPath } from '@/lib/api/topsters';

import type { Topster, TopsterSort } from '@/types/topster';

// 월드컵 대시보드와 같은 축이되 인기 지표는 '플레이 횟수'가 아니라 '좋아요 수'이고,
// 기간별(전체·년·월) 구분 없이 최신순/인기순 두 개만 둔다.
const SORTS: TopsterSort[] = ['recent', 'popular'];

export default function TopstersPage() {
  const t = useTranslations('TopsterList');
  const tl = useTranslations('List');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<TopsterSort>('recent');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildUrl = useCallback(
    (page: { limit: number; offset: number }) => topsterListPath(page, { sort, q: debouncedQ }),
    [sort, debouncedQ],
  );

  const { items, loading, loadingMore, reachedEnd, failed, retry, sentinelRef, limit } =
    useInfiniteList<Topster>({
      key: `${sort}|${debouncedQ}`,
      buildUrl,
      errorMessage: t('loadFailed'),
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">{t('title')}</h1>
        <Button asChild size="lg">
          <Link href="/topsters/new">
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
        onValueChange={(v) => v && setSort(v as TopsterSort)}
        className="mb-6"
      >
        {SORTS.map((s) => (
          <ToggleGroupItem key={s} value={s}>
            {tl(`sort.${s}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>{debouncedQ ? tl('noResults') : t('empty')}</EmptyTitle>
            <EmptyDescription>
              {debouncedQ ? tl('noResultsDescription') : t('emptyDescription')}
            </EmptyDescription>
          </EmptyHeader>
          {!debouncedQ && (
            <EmptyContent>
              <Button asChild>
                <Link href="/topsters/new">{t('first')}</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((t) => (
            <TopsterCard key={t.id} topster={t} />
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
            className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        }
      />
    </div>
  );
}
