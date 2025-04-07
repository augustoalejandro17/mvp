import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import Navigation from '../components/Navigation';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Plataforma de Danza</title>
        <meta name="description" content="Plataforma de cursos para bailarines" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navigation />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 