import type { Metadata } from 'next';
import { BRAND } from '@/lib/copy';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.slogan}`,
  description: 'Plataforma mobile-first para profesores y alumnos. Crea cursos, organiza contenido, recibe entregas y acompaña el aprendizaje desde un solo lugar.',
  keywords: ['plataforma educativa', 'cursos online', 'app para profesores', 'contenido educativo', 'aprendizaje móvil', 'gestión de cursos'],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(BRAND.url),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${BRAND.name} — ${BRAND.slogan}`,
    description: 'Plataforma mobile-first para profesores y alumnos. Crea cursos, organiza contenido, recibe entregas y acompaña el aprendizaje desde un solo lugar.',
    url: BRAND.url,
    siteName: BRAND.name,
    images: [
      {
        url: '/landing/og-image.jpg',
        width: 1200,
        height: 630,
        alt: `${BRAND.name} - Plataforma educativa mobile-first`,
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.slogan}`,
    description: 'Plataforma mobile-first para profesores y alumnos.',
    images: ['/landing/og-image.jpg'],
    creator: '@intihubs',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: BRAND.name,
              url: BRAND.url,
              logo: `${BRAND.url}/landing/logo.png`,
              description: 'Plataforma mobile-first para profesores y alumnos.',
              contactPoint: {
                '@type': 'ContactPoint',
                email: BRAND.email,
                contactType: 'customer service',
                availableLanguage: 'Spanish',
              },
              sameAs: [
                'https://twitter.com/intihubs',
                'https://linkedin.com/company/intihubs',
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: BRAND.name,
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Web',
              description: 'Plataforma mobile-first para profesores y alumnos.',
              offers: {
                '@type': 'Offer',
                price: '49',
                priceCurrency: 'USD',
                priceValidUntil: '2024-12-31',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                reviewCount: '127',
              },
            }),
          }}
        />
      </head>
      <body className="antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
