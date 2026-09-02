/** Vercel 构建时会注入 VERCEL=1;据此区分平台专属配置(与 scinexus 同构) */
const isVercel = !!process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 仅供 Docker 镜像使用;Vercel 走平台默认产物,必须关闭
  ...(isVercel ? {} : { output: 'standalone' }),
  reactStrictMode: true,
   allowedDevOrigins: [
    '192.168.1.19',
    '10.197.73.12',
    'localhost',
    '127.0.0.1',
    'nonopinionative-unoverruled-clementine.ngrok-free.dev',
    '*.ts.net',
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    '*.ngrok.io',
    '*.ngrok.dev',
  ],
};

export default nextConfig;
