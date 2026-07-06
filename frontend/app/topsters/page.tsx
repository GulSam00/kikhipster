import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Topster } from '@/types/topster';

async function getTopsters(): Promise<Topster[]> {
  try {
    return await apiFetch<Topster[]>('/api/topsters/?limit=20&offset=0');
  } catch {
    return [];
  }
}

function TopsterCard({ topster }: { topster: Topster }) {
  return (
    <Link
      href={`/topsters/${topster.id}`}
      className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
    >
      <div
        className="grid gap-0.5 rounded-lg overflow-hidden aspect-square bg-zinc-800"
        style={{ gridTemplateColumns: `repeat(${topster.grid_size}, 1fr)` }}
      >
        {Array.from({ length: topster.grid_size * topster.grid_size }).map((_, i) => (
          <div key={i} className="aspect-square bg-zinc-700" />
        ))}
      </div>
      <div>
        <p className="text-sm font-medium text-white truncate">{topster.title}</p>
        <p className="text-xs text-zinc-400">
          {topster.user.nickname} · ♥ {topster.like_count}
        </p>
      </div>
    </Link>
  );
}

export default async function TopstersPage() {
  const topsters = await getTopsters();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">탑스터</h1>
        <Link
          href="/topsters/new"
          className="px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
        >
          + 새 탑스터
        </Link>
      </div>

      {topsters.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500 mb-4">아직 탑스터가 없습니다</p>
          <Link href="/topsters/new" className="text-violet-400 hover:text-violet-300 text-sm">
            첫 탑스터 만들기 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {topsters.map((t) => <TopsterCard key={t.id} topster={t} />)}
        </div>
      )}
    </div>
  );
}
