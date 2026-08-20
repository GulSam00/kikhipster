import Link from 'next/link';
import { LayoutGrid, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import TopsterCard from '@/components/music/TopsterCard';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { Topster } from '@/types/topster';

async function getTopsters(): Promise<Topster[]> {
  return apiFetch<Topster[]>('/api/topsters/?limit=20&offset=0');
}

export default async function TopstersPage() {
  const topsters = await getTopsters();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">탑스터</h1>
        <Button asChild size="lg">
          <Link href="/topsters/new">
            <Plus />
            새 탑스터
          </Link>
        </Button>
      </div>

      {topsters.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>아직 탑스터가 없습니다</EmptyTitle>
            <EmptyDescription>3×3부터 5×5까지, 원하는 크기로 앨범 차트를 만들 수 있습니다.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/topsters/new">첫 탑스터 만들기</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {topsters.map((t) => (
            <TopsterCard key={t.id} topster={t} />
          ))}
        </div>
      )}
    </div>
  );
}
