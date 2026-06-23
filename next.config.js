/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 React Strict Mode
  reactStrictMode: true,

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.agnes-ai.com',
      },
    ],
    // 开发模式下不优化图片（加快构建速度）
    unoptimized: process.env.NODE_ENV === 'development',
  },
};

module.exports = nextConfig;
