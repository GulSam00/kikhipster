/**
 * 사용자 타입. 백엔드 `routers/auth.py` 의 응답과 1:1이다.
 *
 * 2026-08-28 이전에는 같은 모양이 세 군데에 **서로 다르게** 선언돼 있었다 —
 * `app/profile/page.tsx` 는 `{id,email,nickname,provider}`,
 * `app/profile/[userId]/page.tsx` 는 `{id,nickname,provider}`,
 * `lib/hooks/use-me.ts` 는 `{id,nickname}`. 여기로 모았다.
 */
export interface PublicUser {
  id: string;
  nickname: string;
  /** 'google' | 'kakao'. 프로필 화면이 가입 경로를 보여준다. */
  provider: string;
}

/** 로그인한 본인. 공개 정보에 이메일이 더 붙는다. */
export interface Me extends PublicUser {
  email: string;
}
