import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * next-intl 의 요청 설정 파일. i18n 라우팅 없이(쿠키 기반) 쓰므로 미들웨어는 없다 — `i18n/request.ts` 참조.
 */
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // iTunes/Apple Music 아트워크 CDN. 서버가 is1~is6 등 여러 서브도메인을 임의로 배정한다.
      { protocol: 'https', hostname: '*.mzstatic.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
