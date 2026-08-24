'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Heart, Link2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import TopsterCanvas from '@/components/music/TopsterCanvas';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useAlbumItems } from '@/lib/album-covers';
import { cn } from '@/lib/utils';
import type { Topster } from '@/types/topster';
import type { Comment, LikeStatus } from '@/types/social';

export default function TopsterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [topster, setTopster] = useState<Topster | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [like, setLike] = useState<LikeStatus>({ liked: false, like_count: 0 });
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const albumIds = useMemo(
    () => topster?.items.map((it) => it.album_spotify_id) ?? [],
    [topster],
  );
  const albums = useAlbumItems(albumIds);
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
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.error('탑스터를 불러오지 못했습니다');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function toggleLike() {
    if (!isLoggedIn) {
      toast.error('로그인이 필요합니다');
      return;
    }
    const prev = like;
    setLike((l) => ({ liked: !l.liked, like_count: l.liked ? l.like_count - 1 : l.like_count + 1 }));
    try {
      const res = await apiFetch<LikeStatus>(`/api/likes/topster/${id}`, { method: 'POST' });
      setLike(res);
    } catch {
      setLike(prev);
      toast.error('좋아요 처리에 실패했습니다');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('링크를 복사했습니다');
    } catch {
      toast.error('링크 복사에 실패했습니다');
    }
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
    } catch {
      toast.error('댓글 등록에 실패했습니다');
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await apiFetch(`/api/topsters/${id}/comments/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error('댓글 삭제에 실패했습니다');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Spinner />
        불러오는 중...
      </div>
    );
  }

  if (!topster) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">탑스터를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-1 font-heading text-2xl font-bold">{topster.title}</h1>
        {topster.description && (
          <p className="mb-2 text-sm text-muted-foreground">{topster.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          by{' '}
          <Link href={`/profile/${topster.user.id}`} className="transition-colors hover:text-primary">
            {topster.user.nickname}
          </Link>
        </p>
      </div>

      <TopsterCanvas
        options={topster}
        title={topster.title}
        items={topster.items}
        albums={albums}
        className="mb-6"
      />

      <div className="mb-8 flex items-center gap-2">
        <Button
          size="lg"
          variant={like.liked ? 'default' : 'secondary'}
          className="rounded-full"
          onClick={toggleLike}
        >
          <Heart className={cn(like.liked && 'fill-current')} />
          {like.like_count}
        </Button>
        <Button size="lg" variant="secondary" className="rounded-full" onClick={copyLink}>
          <Link2 />
          링크 복사
        </Button>
      </div>

      <Separator className="mb-6" />

      <section>
        <h2 className="mb-4 font-heading text-lg font-bold">댓글 {comments.length}</h2>

        {isLoggedIn && (
          <form onSubmit={submitComment} className="mb-4 flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="h-9"
            />
            <Button type="submit" size="lg" disabled={!commentText.trim()}>
              <Send />
              등록
            </Button>
          </form>
        )}

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">첫 댓글을 남겨보세요.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {comments.map((c) => (
              <Card key={c.id} size="sm">
                <CardContent className="flex items-start gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{c.user.nickname[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs font-medium text-primary">{c.user.nickname}</p>
                    <p className="text-sm break-words">{c.content}</p>
                  </div>
                  {c.user.id === meId && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteComment(c.id)}
                      aria-label="댓글 삭제"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
