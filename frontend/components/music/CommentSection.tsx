'use client';

import { useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Comment, CommentTargetType } from '@/types/social';

interface Props {
  targetType: CommentTargetType;
  targetId: string;
}

/**
 * 범용 댓글 영역. `/api/comments/{target_type}/{target_id}` 를 쓴다.
 * 탑스터 상세는 아직 `/api/topsters/{id}/comments` 전용 경로를 그대로 쓰고 있다 —
 * 두 경로 모두 같은 테이블을 보므로 나중에 이 컴포넌트로 합쳐도 데이터는 그대로다.
 */
export default function CommentSection({ targetType, targetId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  // 로그인 여부를 별도 state로 두지 않고 meId로 갈음한다. /api/auth/me 가 성공했다는 건
  // 토큰이 실제로 유효하다는 뜻이라, localStorage에 죽은 토큰이 남아 있는 경우도 걸러진다.
  const [meId, setMeId] = useState<string | null>(null);

  const base = `/api/comments/${targetType}/${targetId}`;

  useEffect(() => {
    apiFetch<Comment[]>(`${base}/`)
      .then(setComments)
      .catch(() => toast.error('댓글을 불러오지 못했습니다'));

    if (localStorage.getItem('access_token')) {
      apiFetch<{ id: string }>('/api/auth/me')
        .then((u) => setMeId(u.id))
        .catch(() => setMeId(null));
    }
  }, [base]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const created = await apiFetch<Comment>(`${base}/`, {
        method: 'POST',
        body: JSON.stringify({ content: text.trim() }),
      });
      setComments((prev) => [...prev, created]);
      setText('');
    } catch {
      toast.error('댓글을 등록하지 못했습니다');
    }
  }

  async function remove(commentId: string) {
    try {
      await apiFetch(`${base}/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error('댓글을 삭제하지 못했습니다');
    }
  }

  return (
    <section>
      <h2 className="mb-4 font-heading text-lg font-bold">댓글 {comments.length}</h2>

      {meId && (
        <form onSubmit={submit} className="mb-4 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="h-9"
          />
          <Button type="submit" size="lg" disabled={!text.trim()}>
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
                  <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                    {c.user.nickname}
                  </p>
                  <p className="text-sm break-words">{c.content}</p>
                </div>
                {c.user.id === meId && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(c.id)}
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
  );
}
