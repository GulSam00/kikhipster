const KEY = 'guest_token';

/**
 * 비로그인 작성자 토큰.
 *
 * 비로그인 댓글도 "자기 것만 지울 수 있어야" 하는데, 요청에 있는 입력란은 닉네임과 내용
 * 둘뿐이라 **한국 게시판 관행인 비밀번호 칸을 두지 않았다.** 대신 브라우저가 최초 1회
 * 만들어 `localStorage` 에 두는 이 토큰으로 본인을 가린다. 서버는 평문이 아니라
 * **SHA-256 해시만** 저장하고, 삭제·수정 요청의 해시가 일치할 때만 통과시킨다.
 *
 * **한계**: 브라우저 데이터를 지우거나 다른 기기·시크릿 창에서 보면 자기 댓글을 지울 수
 * 없다. 비밀번호가 없는 이상 피할 수 없고, 익명 댓글의 무게에 비하면 감수할 만하다.
 *
 * 서버로 보내는 방법이 요청 종류마다 다르다 — `lib/api/comments.ts` 주석 참고.
 */
export function getGuestToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem(KEY);
  if (!token) {
    // randomUUID 는 보안 컨텍스트(https·localhost)에서만 있다. 아니면 충분히 긴 난수로 대체한다.
    token =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random()
            .toString(36)
            .slice(2)}`;
    localStorage.setItem(KEY, token);
  }
  return token;
}
