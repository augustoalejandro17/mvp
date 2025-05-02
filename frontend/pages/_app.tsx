import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import Navigation from '../components/Navigation';
import navStyles from '../styles/Navigation.module.css';

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Añadir la clase de padding al body
    document.body.classList.add(navStyles.bodyPadding);
    
    return () => {
      // Limpiar al desmontar
      document.body.classList.remove(navStyles.bodyPadding);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Inti</title>
        <meta name="description" content="Plataforma educativa Inti" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navigation />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 