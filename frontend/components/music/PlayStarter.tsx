'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Play as PlayType } from '@/types/tournament';

interface Props {
  tournamentId: string;
  /** 풀 크기 이하인 강수만 넘어온다. 비어 있으면 풀이 4개 미만이라는 뜻. */
  availableSizes: number[];
}

/**
 * 강수를 고르고 새 판을 시작한다.
 * 플레이는 매번 풀에서 무작위로 뽑히므로, 같은 월드컵을 몇 번 돌려도 대진이 달라진다.
 * 로그인 없이도 시작할 수 있다.
 */
export default function PlayStarter({ tournamentId, availableSizes }: Props) {
  const router = useRouter();
  // 가장 큰 강수를 기본값으로 — 풀을 많이 담았으면 그만큼 크게 돌리고 싶을 것이다.
  const [size, setSize] = useState<number>(availableSizes[availableSizes.length - 1] ?? 4);
  const [loading, setLoading] = useState(false);

  if (availableSizes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        풀이 4개 미만이라 플레이할 수 없습니다.
      </p>
    );
  }

  async function start() {
    setLoading(true);
    try {
      const play = await apiFetch<PlayType>(`/api/tournaments/${tournamentId}/plays`, {
        method: 'POST',
        body: JSON.stringify({ size }),
      });
      router.push(`/play/${play.id}`);
    } catch {
      toast.error('플레이를 시작하지 못했습니다');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">강수</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={String(size)}
          onValueChange={(v) => v && setSize(Number(v))}
        >
          {availableSizes.map((s) => (
            <ToggleGroupItem key={s} value={String(s)}>
              {s}강
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Button size="lg" className="h-11" onClick={start} disabled={loading}>
        <Play />
        {loading ? '대진 뽑는 중...' : `${size}강 시작하기`}
      </Button>
    </div>
  );
}
