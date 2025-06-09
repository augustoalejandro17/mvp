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
        overflow-x: hidden;
      }
      
      .page-content {
        padding: 16px;
        max-width: 1200px;
        margin: 0 auto;
        min-height: calc(100vh - 120px);
      }
      
      @media (max-width: 768px) {
        body {
          padding-top: 70px;
        }
        
        .page-content {
          padding: 12px;
        }
      }
      
      /* Debugging styles for dropdown */
      .styles_dropdownContent__* {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
    
    // Debug the dropdown menu visibility
    const checkDropdownItems = () => {
      
      const dropdownContent = document.querySelector('.dropdown-content');
      
      
      if (dropdownContent) {
        const items = dropdownContent.querySelectorAll('a, button');
        
        
        
        Array.from(items).forEach((item, index) => {
          
        });
      }
    };
    
    // Run the check after a short delay to let everything render
    const timer = setTimeout(() => {
      checkDropdownItems();
    }, 2000);
    
    return () => {
      // Clean up
      document.head.removeChild(style);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Inti</title>
        <meta name="description" content="Conecta. Aprende. Crece." />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
      </Head>
      
      <Navigation />
      
      <div className="page-content">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default MyApp; 