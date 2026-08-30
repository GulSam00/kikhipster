'use client';

import { useEffect, useState } from 'react';
import { Check, Flag, Pencil, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  REPORT_REASONS,
  createComment,
  deleteComment,
  listComments,
  reportComment,
  updateComment,
} from '@/lib/api/comments';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useMe } from '@/lib/hooks/use-me';
import type { Comment, CommentTargetType } from '@/types/social';

interface Props {
  targetType: CommentTargetType;
  targetId: string;
}

/**
 * 범용 댓글 영역. `/api/comments/{target_type}/{target_id}` 를 쓴다.
 * 탑스터 상세도 이 컴포넌트를 쓴다 — 예전엔 `/api/topsters/{id}/comments` 전용 경로를
 * 인라인으로 부르는 사본이 따로 있었으나 같은 테이블이라 그대로 합쳤다(2026-08-26).
 *
 * **비로그인도 쓸 수 있다(2026-08-30).** 로그인하지 않았으면 닉네임 칸이 하나 더 붙고,
 * 비우면 "익명" 으로 들어간다. 본인 확인은 `lib/guest-token.ts` 의 작성자 토큰이 한다.
 *
 * **소유 판정은 서버가 내려주는 `is_mine` 을 그대로 쓴다.** 예전처럼
 * `c.user.id === me?.id` 로 비교하지 않는다 — 게스트 댓글의 주인은 토큰 해시로만 가려지고
 * 프론트에는 평문 토큰만 있어서 그 비교를 프론트가 대신할 수 없다.
 */
export default function CommentSection({ targetType, targetId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState('');
  /** 수정 중인 댓글 id. null 이면 아무것도 수정 중이 아니다. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const me = useMe();

  useEffect(() => {
    listComments(targetType, targetId)
      .then(setComments)
      .catch(() => toast.error('댓글을 불러오지 못했습니다'));
  }, [targetType, targetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      // 닉네임은 비로그인일 때만 의미가 있다. 로그인 상태면 서버가 무시하고 계정 닉네임을 쓴다.
      const created = await createComment(
        targetType,
        targetId,
        text.trim(),
        me ? undefined : nickname.trim() || undefined,
      );
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
      const updated = await updateComment(targetType, targetId, editingId, content);
      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      cancelEdit();
    } catch {
      toast.error('댓글을 수정하지 못했습니다');
    }
  }

  async function remove(commentId: string) {
    try {
      await deleteComment(targetType, targetId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingId === commentId) cancelEdit();
    } catch {
      toast.error('댓글을 삭제하지 못했습니다');
    }
  }

  async function report(commentId: string, reason: string) {
    try {
      await reportComment(targetType, targetId, commentId, reason);
      // 서버를 다시 부르지 않고 그 줄만 바꾼다 — 신고는 목록의 다른 값을 건드리지 않는다.
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, reported_by_me: true, report_count: c.report_count + 1 }
            : c,
        ),
      );
      toast.success('신고를 접수했습니다');
    } catch {
      toast.error('신고하지 못했습니다');
    }
  }

  return (
    <section>
      <h2 className="mb-4 font-heading text-lg font-bold">댓글 {comments.length}</h2>

      {/*
        예전엔 로그인해야만 이 폼이 나왔다. 이제 비로그인도 쓸 수 있고, 대신 닉네임 칸이
        하나 더 붙는다. `me` 가 `undefined` 인 동안(확인 중)에도 폼을 감추지 않는다 —
        감췄다가 나타나면 깜빡인다.
      */}
      <form onSubmit={submit} className="mb-4 flex flex-col gap-2 sm:flex-row">
        {!me && (
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="익명"
            maxLength={20}
            aria-label="닉네임"
            className="h-9 sm:w-32"
          />
        )}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="댓글을 입력하세요..."
          aria-label="댓글 내용"
          className="h-9 sm:flex-1"
        />
        <Button type="submit" size="lg" disabled={!text.trim()}>
          <Send />
          등록
        </Button>
      </form>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">첫 댓글을 남겨보세요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map((c) => (
            <Card key={c.id} size="sm">
              <CardContent className="flex items-start gap-3">
                <Avatar size="sm">
                  <AvatarFallback>{c.author_nickname[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {c.author_nickname}
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

                {c.is_mine && editingId !== c.id && (
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

                {/*
                  남의 댓글에만 신고가 붙는다. 사유를 고르는 창을 따로 띄우지 않고 메뉴에서
                  바로 고른다 — `components/ui` 에 `Dialog` 프리미티브가 없고, 신고 하나
                  때문에 새로 들이지 않기로 했다(`OwnerMenu` 와 같은 `DropdownMenu` 를 쓴다).
                  한 번 신고하면 서버가 중복을 막으므로(부분 유니크 인덱스) 버튼도 잠근다.
                */}
                {!c.is_mine && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        disabled={c.reported_by_me}
                        aria-label={c.reported_by_me ? '신고한 댓글' : '댓글 신고'}
                      >
                        <Flag />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>신고 사유</DropdownMenuLabel>
                      {REPORT_REASONS.map((r) => (
                        <DropdownMenuItem key={r.value} onSelect={() => report(c.id, r.value)}>
                          {r.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
