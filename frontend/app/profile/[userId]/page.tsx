'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
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
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  if (notFound || !user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-zinc-400 text-lg">존재하지 않는 유저입니다</p>
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm">
          홈으로 →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-4 mb-8 p-6 rounded-2xl bg-zinc-900">
        <div className="w-16 h-16 rounded-full bg-violet-700 flex items-center justify-center text-2xl font-bold text-white shrink-0">
          {user.nickname[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{user.nickname}</h1>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400 capitalize">
            {user.provider}
          </span>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-white mb-4">
          탑스터 {topsters.length}
        </h2>

        {topsters.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-zinc-900">
            <p className="text-zinc-500">공개된 탑스터가 없습니다</p>
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
                  <p className="text-xs text-zinc-400">♥ {t.like_count}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
