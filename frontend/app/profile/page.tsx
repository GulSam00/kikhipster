'use client';

import { LayoutGrid, Plus, TriangleAlert, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import InfiniteListFooter from '@/components/common/InfiniteListFooter';
import OwnerItemActions from '@/components/common/OwnerItemActions';
import TopsterCard from '@/components/topster/TopsterCard';
import TournamentCard from '@/components/tournament/TournamentCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

import { useInfiniteList } from '@/lib/hooks/use-infinite-list';

import { getMe } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { myTopstersPath, topsterPath } from '@/lib/api/topsters';
import { myTournamentsPath, tournamentPath } from '@/lib/api/tournaments';

import type { Topster } from '@/types/topster';
import type { TournamentSummary } from '@/types/tournament';
import type { Me } from '@/types/user';

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.push('/login');
      return;
    }
    async function load() {
      try {
        const user = await getMe();
        setMe(user);
        localStorage.setItem('user_id', user.id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push('/login');
          return;
        }
        toast.error('프로필을 불러오지 못했습니다');
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // 목록은 사용자 확인이 끝난 뒤에 부른다 — 비로그인 상태로 먼저 때리면
  // 로그인 화면으로 넘어가기 전에 401 토스트가 뜬다.
  const buildTopsters = useCallback(
    (page: { limit: number; offset: number }) => myTopstersPath(page),
    [],
  );
  const buildTournaments = useCallback(
    (page: { limit: number; offset: number }) => myTournamentsPath(page),
    [],
  );

  const topsterList = useInfiniteList<Topster>({
    key: 'me',
    buildUrl: buildTopsters,
    errorMessage: '탑스터 목록을 불러오지 못했습니다',
    enabled: !!me,
  });
  const tournamentList = useInfiniteList<TournamentSummary>({
    key: 'me',
    buildUrl: buildTournaments,
    errorMessage: '월드컵 목록을 불러오지 못했습니다',
    enabled: !!me,
  });

  const topsters = topsterList.items;
  const tournaments = tournamentList.items;

  if (loading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
        <Spinner />
        불러오는 중...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>불러오지 못했습니다</EmptyTitle>
            <EmptyDescription>일시적인 오류일 수 있습니다. 다시 시도해주세요.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => window.location.reload()}>다시 시도</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Card className="mb-8">
        <CardContent className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
              {me.nickname[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold">{me.nickname}</h1>
            <p className="text-muted-foreground truncate text-sm">{me.email}</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {me.provider}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between">
          {/* 총 개수는 서버가 안 주므로, 끝까지 받았을 때만 숫자를 보인다. */}
          <h2 className="font-heading text-lg font-bold">
            내 탑스터{topsterList.reachedEnd ? ` ${topsters.length}` : ''}
          </h2>
          <Button asChild variant="link" size="sm">
            <Link href="/topsters/new">
              <Plus />
              새로 만들기
            </Link>
          </Button>
        </div>

        {topsterList.loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : topsters.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>아직 만든 탑스터가 없습니다</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/topsters/new">첫 탑스터 만들기</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {topsters.map((t) => (
              <TopsterCard
                key={t.id}
                topster={t}
                showAuthor={false}
                actions={
                  <OwnerItemActions
                    editHref={`/topsters/${t.id}/edit`}
                    deletePath={topsterPath(t.id)}
                    name={t.title}
                    losesOnDelete="댓글도 함께 지워집니다."
                    // 서버가 이미 지웠으므로 목록만 맞춰준다 — 다시 불러오면 왕복이 한 번 더 는다.
                    onDeleted={() => topsterList.removeItem(t.id)}
                  />
                }
              />
            ))}
          </div>
        )}

        <InfiniteListFooter
          sentinelRef={topsterList.sentinelRef}
          loadingMore={topsterList.loadingMore}
          failed={topsterList.failed}
          retry={topsterList.retry}
          reachedEnd={topsterList.reachedEnd}
          loadedCount={topsters.length}
          limit={topsterList.limit}
        />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">
            내 월드컵{tournamentList.reachedEnd ? ` ${tournaments.length}` : ''}
          </h2>
          <Button asChild variant="link" size="sm">
            <Link href="/tournament/new">
              <Plus />
              새로 만들기
            </Link>
          </Button>
        </div>

        {tournamentList.loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>아직 만든 월드컵이 없습니다</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/tournament/new">첫 월드컵 만들기</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          // 카드가 탑스터보다 가로로 넓다(썸네일 + 버튼 3개) — 한 줄에 두 장까지만 둔다.
          <div className="grid gap-3 sm:grid-cols-2">
            {tournaments.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                actions={
                  <OwnerItemActions
                    editHref={`/tournament/${t.id}/edit`}
                    deletePath={tournamentPath(t.id)}
                    name={t.title}
                    losesOnDelete="플레이 기록·랭킹·댓글이 함께 지워집니다."
                    onDeleted={() => tournamentList.removeItem(t.id)}
                  />
                }
              />
            ))}
          </div>
        )}

        <InfiniteListFooter
          sentinelRef={tournamentList.sentinelRef}
          loadingMore={tournamentList.loadingMore}
          failed={tournamentList.failed}
          retry={tournamentList.retry}
          reachedEnd={tournamentList.reachedEnd}
          loadedCount={tournaments.length}
          limit={tournamentList.limit}
        />
      </section>
    </div>
  );
}
