/* eslint-disable @next/next/no-img-element -- ImageResponse(satori)는 next/image 를 렌더하지 못한다. 여기서는 <img> 가 정상이다. */
import type { ReactElement } from 'react';

import { SITE_NAME } from '@/lib/site';

/**
 * OG 썸네일 공통 규격과 껍데기.
 *
 * `ImageResponse` 는 satori 위에서 도는 별도 렌더러라 **브라우저 캔버스를 쓸 수 없다** —
 * `lib/topster-image.ts`(캔버스 기반 PNG 저장)를 재활용하지 못하는 이유다(2026-08-27).
 * 지원하는 CSS도 flexbox 중심의 부분집합이라, 여기서는 격자도 flex 로 쌓는다.
 *
 * 색은 DESIGN.md 토큰의 실제 값을 직접 적는다. satori 에는 Tailwind 도 CSS 변수도 없다.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** globals.css 의 dark 토큰에서 가져온 값. 여기서만 하드코딩한다. */
const COLORS = {
  background: '#09090b', // --background (zinc-950)
  card: '#18181b', // --card
  foreground: '#fafafa', // --foreground
  muted: '#a1a1aa', // --muted-foreground
  primary: '#f5a524', // --primary (amber)
};

interface ShellProps {
  /** 좌측 상단 분류 라벨 — "음악 월드컵" 처럼 무엇인지 한마디로. */
  kind: string;
  title: string;
  subtitle?: string;
  /** 우측에 깔 커버 URL들. 없으면 좌측 텍스트가 폭을 다 쓴다. */
  covers: string[];
}

/**
 * 좌측 텍스트 + 우측 커버 모자이크.
 * 커버가 없을 수도 있으므로(전부 조회 실패) 텍스트만으로도 성립하게 둔다.
 */
export function OgShell({ kind, title, subtitle, covers }: ShellProps): ReactElement {
  const shown = covers.slice(0, 9);
  // 커버는 정사각이다. 630 영역을 2×2(315) 또는 3×3(210)으로 나눠 셀도 정사각으로 두면
  // objectFit:cover 가 잘라낼 것이 없어 앨범 아트가 온전히 보인다.
  const cell = shown.length <= 4 ? 315 : 210;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: COLORS.background,
        color: COLORS.foreground,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          flex: 1,
          // 커버가 있으면 남는 폭(1200 - 630)만 쓴다.
          maxWidth: shown.length > 0 ? 570 : undefined,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 26, color: COLORS.primary, marginBottom: 20 }}>
            {kind}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.15,
              // satori 에는 -webkit-line-clamp 가 없다. 길면 잘리도록 높이를 제한한다.
              maxHeight: 210,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                color: COLORS.muted,
                marginTop: 24,
                maxHeight: 80,
                overflow: 'hidden',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: COLORS.muted }}>{SITE_NAME}</div>
      </div>

      {shown.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            width: 630,
            height: '100%',
            backgroundColor: COLORS.card,
          }}
        >
          {shown.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              width={cell}
              height={cell}
              style={{ objectFit: 'cover' }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
