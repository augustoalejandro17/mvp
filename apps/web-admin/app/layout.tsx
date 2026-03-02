import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BRAND } from '@/lib/copy';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.slogan}`,
  description: 'CRM educativo + plataforma de clases híbridas para academias y profesores. Gestión de alumnos, video seguro, asistencia, analítica y gamificación en un solo lugar.',
  keywords: ['CRM educativo', 'marketplace de servicios', 'clases híbridas', 'gestión académica', 'video educativo', 'gamificación'],
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
    description: 'CRM educativo + plataforma de clases híbridas para academias y profesores. Gestión de alumnos, video seguro, asistencia, analítica y gamificación en un solo lugar.',
    url: BRAND.url,
    siteName: BRAND.name,
    images: [
      {
        url: '/landing/og-image.jpg',
        width: 1200,
        height: 630,
        alt: `${BRAND.name} - CRM educativo + clases híbridas`,
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.slogan}`,
    description: 'CRM educativo + plataforma de clases híbridas para academias y profesores.',
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
    <html lang="es" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: BRAND.name,
              url: BRAND.url,
              logo: `${BRAND.url}/landing/logo.png`,
              description: 'CRM educativo + plataforma de clases híbridas para academias y profesores.',
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
              description: 'CRM educativo + plataforma de clases híbridas para academias y profesores.',
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
      <body className={`${inter.className} antialiased bg-white text-gray-900`}>
        {children}
      </body>
    </html>
  );
}


