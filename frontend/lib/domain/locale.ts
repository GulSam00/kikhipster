/**
 * UI 언어(locale) 정의와 해석 규칙. 순수 함수만 둔다 — 쿠키·헤더를 읽는 쪽은
 * `i18n/request.ts`, 쿠키를 쓰는 쪽은 `i18n/actions.ts` 다.
 *
 * 라우트에 locale 을 넣지 않는다(`app/[locale]` 아님, 2026-11-13 결정). 그래서 locale 은
 * 매 요청 **쿠키 → `Accept-Language` → 기본값** 순서로 정해진다.
 */

export const LOCALES = ['ko', 'en', 'ja'] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'ko';

/** next-intl 문서의 관례 이름. 언어 전환 UI 가 쓰고 `i18n/request.ts` 가 읽는다. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** 쿠키 수명 — 1년. 언어는 한 번 고르면 잘 안 바꾼다. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 언어 전환 메뉴에 보이는 이름. **번역하지 않는다** — 자기 언어로 적어야 지금 화면 언어를
 * 못 읽는 사람도 자기 언어를 찾는다.
 */
export const LOCALE_NATIVE_NAMES: Record<AppLocale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

/** Open Graph `og:locale` 형식(언어_지역). */
export const OG_LOCALES: Record<AppLocale, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  ja: 'ja_JP',
};

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * `Accept-Language` 에서 지원하는 언어 중 **선호도가 가장 높은 것**을 고른다.
 *
 * `q` 값 순으로 정렬한 뒤(같으면 헤더에 적힌 순서) 기본 언어 태그(`en-US` → `en`)가
 * 지원 목록에 있는 첫 항목을 쓴다. `q=0` 은 "원하지 않음"이라 건너뛴다. 맞는 게 없으면 `null`.
 */
export function matchAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;

  const entries = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return {
        lang: tag.trim().toLowerCase().split('-')[0],
        q: Number.isFinite(q) ? q : 0,
        index,
      };
    })
    .filter((e) => e.lang !== '' && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { lang } of entries) {
    if (isLocale(lang)) return lang;
  }
  return null;
}

/** 쿠키 → `Accept-Language` → `ko`. 쿠키 값이 지원 목록 밖이면 없는 것으로 친다. */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): AppLocale {
  if (isLocale(cookieValue)) return cookieValue;
  return matchAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/**
 * 백엔드 요청 경로에 `locale` 쿼리 파라미터를 붙인다. 캐시 키에 그대로 들어가도록 헤더가 아니라
 * 쿼리로 싣는다. 이미 `locale` 이 있으면 건드리지 않는다(호출부가 명시한 값이 이긴다).
 */
export function withLocaleParam(path: string, locale: AppLocale): string {
  const qIndex = path.indexOf('?');
  if (qIndex === -1) return `${path}?locale=${locale}`;
  if (new URLSearchParams(path.slice(qIndex + 1)).has('locale')) return path;
  const sep = path.endsWith('?') || path.endsWith('&') ? '' : '&';
  return `${path}${sep}locale=${locale}`;
}
