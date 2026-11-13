import { DEFAULT_LOCALE, isLocale, withLocaleParam, type AppLocale } from '@/lib/domain/locale';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * 이 접두사로 시작하는 요청에는 현재 UI 언어를 `?locale=ko|en|ja` 로 싣는다.
 * 음악 이름(아티스트·앨범·곡)을 언어별로 받는 통로다(`20261113-1630-i18n-localized-music-names`).
 * 백엔드가 아직 이 파라미터를 무시해도 응답은 같다.
 */
const LOCALIZED_PREFIX = '/api/music/';

/**
 * 지금 요청의 UI 언어.
 *
 * - 브라우저: 루트 레이아웃이 `<html lang>` 에 해석된 locale 을 넣어 두므로 그걸 읽는다.
 *   쿠키는 못 쓴다 — 쿠키가 없을 때(`Accept-Language` 로 정해진 경우) 값이 없다.
 * - 서버: next-intl 의 `getLocale()` (요청 단위로 `i18n/request.ts` 를 탄다).
 *   Server Component·Route Handler 에서만 동작하고, Client Component 의 SSR 중에 부르면
 *   next-intl 이 에러를 던진다 — 클라이언트 컴포넌트의 음악 조회는 effect·이벤트에서 일어나야 한다.
 */
async function currentLocale(): Promise<AppLocale> {
  if (typeof window !== 'undefined') {
    const lang = document.documentElement.lang;
    return isLocale(lang) ? lang : DEFAULT_LOCALE;
  }
  const { getLocale } = await import('next-intl/server');
  return getLocale();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number) {
    super(`API Error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  // Content-Type 은 본문이 있을 때만 붙인다. GET 에까지 붙이면 단순 요청 조건이 깨져
  // URL 마다 CORS 프리플라이트(OPTIONS)가 한 번씩 더 나간다 (2026-08-27).
  const hasBody = options?.body != null;
  const url = path.startsWith(LOCALIZED_PREFIX)
    ? withLocaleParam(path, await currentLocale())
    : path;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    // options 를 먼저 펼친다 — 뒤에 두면 호출부가 headers 를 넘기는 순간
    // Authorization 까지 통째로 덮인다.
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status);
  // DELETE 계열은 204라 본문이 비어 있다. 그대로 res.json() 을 부르면 SyntaxError 가 나서
  // 삭제가 성공했는데도 호출부의 catch 로 떨어진다 — 댓글 삭제가 실제로 그랬다(2026-08-26).
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
