'use server';

import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/domain/locale';

/**
 * 언어 전환. 쿠키만 바꾸면 Next 가 서버 액션 응답과 함께 현재 라우트를 다시 렌더하므로
 * 호출부가 `router.refresh()` 를 따로 부를 필요가 없다(next-intl "without i18n routing" 예제와 같은 방식).
 */
export async function setLocaleCookie(locale: string): Promise<void> {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
}
