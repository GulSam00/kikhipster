import type { CSSProperties, ReactNode } from 'react';

interface StarBorderProps {
  children?: ReactNode;
  className?: string;
  /** 훑고 지나가는 빛의 색. 기본값은 토큰이라 색 예산을 쓰지 않는다. */
  color?: string;
  speed?: CSSProperties['animationDuration'];
  /** 위아래로 드러나는 빛 띠의 두께(px). */
  thickness?: number;
}

/**
 * 감싼 요소의 위·아래 모서리를 빛이 반대 방향으로 훑고 지나가는 테두리
 * (React Bits `StarBorder`, https://reactbits.dev/r/StarBorder-TS-TW.json 를 고쳐 씀).
 *
 * **원본에서 고친 것**
 * - `rounded-[20px]` → `rounded-xl`. DESIGN.md § Radius 의 5종(none/md/lg/xl/full) 밖의
 *   임의 값은 WARN 이다.
 * - 안쪽에 `background:#000000` / `borderColor:#222222` / `py-[16px] px-[26px]` 를 칠하던
 *   div 를 통째로 뺐다. 원본은 그 자체로 버튼이라 표면을 직접 그렸지만, 여기서는 `Card`
 *   를 감싸는 껍데기라 표면·테두리·여백은 감싸이는 쪽(`bg-card`)이 갖는다. 두 겹으로
 *   칠하면 하드코딩된 색이 토큰을 덮어써서 다크 테마가 어긋난다.
 * - 기본 색을 `white` → `var(--foreground)`. § Color 의 하드코딩 금지에 걸리지 않고,
 *   무채색이라 이 화면의 primary 예산(선택 버튼 두 개)을 건드리지 않는다.
 * - 폴리모픽 `as` prop 과 `rest as any` 를 뺐다 — 쓰는 곳이 감싸기 한 가지뿐이다.
 *
 * keyframes 는 `app/globals.css` 에 있다. 원본이 준 `tailwind.config.js` 스니펫은 이
 * 프로젝트에 config 파일이 없어(Tailwind v4, `components.json` 의 `"config": ""`)
 * 쓸 수 없다.
 */
export default function StarBorder({
  children,
  className = '',
  color = 'var(--foreground)',
  speed = '6s',
  thickness = 2,
}: StarBorderProps) {
  return (
    <div
      className={['relative overflow-hidden rounded-xl', className].join(' ')}
      style={{ padding: `${thickness}px 0` }}
    >
      <div
        aria-hidden
        className="animate-star-movement-bottom pointer-events-none absolute right-[-250%] bottom-[-11px] z-0 h-1/2 w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        aria-hidden
        className="animate-star-movement-top pointer-events-none absolute top-[-10px] left-[-250%] z-0 h-1/2 w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="relative z-1 h-full">{children}</div>
    </div>
  );
}
