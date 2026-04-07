import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import '../styles/design-system.css';
import '../styles/globals.css';
import Navigation from '../components/Navigation';
import { ToastProvider } from '../components/ui/Toast';
// Import auth utility to initialize global axios interceptor
import '../utils/auth';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <ToastProvider>
        <Head>
          <title>Inti</title>
          <meta name="description" content="Plataforma mobile-first para profesores y alumnos. Cursos, clases, contenido y seguimiento desde un solo lugar." />
          <link rel="icon" href="/favicon.ico" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
          {/* Preconnect to improve performance */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* Load Inter font */}
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        </Head>
        
        <Navigation />
        
        <div className="page-content">
          <Component {...pageProps} />
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}

export default MyApp; 
