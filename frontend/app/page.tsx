import Link from 'next/link';
import { LayoutGrid, LogIn, Search, Trophy } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import TopsterCard from '@/components/music/TopsterCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { Topster } from '@/types/topster';

async function getTopsters(): Promise<Topster[]> {
  return apiFetch<Topster[]>('/api/topsters/?limit=12&offset=0');
}

const shortcuts = [
  { href: '/search', label: '음악 검색', desc: '아티스트·앨범·곡 탐색', icon: Search },
  { href: '/topsters', label: '탑스터', desc: '나만의 앨범 차트 만들기', icon: LayoutGrid },
  { href: '/tournament', label: '토너먼트', desc: '최애 곡 결정전', icon: Trophy },
  { href: '/login', label: '로그인', desc: '좋아요·댓글·탑스터 저장', icon: LogIn },
];

export default async function HomePage() {
  const topsters = await getTopsters();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">최근 탑스터</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/topsters">전체 보기</Link>
          </Button>
        </div>

        {topsters.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>아직 탑스터가 없습니다</EmptyTitle>
              <EmptyDescription>좋아하는 앨범으로 첫 차트를 만들어보세요.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/topsters/new">첫 탑스터 만들기</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {topsters.map((t) => (
              <TopsterCard key={t.id} topster={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-heading text-lg font-bold">둘러보기</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:bg-accent">
                <CardContent className="flex flex-col gap-1">
                  <Icon className="mb-1 size-5 text-primary" />
                  <CardTitle>{label}</CardTitle>
                  <CardDescription className="text-xs">{desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
