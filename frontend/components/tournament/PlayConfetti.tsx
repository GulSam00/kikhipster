'use client';

import { useEffect, useState } from 'react';

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

import { cn } from '@/lib/utils';

/** 조각 수. 더 늘리면 320px 화면이 종이로 덮여 우승 커버가 안 보인다. */
const PIECE_COUNT = 40;
/** 가장 늦게 떨어지는 조각까지 끝나는 시간(ms). 지나면 스스로 언마운트한다. */
const LIFETIME_MS = 5200;

/**
 * 조각 색. 전부 기존 토큰이라 § Color 의 하드코딩 금지에 걸리지 않는다.
 *
 * **금색(`primary`)을 섞지 않았다.** 이 화면은 `Trophy` 와 '최종 우승'으로 이미 primary
 * 강조 2개, 즉 § Color budget 의 WARN 선에 걸쳐 있다. 여기에 amber 조각 열 개를 뿌리면
 * BLOCK 이다. 무채색으로 두면 이 화면에서 금색인 것은 트로피 하나뿐이라 시선도 거기 남는다.
 */
const TONES = [
  'bg-foreground',
  'bg-foreground/70',
  'bg-muted-foreground',
  'bg-muted-foreground/60',
];

interface Piece {
  /** 시작 x 위치(%). */
  left: number;
  delay: number;
  duration: number;
  /** 떨어지면서 옆으로 흘러가는 거리(px). 음수면 왼쪽. */
  drift: number;
  /** 총 회전량(deg). */
  spin: number;
  width: number;
  height: number;
  tone: string;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.7,
    duration: 2.6 + Math.random() * 1.8,
    drift: Math.round((Math.random() - 0.5) * 180),
    spin: Math.round(360 + Math.random() * 720),
    width: 4 + Math.round(Math.random() * 4),
    height: 7 + Math.round(Math.random() * 7),
    // 순환 배정이라 네 가지 색이 항상 같은 비율로 섞인다 — 무작위로 뽑으면 한 판에서
    // 한 색으로 쏠릴 수 있다.
    tone: TONES[i % TONES.length],
  }));
}

/**
 * 우승 화면에서 **한 번만** 터지는 콘페티.
 *
 * 되풀이하지 않는다 — 계속 떨어지면 장식이 화면의 주인공이 되고, 그 아래에서 우승 곡을
 * 듣거나 댓글을 쓰는 동안 계속 시야에 걸린다. 5.2초 뒤 스스로 언마운트한다.
 *
 * 라이브러리를 쓰지 않는다. 조각마다 다른 것은 시작 위치·지연·속도·흘림·회전·크기뿐이고
 * 전부 인라인 스타일 숫자로 넘길 수 있어서, keyframes 하나(`app/globals.css` 의
 * `confetti-fall`)와 `<span>` 40개면 끝난다. 색만 토큰 클래스로 준다.
 *
 * `prefers-reduced-motion` 이면 아무것도 그리지 않는다. 이 화면의 다른 연출과 같은
 * 기준이다(`useReducedMotion`).
 *
 * `fixed` 라 스크롤과 무관하게 화면 전체에 떨어진다. `pointer-events-none` 이라 아래의
 * 재생 버튼·링크를 막지 않고, `aria-hidden` 이라 스크린리더에는 없는 것과 같다.
 */
export default function PlayConfetti() {
  const reduced = useReducedMotion();
  // 조각 배치는 마운트 때 한 번만 뽑는다. 이 화면은 데이터를 받은 뒤에만 그려지므로
  // 서버에서 렌더되는 경로가 없다 — 하이드레이션 불일치가 생길 자리가 아니다.
  const [pieces] = useState(makePieces);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFinished(true), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, []);

  if (reduced || finished) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className={cn('animate-confetti-fall absolute top-0', piece.tone)}
          style={
            {
              left: `${piece.left}%`,
              width: piece.width,
              height: piece.height,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--confetti-drift': `${piece.drift}px`,
              '--confetti-spin': `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
