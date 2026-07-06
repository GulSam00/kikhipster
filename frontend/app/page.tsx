import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Topster } from '@/types/topster';

async function getTopsters(): Promise<Topster[]> {
  try {
    return await apiFetch<Topster[]>('/api/topsters/?limit=12&offset=0');
  } catch {
    return [];
  }
}

function TopsterCard({ topster }: { topster: Topster }) {
  return (
    <Link
      href={`/topsters/${topster.id}`}
      className="group flex flex-col gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
    >
      <div className="grid grid-cols-3 gap-0.5 rounded-lg overflow-hidden aspect-square bg-zinc-800">
        {Array.from({ length: 9 }).map((_, i) => {
          const item = topster.items.find((it) => it.position === i);
          return (
            <div key={i} className="aspect-square bg-zinc-700" />
          );
        })}
      </div>
      <div>
        <p className="text-sm font-medium text-white truncate">{topster.title}</p>
        <p className="text-xs text-zinc-400">by {topster.user.nickname} · ♥ {topster.like_count}</p>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const topsters = await getTopsters();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">최근 탑스터</h2>
          <Link href="/topsters" className="text-sm text-violet-400 hover:text-violet-300">
            전체 보기
          </Link>
        </div>
        {topsters.length === 0 ? (
          <div className="rounded-xl bg-zinc-900 p-12 text-center">
            <p className="text-zinc-500 mb-4">아직 탑스터가 없습니다</p>
            <Link
              href="/topsters/new"
              className="inline-block px-5 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              첫 탑스터 만들기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {topsters.map((t) => (
              <TopsterCard key={t.id} topster={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-white mb-4">둘러보기</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/search', label: '음악 검색', desc: '아티스트·앨범·곡 탐색' },
            { href: '/topsters', label: '탑스터', desc: '나만의 앨범 차트 만들기' },
            { href: '/tournament', label: '토너먼트', desc: '최애 곡 결정전' },
            { href: '/login', label: '로그인', desc: '좋아요·댓글·탑스터 저장' },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl bg-zinc-900 hover:bg-zinc-800 p-5 transition-colors"
            >
              <p className="text-white font-semibold mb-1">{label}</p>
              <p className="text-xs text-zinc-400">{desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
