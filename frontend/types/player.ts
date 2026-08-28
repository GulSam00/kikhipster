/**
 * 재생 큐에 들어가는 한 곡.
 *
 * 곡·앨범·월드컵 후보처럼 출처가 제각각인 데이터를 하단 재생기가 같은 모양으로 다루기
 * 위한 정규화 타입이다. `PlayerContext` 와 `lib/domain/playable` 이 함께 쓰기 때문에
 * 둘 중 한쪽에 두면 import 가 순환한다 — 그래서 타입만 여기 둔다.
 */
export interface QueueTrack {
  id: string;
  name: string;
  artist: string;
  albumCover: string | null;
  /** iTunes 30초 미리듣기 URL. **없는 곡은 큐에 넣지 않는다** — 그래서 null 이 아니다. */
  previewUrl: string;
}
