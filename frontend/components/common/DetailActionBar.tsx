import type { ReactNode } from 'react';

interface Props {
  /** 이 콘텐츠로 무엇을 할지 — 월드컵은 시작하기·랭킹보기, 탑스터는 이미지 저장. */
  primary?: ReactNode;
  /**
   * 이 페이지에 대한 방문자 동작 — 좋아요·공유. **원형 아이콘 버튼으로 넘긴다**
   * (`LikeButton` 의 `tone="icon"`, `ShareButton` 의 `iconOnly`).
   */
  engage: ReactNode;
}

/**
 * 상세 페이지에서 **콘텐츠 바로 아래** 오는 액션 줄. 두 상세가 같은 자리를 쓴다.
 *
 * 좋아요·공유를 콘텐츠 위가 아니라 아래에 두는 이유: 둘 다 내용을 보고 나서 하는
 * 판단이다. 월드컵 상세는 예전에 이 줄이 후보 그리드 **위**에 있어서, 후보를 보기도
 * 전에 좋아요를 권하는 순서였다.
 *
 * 배치가 세 번 바뀐 자리라 경위를 남긴다. 원래는 `justify-between` 좌우 분할이었는데
 * 넓은 화면에서 둘이 **화면 양 끝까지** 벌어져 한 줄로 안 읽혔고(9/01), 세로 2단 중앙으로
 * 바꿨더니 이번엔 배경도 테두리도 없이 pill 넷이 떠 있는 모양이 됐다.
 *
 * **2026-09-08에 고친 것은 정렬이 아니라 위계다.** 앞의 두 시도는 둘 다 *배치*를 건드렸는데,
 * 진짜 원인은 **주요 CTA 와 좋아요·공유가 같은 무게였다는 것**이었다. 크기가 같으면 나란히
 * 둬도 경쟁하고 위아래로 쌓아도 둘 다 어중간하게 뜬다. 그래서 참여 동작을 pill 에서
 * 원형 아이콘(44px)으로 낮췄다 — 컨테이너(배경·테두리) 없이도 줄이 정돈된다.
 *
 * **배치는 세로 2단 중앙을 유지한다.** 위계가 갈린 뒤로는 한 줄에 합칠 수도 있었지만,
 * 주요 동작과 참여 동작은 성격이 다르므로 줄을 나눠 두는 편이 읽기 쉽다. 대신 두 줄이
 * 같은 무게로 쌓이던 예전과 달리, 아랫줄은 아이콘 둘뿐이라 윗줄을 가리지 않는다.
 *
 * `flex-wrap` 이 필수다 — 없으면 월드컵의 `PlayLauncher`(고정 `w-56`) 옆에 랭킹보기가
 * 붙어 페이지가 가로로 밀린다(DESIGN.md § Mobile 위반).
 */
export default function DetailActionBar({ primary, engage }: Props) {
  return (
    <div className="mb-8 flex flex-col items-center gap-2">
      {primary && (
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
          {primary}
        </div>
      )}
      {/* 아이콘 둘은 한 덩어리로 읽혀야 하므로 줄 간격(gap-2)보다 좁게 붙인다. */}
      <div className="flex items-center gap-1">{engage}</div>
    </div>
  );
}
