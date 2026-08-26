'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, TriangleAlert, Trophy, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import TopsterCard from '@/components/music/TopsterCard';
import TournamentCard from '@/components/music/TournamentCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import type { Topster } from '@/types/topster';
import type { TournamentSummary } from '@/types/tournament';

interface PublicUser {
  id: string;
  nickname: string;
  provider: string;
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [topsters, setTopsters] = useState<Topster[]>([]);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        const [u, ts, ws] = await Promise.all([
          apiFetch<PublicUser>(`/api/auth/users/${userId}`),
          apiFetch<Topster[]>(`/api/topsters/user/${userId}`),
          apiFetch<TournamentSummary[]>(`/api/tournaments/user/${userId}`),
        ]);
        setUser(u);
        setTopsters(ts);
        setTournaments(ws);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          toast.error('프로필을 불러오지 못했습니다');
          setLoadError(true);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
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
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => window.location.reload()}>다시 시도</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (notFound || !user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserX />
            </EmptyMedia>
            <EmptyTitle>존재하지 않는 유저입니다</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="secondary">
              <Link href="/">홈으로</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Card className="mb-8">
        <CardContent className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            <AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
              {user.nickname[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold">{user.nickname}</h1>
            <Badge variant="outline" className="mt-1 capitalize">{user.provider}</Badge>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 font-heading text-lg font-bold">탑스터 {topsters.length}</h2>

        {topsters.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>공개된 탑스터가 없습니다</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {topsters.map((t) => (
              <TopsterCard key={t.id} topster={t} showAuthor={false} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-heading text-lg font-bold">월드컵 {tournaments.length}</h2>

        {tournaments.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>만든 월드컵이 없습니다</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
