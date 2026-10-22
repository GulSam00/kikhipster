import type { Play, PlayRound } from '@/types/tournament';

/**
 * 대진 데이터를 화면이 쓰기 좋은 모양으로 정리한다.
 *
 * 서버는 라운드를 평평한 배열로 준다(`round_num`·`match_num`). `round_num` 은 **1이 결승**이고
 * 숫자가 클수록 앞 라운드다 — 트리를 왼쪽(앞)에서 오른쪽(결승)으로 그리려면 내림차순으로 훑는다.
 */

export interface BracketRound {
  roundNum: number;
  label: string;
  matches: PlayRound[];
}

/** 남은 경기 수가 아니라 라운드 번호로 이름을 만든다. 2강이 아니라 '결승'으로 보이게. */
export function roundLabel(roundNum: number): string {
  if (roundNum === 1) return '결승';
  if (roundNum === 2) return '준결승';
  return `${2 ** roundNum}강`;
}

/** 앞 라운드 → 결승 순서로 묶는다. */
export function toRounds(play: Play): BracketRound[] {
  const byRound = new Map<number, PlayRound[]>();
  for (const r of play.rounds) {
    const list = byRound.get(r.round_num) ?? [];
    list.push(r);
    byRound.set(r.round_num, list);
  }

  return [...byRound.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([roundNum, matches]) => ({
      roundNum,
      label: roundLabel(roundNum),
      matches: [...matches].sort((a, b) => a.match_num - b.match_num),
    }));
}

/** 아직 승자가 없는 경기 중 먼저 치러야 할 것. */
export function nextMatch(play: Play): PlayRound | null {
  const pending = play.rounds.filter((r) => !r.winner_id);
  if (pending.length === 0) return null;
  const maxRound = Math.max(...pending.map((r) => r.round_num));
  return (
    pending.filter((r) => r.round_num === maxRound).sort((a, b) => a.match_num - b.match_num)[0] ??
    null
  );
}

/**
 * 이 경기의 승자가 올라갈 다음 경기.
 *
 * 대진은 완전 이진 트리라 **다음 라운드의 `match_num` 은 현재의 절반(내림)** 이다.
 * 서버가 자리를 명시적으로 주지 않으므로 이 규칙으로 찾는다 — 결승이면 다음이 없다.
 */
export function parentMatch(play: Play, match: PlayRound): PlayRound | null {
  if (match.round_num <= 1) return null;
  const parentRound = match.round_num - 1;
  const parentNum = Math.floor(match.match_num / 2);
  return play.rounds.find((r) => r.round_num === parentRound && r.match_num === parentNum) ?? null;
}
