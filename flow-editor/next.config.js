/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    esmExternals: false
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(txt)$/,
      use: 'raw-loader',
    });
    return config;
  }
};

module.exports = nextConfig; 