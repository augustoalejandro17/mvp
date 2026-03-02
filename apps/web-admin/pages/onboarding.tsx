import React from 'react';
import Head from 'next/head';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';

const OnboardingPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Configuración de cuenta - Inti</title>
        <meta name="description" content="Configura tu cuenta de Inti y personaliza tu experiencia educativa" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <OnboardingFlow />
    </>
  );
};

export default OnboardingPage; 