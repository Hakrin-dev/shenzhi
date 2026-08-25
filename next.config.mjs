/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // 允许的开发服务器来源（按需添加你的本地/局域网 IP）
  // 示例：allowedDevOrigins: ['192.168.1.100', 'localhost', '127.0.0.1']
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1'
  ]
};

export default nextConfig;
