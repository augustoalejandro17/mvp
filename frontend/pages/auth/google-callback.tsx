import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { refreshAuth } from '../../utils/auth';

export default function GoogleCallback() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') {
      // Still loading session
      return;
    }

    if (status === 'unauthenticated') {
      // Authentication failed, redirect to login
      router.push('/login?error=authentication_failed');
      return;
    }

    if (session && (session as any).backendToken) {
      // Successfully authenticated with backend token
      const backendToken = (session as any).backendToken;
      const backendUser = (session as any).backendUser;
      const isNewUser = (session as any).isNewUser;

      // Store JWT token in cookies (same way as form login)
      Cookies.set('token', backendToken, { expires: 7 });
      
      if (backendUser) {
        Cookies.set('user', JSON.stringify(backendUser), { expires: 7 });
      }

      // Trigger auth state update for Navigation component
      refreshAuth();

      // Redirect based on user status
      if (isNewUser || !backendUser?.hasOnboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
      
      return;
    }

    // If we have a session but no backend token, there might be an issue
    if (session && !(session as any).backendToken) {
      console.error('Google login succeeded but no backend token found');
      router.push('/login?error=token_missing');
      return;
    }

    // Fallback: redirect to login if something went wrong
    setTimeout(() => {
      router.push('/login?error=callback_timeout');
    }, 5000);

  }, [session, status, router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #3182ce',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <p style={{ 
        marginTop: '20px', 
        color: '#666',
        fontSize: '16px'
      }}>
        Completando inicio de sesión con Google...
      </p>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 