import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // iTunes/Apple Music 아트워크 CDN. 서버가 is1~is6 등 여러 서브도메인을 임의로 배정한다.
      { protocol: 'https', hostname: '*.mzstatic.com' },
    ],
  },
};

export default nextConfig;
