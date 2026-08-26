const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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
  const res = await fetch(`${BASE_URL}${path}`, {
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
