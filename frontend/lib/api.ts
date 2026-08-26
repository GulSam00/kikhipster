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
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new ApiError(res.status);
  // DELETE 계열은 204라 본문이 비어 있다. 그대로 res.json() 을 부르면 SyntaxError 가 나서
  // 삭제가 성공했는데도 호출부의 catch 로 떨어진다 — 댓글 삭제가 실제로 그랬다(2026-08-26).
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
