'use client';

import SplitFlapText from '@/components/reactbits/SplitFlapText';

interface Props {
  /** 이 라운드에서 몇 번째 경기인지. 이 값만 바뀌므로 앞자리만 넘어간다. */
  index: number;
  /** 이 라운드의 총 경기 수. 라운드 안에서는 변하지 않는다. */
  total: number;
}

/**
 * 진행 상황을 공항 안내판(split-flap)으로 보여 주는 계기판.
 *
 * **판 전체가 같은 타일이고, 넘어가는 건 앞 숫자 하나뿐이다.** 예전에는 분자만 판이고
 * `/ 4` 는 맨 글자였는데, 그러면 판 하나가 혼자 움직여서 오히려 따로 노는 것처럼 보였다.
 * 이제 `2`, `/`, `4` 가 모두 타일이고 `SplitFlapText` 가 글자별로 비교해 **달라진 자리만**
 * 넘긴다(`fromChar === targetChar` 면 계획에서 빠진다). 그래서 `2/4` → `3/4` 는 앞 한 장만
 * 움직이고 `/` 와 분모는 걸린 채로 있는다.
 *
 * **왜 제목과 다른 결인가.** 제목은 라운드마다 달라지는 것(`TITLE_RARITY` 의 희귀도)을
 * 맡고, 이 계기판은 어느 라운드에서나 똑같다. 둘을 같은 결로 꾸미면 "무엇이 라운드에 따라
 * 변하는 값인지"가 흐려진다.
 *
 * `prefers-reduced-motion` 은 `SplitFlapText` 가 자체적으로 본다(JS 훅 + CSS 미디어 쿼리
 * 양쪽) — 이 화면의 다른 연출들과 달리 `useReducedMotion` 을 따로 걸지 않아도 된다.
 */
export default function FlapCounter({ index, total }: Props) {
  return (
    <SplitFlapText
      text={`${index}/${total}`}
      /*
        중간에 무작위 숫자를 굴리지 않고 **한 번에 넘긴다**. 원본 기본값(8)은 슬롯머신처럼
        여러 장을 훑는데, 여기서 원한 건 값이 바뀔 때 한 번 "철컹" 걸리는 쪽이다.
        훑는 맛을 원하면 3~4 로 올리면 된다.
      */
      flipsPerChar={0}
      flipDuration={0.16}
      charset="numeric"
      /* 자리 채움 없이 실제 길이만. 원본 기본값 12 는 빈 타일 아홉 장을 더 만든다. */
      padTo={0}
      fontSize={36}
      gap={3}
      /* § Radius 의 `rounded-md`(8px)와 같은 값을 토큰에서 그대로 가져온다. */
      tileRadius="var(--radius-md)"
      aria-label={`${total}경기 중 ${index}번째`}
    />
  );
}
