'use client';

import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLikeStatus } from '@/lib/like-status';
import { cn } from '@/lib/utils';
import type { LikeTargetType } from '@/types/social';

interface Props {
  targetType: LikeTargetType;
  targetId: string;
  /** 스크린리더용 대상 이름. "OK Computer 좋아요" 처럼 읽힌다. */
  name: string;
  /**
   * `prominent` — 상세 화면 헤더의 단독 버튼. 눌린 상태를 primary 로 칠한다.
   * `inline` — 트랙 행처럼 여러 개가 나열되는 자리. DESIGN.md § Color budget 상
   * primary 강조가 화면에 4개를 넘으면 BLOCK 이라, 여기서는 색이 아니라
   * '채움 + 밝기 단계'로만 상태를 구분한다.
   */
  tone?: 'prominent' | 'inline';
  className?: string;
}

export default function LikeButton({
  targetType,
  targetId,
  name,
  tone = 'prominent',
  className,
}: Props) {
  const { status, toggle } = useLikeStatus(targetType, targetId);
  const liked = status?.liked ?? false;

  async function handleClick() {
    if (!localStorage.getItem('access_token')) {
      toast.error('로그인이 필요합니다');
      return;
    }
    try {
      await toggle();
    } catch {
      toast.error('좋아요 처리에 실패했습니다');
    }
  }

  const label = `${name} 좋아요${liked ? ' 취소' : ''}`;

  if (tone === 'inline') {
    return (
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={handleClick}
        aria-pressed={liked}
        aria-label={label}
        className={cn(
          'shrink-0 text-muted-foreground hover:text-foreground',
          liked && 'text-foreground',
          className,
        )}
      >
        <Heart className={cn(liked && 'fill-current')} />
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      variant={liked ? 'default' : 'secondary'}
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={label}
      className={cn('rounded-full', className)}
    >
      <Heart className={cn(liked && 'fill-current')} />
      {/* 조회 전에는 자리만 잡아둔다 — 0이 떴다가 실제 수로 바뀌면 눈에 튄다. */}
      <span className="tabular-nums">{status ? status.like_count : ''}</span>
    </Button>
  );
}
