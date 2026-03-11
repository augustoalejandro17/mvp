const path = require('path');

const normalizeDomain = (value) =>
  String(value || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

const ASSET_DOMAIN = normalizeDomain(
  process.env.NEXT_PUBLIC_ASSET_DOMAIN || process.env.R2_PUBLIC_DOMAIN,
);
const LEGACY_CLOUDFRONT_DOMAIN = normalizeDomain(
  process.env.AWS_CLOUDFRONT_DOMAIN || 'digooy7d0nfl3.cloudfront.net',
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    APP_NAME: 'Inti',
    APP_DESCRIPTION: 'Plataforma de aprendizaje en línea',
    APP_URL: process.env.APP_URL || 'https://intihubs.com',
  },
  images: {
    domains: [
      'img.youtube.com',
      ...(ASSET_DOMAIN ? [ASSET_DOMAIN] : []),
      ...(LEGACY_CLOUDFRONT_DOMAIN ? [LEGACY_CLOUDFRONT_DOMAIN] : []),
    ],
  },
  async rewrites() {
    // Obtener la URL del backend desde la variable de entorno
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Solo aplicar rewrites en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log('Using API URL for rewrites:', apiUrl);
      const imageProxyTarget = ASSET_DOMAIN || LEGACY_CLOUDFRONT_DOMAIN;
      return [
        // Proxy for CloudFront images in development to avoid CORS
        {
          source: '/images/:path*',
          destination: `https://${imageProxyTarget}/images/:path*`,
        },
        // Ruta específica para admin-stats/overview
        {
          source: '/api/admin-stats/overview',
          destination: `${apiUrl}/api/admin/stats/overview`,
        },
        // Rutas específicas para admin-stats
        {
          source: '/api/admin-stats/:path*',
          destination: `${apiUrl}/api/admin/stats/:path*`,
        },
        // Rutas específicas para admin-subscriptions
        {
          source: '/api/admin-subscriptions/:path*',
          destination: `${apiUrl}/api/admin/subscriptions/:path*`,
        },
        // Rutas de API estándar (debe ir después de rutas específicas)
        // Exclude auth routes from proxying to backend
        {
          source: '/api/courses/:path*',
          destination: `${apiUrl}/api/courses/:path*`,
        },
        {
          source: '/api/playlists/:path*',
          destination: `${apiUrl}/api/playlists/:path*`,
        },
        {
          source: '/api/playlists',
          destination: `${apiUrl}/api/playlists`,
        },
        {
          source: '/api/classes/:path*',
          destination: `${apiUrl}/api/classes/:path*`,
        },
        {
          source: '/api/usage/:path*',
          destination: `${apiUrl}/api/usage/:path*`,
        },
        // Otras rutas directas
        {
          source: '/direct-api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ];
    }
    // No aplicar rewrites en producción
    return [];
  },
  webpack: (config, { isServer }) => {
    // Monorepo: resolve react from root node_modules (workspace hoists deps)
    const rootNodeModules = path.resolve(__dirname, '../../node_modules');
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.join(rootNodeModules, 'react'),
      'react-dom': path.join(rootNodeModules, 'react-dom'),
    };
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig 
