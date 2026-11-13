import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

import { LOCALE_COOKIE, resolveLocale } from '@/lib/domain/locale';

import { loadMessages } from '@/i18n/messages';

/**
 * next-intl 의 요청 단위 설정(`next.config.ts` 의 플러그인이 이 파일을 찾는다).
 *
 * **i18n 라우팅 없이** 쓴다 — URL 에 locale 이 없으므로 여기서 쿠키·`Accept-Language` 로 정한다.
 * 미들웨어(Next 16 의 `proxy.ts`)를 두지 않은 이유: next-intl 의 미들웨어는 locale 을 URL 로
 * 옮기는(리다이렉트·rewrite) 용도라 이 구성에는 할 일이 없고, 해석은 이 함수 한 곳이면 된다.
 *
 * 쿠키·헤더를 읽으므로 **이 설정을 타는 모든 페이지는 동적 렌더(ƒ)가 된다** — 루트 레이아웃이
 * `getLocale()` 을 부르기 때문이다. 2026-11-13 이슈 로그에 빌드 전후 비교가 있다.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get('accept-language'),
  );

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
