/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
   allowedDevOrigins: [
    '192.168.1.19',
    '10.197.73.12',
    'localhost',
    '127.0.0.1',
    'nonopinionative-unoverruled-clementine.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    '*.ngrok.io',
    '*.ngrok.dev',
  ],
};

export default nextConfig;
