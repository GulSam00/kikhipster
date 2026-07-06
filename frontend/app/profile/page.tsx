'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
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
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <div className="flex flex-1 items-center justify-center"><p className="text-zinc-500">불러오는 중...</p></div>;
  if (!me) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-4 mb-8 p-6 rounded-2xl bg-zinc-900">
        <div className="w-16 h-16 rounded-full bg-violet-700 flex items-center justify-center text-2xl font-bold text-white shrink-0">
          {me.nickname[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{me.nickname}</h1>
          <p className="text-sm text-zinc-400">{me.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400 capitalize">{me.provider}</span>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">내 탑스터 {topsters.length}</h2>
          <Link href="/topsters/new" className="text-sm text-violet-400 hover:text-violet-300">
            + 새로 만들기
          </Link>
        </div>

        {topsters.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-zinc-900">
            <p className="text-zinc-500 mb-3">아직 만든 탑스터가 없습니다</p>
            <Link href="/topsters/new" className="text-violet-400 hover:text-violet-300 text-sm">
              첫 탑스터 만들기 →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {topsters.map((t) => (
              <Link
                key={t.id}
                href={`/topsters/${t.id}`}
                className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
              >
                <div
                  className="grid gap-0.5 rounded-lg overflow-hidden aspect-square bg-zinc-800"
                  style={{ gridTemplateColumns: `repeat(${t.grid_size}, 1fr)` }}
                >
                  {Array.from({ length: t.grid_size * t.grid_size }).map((_, i) => (
                    <div key={i} className="aspect-square bg-zinc-700" />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium text-white truncate">{t.title}</p>
                  <p className="text-xs text-zinc-400">
                    {t.is_public ? '공개' : '비공개'} · ♥ {t.like_count}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
