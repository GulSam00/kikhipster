'use client';

import { useEffect, useState } from 'react';
import { Check, Pencil, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMe } from '@/lib/use-me';
import type { Comment, CommentTargetType } from '@/types/social';

interface Props {
  targetType: CommentTargetType;
  targetId: string;
}

/**
 * 범용 댓글 영역. `/api/comments/{target_type}/{target_id}` 를 쓴다.
 * 탑스터 상세도 이 컴포넌트를 쓴다 — 예전엔 `/api/topsters/{id}/comments` 전용 경로를
 * 인라인으로 부르는 사본이 따로 있었으나 같은 테이블이라 그대로 합쳤다(2026-08-26).
 */
export default function CommentSection({ targetType, targetId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  /** 수정 중인 댓글 id. null 이면 아무것도 수정 중이 아니다. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const me = useMe();

  const base = `/api/comments/${targetType}/${targetId}`;

  useEffect(() => {
    apiFetch<Comment[]>(`${base}/`)
      .then(setComments)
      .catch(() => toast.error('댓글을 불러오지 못했습니다'));
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

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditText(c.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const content = editText.trim();
    if (!editingId || !content) return;
    try {
      // 응답의 edited_at 을 그대로 받아 쓴다 — "(수정됨)" 판정을 프론트에서 흉내내지 않는다.
      const updated = await apiFetch<Comment>(`${base}/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      cancelEdit();
    } catch {
      toast.error('댓글을 수정하지 못했습니다');
    }
  }

  async function remove(commentId: string) {
    try {
      await apiFetch(`${base}/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingId === commentId) cancelEdit();
    } catch {
      toast.error('댓글을 삭제하지 못했습니다');
    }
  }

  return (
    <section>
      <h2 className="mb-4 font-heading text-lg font-bold">댓글 {comments.length}</h2>

      {me && (
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
                  <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {c.user.nickname}
                    {c.edited_at && <span>(수정됨)</span>}
                  </p>

                  {editingId === c.id ? (
                    <form onSubmit={saveEdit} className="flex gap-2">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="h-8"
                        aria-label="댓글 수정"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <Button type="submit" size="icon-sm" disabled={!editText.trim()} aria-label="수정 저장">
                        <Check />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        aria-label="수정 취소"
                      >
                        <X />
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm break-words">{c.content}</p>
                  )}
                </div>

                {c.user.id === me?.id && editingId !== c.id && (
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(c)}
                      aria-label="댓글 수정"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(c.id)}
                      aria-label="댓글 삭제"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
