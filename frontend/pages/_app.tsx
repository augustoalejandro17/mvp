import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import Navigation from '../components/Navigation';
import navStyles from '../styles/Navigation.module.css';

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Add styles for the page content
    const style = document.createElement('style');
    style.innerHTML = `
      body {
        padding-top: 80px;
        margin: 0;
      }
      
      .page-content {
        padding: 16px;
        max-width: 1200px;
        margin: 0 auto;
      }
      
      @media (max-width: 768px) {
        body {
          padding-top: 70px;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      // Clean up
      document.head.removeChild(style);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Inti</title>
        <meta name="description" content="Plataforma educativa Inti" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <Navigation />
      
      <div className="page-content">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default MyApp; 