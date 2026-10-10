'use client';

import { Heart } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { useLikeStatus } from '@/lib/hooks/use-like-status';

import { cn } from '@/lib/utils';

import type { LikeTargetType } from '@/types/social';

interface Props {
  targetType: LikeTargetType;
  targetId: string;
  /** 스크린리더용 대상 이름. "OK Computer 좋아요" 처럼 읽힌다. */
  name: string;
  /**
   * `prominent` — 앨범·아티스트 상세의 단독 버튼. 수까지 붙은 pill 이고 눌린 상태를
   * primary 로 칠한다.
   * `icon` — 탑스터·월드컵 상세의 액션 줄. 주요 CTA 와 **한 줄에** 서므로 pill 이면
   * 둘이 같은 무게로 경쟁한다. 원형 아이콘으로 낮추고 수는 헤더 `ItemStats` 에 맡긴다
   * (2026-09-08).
   * `inline` — 트랙 행처럼 여러 개가 나열되는 자리. DESIGN.md § Color budget 상
   * primary 강조가 화면에 4개를 넘으면 BLOCK 이라, 여기서는 색이 아니라
   * '채움 + 밝기 단계'로만 상태를 구분한다.
   */
  tone?: 'prominent' | 'icon' | 'inline';
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

  if (tone === 'icon') {
    return (
      <Button
        size="icon-lg"
        variant="ghost"
        onClick={handleClick}
        aria-pressed={liked}
        aria-label={label}
        className={cn(
          /*
            `icon-lg` 는 `size-9`(36px)라 § Mobile 의 44px 히트 영역에 미달한다.
            같은 그룹이라 `size-11` 이 `twMerge` 에서 이겨 44px 로 올라간다.
          */
          'text-muted-foreground hover:text-foreground size-11 rounded-full',
          liked && 'text-primary hover:text-primary',
          className,
        )}
      >
        {/* 아이콘도 한 단계 키운다 — 44px 원 안에서 16px 은 점처럼 보인다. */}
        <Heart className={cn('size-5', liked && 'fill-current')} />
      </Button>
    );
  }

  if (tone === 'inline') {
    return (
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={handleClick}
        aria-pressed={liked}
        aria-label={label}
        className={cn(
          'text-muted-foreground hover:text-foreground shrink-0',
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
