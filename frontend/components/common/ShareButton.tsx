'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface Props {
  /** 공유할 경로. `/tournament/xxx` 처럼 앞에 슬래시를 붙인 상대 경로. */
  path: string;
  label?: string;
  /**
   * 라벨 없이 원형 아이콘 버튼으로 그린다. 주요 CTA 와 한 줄에 설 때 쓴다
   * (탑스터·월드컵 상세 액션 줄, 2026-09-08). `LikeButton` 의 `tone="icon"` 과 짝이다.
   */
  iconOnly?: boolean;
  className?: string;
}

/**
 * 현재 오리진 + path를 클립보드에 복사한다.
 * `navigator.clipboard`는 보안 컨텍스트(https 또는 localhost)에서만 존재하므로,
 * 없을 때는 실패로 처리하고 토스트에 URL을 직접 띄워 수동 복사할 수 있게 한다.
 */
export default function ShareButton({ path, label = '공유', iconOnly, className }: Props) {
  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했습니다');
    } catch {
      toast.error('복사에 실패했습니다', { description: url });
    }
  }

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={copy}
        aria-label={label}
        /* `size-11` 로 44px 히트 영역을 채운다 — 근거는 `LikeButton` 의 같은 자리에. */
        className={cn(
          'text-muted-foreground hover:text-foreground size-11 rounded-full',
          className,
        )}
      >
        <Share2 className="size-5" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="lg" onClick={copy} className={className}>
      <Share2 />
      {label}
    </Button>
  );
}
