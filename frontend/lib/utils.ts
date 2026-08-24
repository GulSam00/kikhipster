import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 백엔드 `created_at` 은 `datetime.utcnow()` 로 만든 naive UTC 문자열이라
 * 타임존 접미사가 없다. 그대로 `new Date()` 에 넘기면 로컬 시각으로 해석돼
 * KST 기준 9시간이 밀린다. 접미사가 없을 때만 `Z` 를 붙여 UTC로 고정한다.
 */
export function formatDate(iso: string) {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`
  return new Date(normalized).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
