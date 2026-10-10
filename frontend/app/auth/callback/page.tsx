'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { Spinner } from '@/components/ui/spinner';

function CallbackStatus() {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
      <Spinner />
      로그인 처리 중...
    </div>
  );
}

function AuthCallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    router.replace('/');
  }, [params, router]);

  return <CallbackStatus />;
}

export default function AuthCallbackPage() {
  // useSearchParams()는 CSR bailout을 유발하므로 Suspense 경계가 필요하다.
  return (
    <Suspense fallback={<CallbackStatus />}>
      <AuthCallbackHandler />
    </Suspense>
  );
}
