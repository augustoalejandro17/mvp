/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    APP_NAME: 'Inti',
    APP_DESCRIPTION: 'Plataforma de aprendizaje en línea',
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
  },
  images: {
    domains: ['img.youtube.com'],
  },
  async rewrites() {
    // Obtener la URL del backend desde la variable de entorno
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // Solo aplicar rewrites en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log('Using API URL for rewrites:', apiUrl);
      return [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/api/:path*`,
        },
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