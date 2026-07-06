'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Topster } from '@/types/topster';
import type { Comment, LikeStatus } from '@/types/social';

export default function TopsterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [topster, setTopster] = useState<Topster | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [like, setLike] = useState<LikeStatus>({ liked: false, like_count: 0 });
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  useEffect(() => {
    setMeId(localStorage.getItem('user_id'));
    async function load() {
      try {
        const [t, c, l] = await Promise.all([
          apiFetch<Topster>(`/api/topsters/${id}`),
          apiFetch<Comment[]>(`/api/topsters/${id}/comments/`),
          apiFetch<LikeStatus>(`/api/likes/topster/${id}`),
        ]);
        setTopster(t);
        setComments(c);
        setLike(l);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function toggleLike() {
    if (!isLoggedIn) return;
    const prev = like;
    setLike((l) => ({ liked: !l.liked, like_count: l.liked ? l.like_count - 1 : l.like_count + 1 }));
    try {
      const res = await apiFetch<LikeStatus>(`/api/likes/topster/${id}`, { method: 'POST' });
      setLike(res);
    } catch { setLike(prev); }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const c = await apiFetch<Comment>(`/api/topsters/${id}/comments/`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText }),
      });
      setComments((prev) => [...prev, c]);
      setCommentText('');
    } catch { /* ignore */ }
  }

  async function deleteComment(commentId: string) {
    try {
      await apiFetch(`/api/topsters/${id}/comments/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* ignore */ }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center"><p className="text-zinc-500">불러오는 중...</p></div>;
  if (!topster) return <div className="flex flex-1 items-center justify-center"><p className="text-zinc-500">탑스터를 찾을 수 없습니다.</p></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">{topster.title}</h1>
        {topster.description && <p className="text-zinc-400 text-sm mb-2">{topster.description}</p>}
        <p className="text-xs text-zinc-500">
          by{' '}
          <Link href={`/profile/${topster.user.id}`} className="hover:text-violet-400 transition-colors">
            {topster.user.nickname}
          </Link>
        </p>
      </div>

      <div
        className="grid gap-1 mb-6"
        style={{ gridTemplateColumns: `repeat(${topster.grid_size}, 1fr)` }}
      >
        {Array.from({ length: topster.grid_size * topster.grid_size }).map((_, i) => {
          const item = topster.items.find((it) => it.position === i);
          return (
            <div key={i} className="aspect-square rounded bg-zinc-800 relative overflow-hidden">
              {item ? (
                <Link href={`/albums/${item.album_spotify_id}`}>
                  <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-zinc-600 text-xs hover:bg-zinc-600 transition-colors">
                    ♫
                  </div>
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            like.liked ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          ♥ {like.like_count}
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="px-4 py-2 rounded-full text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          링크 복사
        </button>
      </div>

      <section>
        <h2 className="text-lg font-bold text-white mb-4">댓글 {comments.length}</h2>

        {isLoggedIn && (
          <form onSubmit={submitComment} className="flex gap-2 mb-4">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              등록
            </button>
          </form>
        )}

        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900">
              <div className="flex-1">
                <p className="text-xs text-violet-400 font-medium mb-1">{c.user.nickname}</p>
                <p className="text-sm text-zinc-200">{c.content}</p>
              </div>
              {c.user.id === meId && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-zinc-600 hover:text-red-400 text-xs transition-colors shrink-0"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
