import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../../styles/Login.module.css';

const errorMessages = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You cancelled the login or do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication. Please try again.',
};

export default function AuthError() {
  const router = useRouter();
  const [error, setError] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const { error: errorCode, data } = router.query;
    
    // Debug logging
    console.log('Error page - Full query:', router.query);
    console.log('Error page - Error code:', errorCode);
    console.log('Error page - Data:', data);
    
    if (errorCode && typeof errorCode === 'string') {
      // Check for account linking error
      if (errorCode.startsWith('AccountLinking:')) {
        console.log('Detected AccountLinking error, redirecting...');
        const linkingData = errorCode.replace('AccountLinking:', '');
        // Redirect to account linking page
        router.push(`/auth/link-account?data=${encodeURIComponent(linkingData)}`);
        return;
      } else if (errorCode.startsWith('ACCOUNT_LINKING_REQUIRED:')) {
        console.log('Detected ACCOUNT_LINKING_REQUIRED error, redirecting...');
        const linkingData = errorCode.replace('ACCOUNT_LINKING_REQUIRED:', '');
        // Redirect to account linking page
        router.push(`/auth/link-account?data=${encodeURIComponent(linkingData)}`);
        return;
      } else if (errorCode === 'ACCOUNT_LINKING_REQUIRED' && data) {
        console.log('Detected ACCOUNT_LINKING_REQUIRED with data, redirecting...');
        // Alternative: Check if linking data is in separate parameter
        router.push(`/auth/link-account?data=${encodeURIComponent(data as string)}`);
        return;
      }
      
      console.log('No account linking detected, showing error:', errorCode);
      setError(errorCode);
      setErrorMessage(
        errorMessages[errorCode as keyof typeof errorMessages] || 
        errorMessages.Default
      );
    } else {
      console.log('No error code found, showing default error');
      setErrorMessage(errorMessages.Default);
    }
  }, [router.query, router]);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Error de Autenticación</h1>
        
        <div className={styles.form}>
          <div className={styles.error}>
            <h3>¡Oops! Algo salió mal</h3>
            <p>{errorMessage}</p>
            {error && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', color: '#666' }}>
                  Detalles técnicos
                </summary>
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                  Error: {error}
                </p>
              </details>
            )}
          </div>
          
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link href="/login">
              <button 
                className={styles.button}
                style={{
                  width: 'auto',
                  padding: '0.75rem 2rem',
                  backgroundColor: '#3182ce',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginRight: '1rem'
                }}
              >
                Volver al Login
              </button>
            </Link>
            
            {/* Debug/Test link for account linking */}
            <Link href={`/auth/link-account?data=${encodeURIComponent(Buffer.from(JSON.stringify({
              email: 'augustoalejandro95@gmail.com',
              idToken: 'test-token',
              provider: 'google'
            })).toString('base64'))}`}>
              <button 
                className={styles.button}
                style={{
                  width: 'auto',
                  padding: '0.75rem 2rem',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Test Account Linking
              </button>
            </Link>
          </div>
        </div>
        
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <h3>¿Necesitas ayuda?</h3>
          <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.8' }}>
            <li>• Verifica que hayas autorizado la aplicación en Google</li>
            <li>• Asegúrate de usar una cuenta de Google válida</li>
            <li>• Intenta limpiar las cookies del navegador</li>
            <li>• Si el problema persiste, contacta al soporte</li>
          </ul>
        </div>
        
        <p className={styles.registerLink}>
          <Link href="/">Volver al inicio</Link>
        </p>
      </main>
    </div>
  );
} 