/**
 * iTunes 앨범 제목의 표시용 정리.
 *
 * iTunes 는 앨범 이름 끝에 `- Single` / `- EP` 를 붙여서 준다(앨범 검색 900건 실측에서
 * `Single` 52%, `EP` 9%). 화면에 그대로 내보내면 격자 옆 목록·탑스터 PNG·월드컵 후보까지
 * 전부 이 꼬리를 달고 다닌다.
 *
 * **백엔드가 아니라 여기서 떼는 이유는 캐시다.** `music_cache` 는 매핑을 마친 값을
 * 저장하므로(`_warm_item_cache`) 백엔드에서 떼면 이미 저장된 행이 최대 30일간 옛 제목을
 * 계속 내보낸다 — 한 화면에 정리된 제목과 안 된 제목이 섞인다.
 *
 * **종류 정보는 잃지 않는다.** 백엔드 `album_type` 은 원문 제목으로 판정하므로 여기서
 * 꼬리를 떼도 `single`/`ep`/`album` 은 그대로 정확하다. 앨범 상세의 배지가 그 값을 쓴다.
 */

/**
 * 백엔드 `_SINGLE_EP_SUFFIX` 와 같은 패턴이다. 둘 중 하나만 고치면 제목은 정리됐는데
 * 배지는 `album` 인(또는 그 반대인) 상태가 되므로 **한쪽을 고치면 다른 쪽도 본다**.
 *
 * 구분자를 반드시 요구하는 것이 핵심이다. 접미만 보면 단어 끝이 EP 인 제목과
 * `feelslikeimfallinginlove (Single Version)` 같은 괄호 표기가 오탐으로 걸린다 —
 * 둘 다 실측에서 확인된 사례다. 실제 데이터에는 반각 하이픈만 나왔지만
 * en/em dash 도 받아 둔다.
 */
const SINGLE_EP_SUFFIX = /\s[-–—]\s*(?:single|ep)\s*$/i;

/**
 * 제목 끝의 ` - Single` / ` - EP` 를 뗀다.
 *
 * **제목 중간의 EP 는 건드리지 않는다.** 꼬리는 iTunes 가 덧붙인 분류표라 떼도 이름이
 * 남지만, `NewJeans 2nd EP 'Get Up'` 의 EP 는 이름의 일부다 — 떼면
 * `NewJeans 2nd 'Get Up'` 이 되어 망가진다. 중간 표기는 백엔드가 `album_type` 을
 * 판정할 때만 본다.
 */
export function stripAlbumSuffix(title: string): string {
  return title.replace(SINGLE_EP_SUFFIX, '').trim();
}

/**
 * `album_type` 의 표시 라벨.
 *
 * **CSS `capitalize` 로 처리하면 안 된다** — 첫 글자만 올려서 `ep` 가 `Ep` 로 나온다.
 * EP 는 Extended Play 의 약어라 두 글자를 다 올려야 한다. 실제로 그렇게 렌더되던 것을
 * 2026-08-31 에 고쳤다(그전에는 필터 때문에 `Album` 외의 값이 화면에 거의 안 떠서
 * 드러나지 않았다).
 *
 * 모르는 값이 오면 원문을 그대로 돌려준다 — 백엔드가 새 종류를 추가해도 빈칸이 되지 않는다.
 */
const ALBUM_TYPE_LABEL: Record<string, string> = {
  album: 'Album',
  single: 'Single',
  ep: 'EP',
};

export function albumTypeLabel(type: string): string {
  return ALBUM_TYPE_LABEL[type] ?? type;
}
