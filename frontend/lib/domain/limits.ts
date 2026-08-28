/**
 * 도메인 규칙 상수. **백엔드와 같은 값을 유지해야 한다.**
 *
 * 정본은 백엔드다 — 프론트가 통과시켜도 백엔드가 422 로 막는다. 그래서 여기 값이 더
 * 느슨하면 "저장 버튼을 눌렀는데 알 수 없는 오류"가 되고, 더 빡빡하면 멀쩡한 입력을
 * 막는다. 어느 쪽도 화면에서는 원인이 안 보인다.
 *
 * 2026-08-28 이전에는 이 값들이 `TopsterEditor` 와 `TournamentEditor` 안에 각각
 * 흩어져 있었다. 대응하는 백엔드 위치를 옆에 적어 둔다.
 */

/** 백엔드 `schemas/topster.py` MIN_SIDE / MAX_SIDE / MAX_CELLS */
export const TOPSTER_MIN_SIDE = 1;
export const TOPSTER_MAX_SIDE = 5;
/** 격자 전체 칸 수 상한. 5를 넘으면 커버가 알아볼 수 없을 만큼 작아진다. */
export const TOPSTER_MAX_CELLS = 25;

/** 백엔드 `schemas/tournament.py` MIN_POOL / MAX_POOL */
export const TOURNAMENT_MIN_POOL = 4;
export const TOURNAMENT_MAX_POOL = 512;

/**
 * 백엔드 `schemas/tournament.py` VALID_PLAY_SIZES.
 * 128강(127경기)이 한 자리에서 끝낼 수 있는 현실적 상한이다.
 * 화면에 실제로 뜨는 값은 서버가 풀 크기에 맞춰 걸러 준 `available_sizes` 다.
 */
export const VALID_PLAY_SIZES = [4, 8, 16, 32, 64, 128] as const;

/**
 * 탑스터 격자 한 변의 입력값을 규칙 안으로 눌러 담는다.
 *
 * 칸 수는 MIN_SIDE~MAX_SIDE 이고 전체 칸(가로×세로)이 MAX_CELLS 를 넘지 않아야 한다 —
 * 백엔드와 같은 규칙. `other` 는 반대 축(가로를 바꾸면 세로, 세로를 바꾸면 가로)의
 * 현재 값이다.
 */
export function clampTopsterSide(raw: string, other: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return TOPSTER_MIN_SIDE;
  const capped = Math.min(TOPSTER_MAX_SIDE, Math.max(TOPSTER_MIN_SIDE, n));
  return Math.min(
    capped,
    Math.max(TOPSTER_MIN_SIDE, Math.floor(TOPSTER_MAX_CELLS / Math.max(other, 1))),
  );
}
