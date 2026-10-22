import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>소셜 계정으로 간편하게 시작하세요</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild size="lg" className="h-11 bg-white text-zinc-900 hover:bg-zinc-100">
            <a href={`${API}/api/auth/google`}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 계속하기
            </a>
          </Button>

          <Button asChild size="lg" className="h-11 bg-[#FEE500] text-zinc-900 hover:bg-[#FDD800]">
            <a href={`${API}/api/auth/kakao`}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="size-5"
              >
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.56 5.08 3.93 6.5L5 21l4.27-2.28C10.13 18.9 11.04 19 12 19c5.52 0 10-3.48 10-7.8C22 6.48 17.52 3 12 3z" />
              </svg>
              카카오로 계속하기
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
