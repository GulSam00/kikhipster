import type { ReactNode } from 'react';

interface Props {
  /** 이 콘텐츠로 무엇을 할지 — 월드컵은 시작하기·랭킹보기, 탑스터는 이미지 저장. */
  primary?: ReactNode;
  /** 이 페이지에 대한 방문자 동작 — 좋아요·공유. 주요 동작 아래 줄에 온다. */
  engage: ReactNode;
}

/**
 * 상세 페이지에서 **콘텐츠 바로 아래** 오는 액션 줄. 두 상세가 같은 자리를 쓴다.
 *
 * 좋아요·공유를 콘텐츠 위가 아니라 아래에 두는 이유: 둘 다 내용을 보고 나서 하는
 * 판단이다. 월드컵 상세는 예전에 이 줄이 후보 그리드 **위**에 있어서, 후보를 보기도
 * 전에 좋아요를 권하는 순서였다.
 *
 * **2026-09-01에 좌우 분할에서 세로 2단 중앙으로 바꿨다.** 예전에는 `justify-between`
 * 으로 주요 동작이 왼쪽, 좋아요·공유가 오른쪽이었는데, 넓은 화면에서 둘이 화면 양 끝까지
 * 벌어져 한 줄로 안 읽혔다. 지금은 위아래로 쌓고 둘 다 가운데에 둔다 — 시선이 콘텐츠
 * 중앙에서 그대로 내려온다.
 *
 * `flex-wrap` 이 필수다 — 없으면 소유자가 모바일에서 열었을 때 버튼이 한 줄에 묶여
 * 페이지가 가로로 밀린다(DESIGN.md § Mobile 위반). 탑스터 상세가 실제로 그랬다.
 */
export default function DetailActionBar({ primary, engage }: Props) {
  return (
    <div className="mb-8 flex flex-col items-center gap-3">
      {primary && (
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
          {primary}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">{engage}</div>
    </div>
  );
}
