/**
 * 공유 링크·OG 태그에 쓰는 절대 URL의 기준.
 *
 * OG 메타태그는 **절대 URL이어야 한다** — 크롤러가 페이지를 긁을 때 상대 경로를 풀 기준이 없다.
 * 배포에서는 `NEXT_PUBLIC_SITE_URL` 을 주고, 없으면 Vercel이 넣어주는 `VERCEL_URL` 을 쓴다.
 * 둘 다 없으면 로컬 개발 포트로 떨어진다(`docker compose` 기준 프론트는 3300).
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3300';
}

export const SITE_NAME = 'kikhipster';
