/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile our internal packages so Next.js can compile them
  transpilePackages: ['@attesta/ui', '@attesta/shared', '@attesta/db'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // Strict mode catches subtle React bugs in development
  reactStrictMode: true,
}

export default nextConfig
