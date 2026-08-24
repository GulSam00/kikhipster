'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Props {
  /** 공유할 경로. `/tournament/xxx` 처럼 앞에 슬래시를 붙인 상대 경로. */
  path: string;
  label?: string;
  className?: string;
}

/**
 * 현재 오리진 + path를 클립보드에 복사한다.
 * `navigator.clipboard`는 보안 컨텍스트(https 또는 localhost)에서만 존재하므로,
 * 없을 때는 실패로 처리하고 토스트에 URL을 직접 띄워 수동 복사할 수 있게 한다.
 */
export default function ShareButton({ path, label = '공유', className }: Props) {
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

  return (
    <Button variant="outline" size="lg" onClick={copy} className={className}>
      <Share2 />
      {label}
    </Button>
  );
}
