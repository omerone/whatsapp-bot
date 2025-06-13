/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material'],
  experimental: {
    esmExternals: false
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(txt)$/,
      use: 'raw-loader',
    });
    return config;
  },
  server: {
    port: 4000
  }
};

module.exports = nextConfig; 