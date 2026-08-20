'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, Plus, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import TopsterCard from '@/components/music/TopsterCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import type { Topster } from '@/types/topster';

interface Me {
  id: string;
  email: string;
  nickname: string;
  provider: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [topsters, setTopsters] = useState<Topster[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
    async function load() {
      try {
        const [user, ts] = await Promise.all([
          apiFetch<Me>('/api/auth/me'),
          apiFetch<Topster[]>('/api/topsters/me/list'),
        ]);
        setMe(user);
        localStorage.setItem('user_id', user.id);
        setTopsters(ts);
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
            <AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
              {me.nickname[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold">{me.nickname}</h1>
            <p className="truncate text-sm text-muted-foreground">{me.email}</p>
            <Badge variant="outline" className="mt-1 capitalize">{me.provider}</Badge>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">내 탑스터 {topsters.length}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/topsters/new">
              <Plus />
              새로 만들기
            </Link>
          </Button>
        </div>

        {topsters.length === 0 ? (
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
              <TopsterCard key={t.id} topster={t} showAuthor={false} showVisibility />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
