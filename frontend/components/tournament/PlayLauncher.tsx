'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createPlay } from '@/lib/api/tournaments';
import { cn } from '@/lib/utils';

interface Props {
  tournamentId: string;
  /** 풀 크기 이하인 강수만 넘어온다. 비어 있으면 풀이 4개 미만이라는 뜻. */
  availableSizes: number[];
}

/**
 * 강수를 고르고 그 자리에서 판을 시작한다. 상세의 1차 CTA.
 *
 * **예전에는 `/tournament/{id}/play` 라는 별도 화면이었다** (2026-08-27에 없앴다).
 * 그 화면이 하는 일이 "제목·후보 미리보기를 다시 보여주고 강수를 고르게 하는 것"이라,
 * 방금 그 정보를 다 보여준 상세에서 한 번 더 페이지를 넘길 이유가 없었다.
 * 강수는 고르는 값이 하나뿐이라 select 하나로 충분하다.
 *
 * select 와 버튼은 **같은 primary 면 위에 얇은 칸막이 하나**로 붙여 한 컨트롤처럼 보이게 한다.
 * 처음엔 select 를 `secondary` 로 뒀는데 주황 버튼 옆에 회색 상자가 붙은 꼴이라, 둘이
 * 한 동작이라는 게 읽히지 않고 색만 어수선했다.
 *
 * § Color budget 상 이 덩어리 전체가 primary 강조 **하나**다 — 화면의 다른 primary 는
 * 좋아요(눌렸을 때)뿐이라 상한 안이다.
 */
export default function PlayLauncher({ tournamentId, availableSizes }: Props) {
  const router = useRouter();
  // 가장 큰 강수를 기본값으로 — 풀을 많이 담았으면 그만큼 크게 돌리고 싶을 것이다.
  const [size, setSize] = useState<number>(availableSizes[availableSizes.length - 1] ?? 4);
  const [loading, setLoading] = useState(false);

  if (availableSizes.length === 0) {
    return <p className="text-muted-foreground text-sm">풀이 4개 미만이라 플레이할 수 없습니다.</p>;
  }

  async function start() {
    setLoading(true);
    try {
      // 플레이는 매번 풀에서 무작위로 뽑히므로 같은 월드컵을 몇 번 돌려도 대진이 달라진다.
      // 로그인 없이도 시작할 수 있다.
      const play = await createPlay(tournamentId, size);
      router.push(`/play/${play.id}`);
    } catch {
      toast.error('플레이를 시작하지 못했습니다');
      setLoading(false);
    }
  }

  return (
    // 두 칸을 정확히 같은 너비로 두려고 `flex` 가 아니라 2열 그리드다. flex 에서는 각자
    // 콘텐츠만큼만 차지해서 "8강"과 "시작하기"의 폭이 그대로 벌어진다.
    <div className="grid w-56 grid-cols-2 items-center">
      <Select
        value={String(size)}
        onValueChange={(v) => v && setSize(Number(v))}
        disabled={loading}
      >
        {/*
          **버튼과 같은 클래스 세트를 쓴다.** 색·높이만 따로 맞추면 어긋난다 — 실제로
          `border`(버튼에는 있고 select 에는 없음)와 `px-2.5` vs `px-4` 때문에 두 요소가
          다른 크기로 보였다(2026-08-27). `buttonVariants` 를 그대로 얹으면 테두리·패딩·
          글자·전이까지 한 벌로 따라온다.

          그 위에 얹는 것은 셋뿐이다:
          - `justify-between` — `buttonVariants` 의 `justify-center` 를 되돌린다. select 는
            값과 chevron 을 양끝으로 밀어야 한다
          - `data-[size=default]:h-11` — `SelectTrigger` 기본값 `data-[size=default]:h-8` 을
            지운다. variant 가 다르면 `twMerge` 가 다른 그룹으로 보고 둘 다 남겨서,
            속성 선택자가 붙은 기본값이 specificity 에서 이긴다
          - `dark:bg-primary` — 같은 이유로 기본값 `dark:bg-input/30` 을 지운다.
            이 앱은 `dark` 고정이라 이게 없으면 배경이 회색인 채로 남는다
        */}
        <SelectTrigger
          aria-label="강수"
          className={cn(
            buttonVariants({ size: 'lg' }),
            'data-[state=open]:bg-primary/80 dark:bg-primary dark:hover:bg-primary/80 [&_svg]:text-primary-foreground/70 h-12 w-full justify-between rounded-r-none border-r-0 data-[size=default]:h-12',
          )}
        >
          {/*
            `<SelectValue />` 를 비워 두면 Radix 가 선택값을 클라이언트에서 채워서
            **SSR HTML 에는 빈 칸이 나가고** 하이드레이션 직후 "128강"이 들어오며 폭이 튄다.
            값이 controlled state 라 여기서 직접 그리면 서버·클라이언트가 같은 글자를 낸다.
          */}
          <SelectValue>{size}강</SelectValue>
        </SelectTrigger>
        {/*
          기본값 `position="item-aligned"` 는 네이티브 select 처럼 **트리거를 덮으면서**
          현재 항목을 트리거 자리에 맞춘다. 여기서는 트리거가 버튼 절반인 컨트롤이라
          그게 덮이면 무엇을 누른 건지 사라진다. `popper` + `align="start"` 로
          **컨트롤 바로 아래**에 펼친다.

          폭은 `min-w-36`(144px) 기본값 대신 트리거 폭을 최소값으로 잡는다 — 그래야
          "8강" 같은 짧은 항목에서도 컨트롤과 같은 너비로 떨어지고, "128강" 이 들어오면
          거기에 맞춰 늘어난다. 항목의 `py-2` 는 h-11 트리거와 밀도를 맞추려는 것이다.
        */}
        <SelectContent
          position="popper"
          align="start"
          className="min-w-(--radix-select-trigger-width)"
        >
          {availableSizes.map((s) => (
            <SelectItem key={s} value={String(s)} className="py-2">
              {s}강
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* 칸막이는 배경색이 아니라 글자색의 투명도로 낸다 — 같은 면 위의 분할선이라는 뜻. */}
      <Button
        size="lg"
        className="border-primary-foreground/25 h-12 w-full rounded-l-none border-l"
        onClick={start}
        disabled={loading}
      >
        {loading ? '대진 뽑는 중...' : '시작하기'}
      </Button>
    </div>
  );
}
