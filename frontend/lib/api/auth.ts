import { apiFetch } from '@/lib/api/client';
import type { Me, PublicUser } from '@/types/user';

/** 로그인한 사용자. 토큰이 없거나 만료면 401 이 던져진다. */
export const getMe = () => apiFetch<Me>('/api/auth/me');

export const getUser = (userId: string) => apiFetch<PublicUser>(`/api/auth/users/${userId}`);
