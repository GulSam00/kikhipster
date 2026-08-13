'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, UserX } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import TopsterCard from '@/components/music/TopsterCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import type { Topster } from '@/types/topster';

interface PublicUser {
  id: string;
  nickname: string;
  provider: string;
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [topsters, setTopsters] = useState<Topster[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        const [u, ts] = await Promise.all([
          apiFetch<PublicUser>(`/api/auth/users/${userId}`),
          apiFetch<Topster[]>(`/api/topsters/user/${userId}`),
        ]);
        setUser(u);
        setTopsters(ts);
      } catch {
        setNotFound(true);
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
    </div>
  );
}
