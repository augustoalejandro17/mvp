import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Debug() {
  const [backendResponse, setBackendResponse] = useState<string>('Testing...');
  const [error, setError] = useState<string | null>(null);
  const [fullApiUrl, setFullApiUrl] = useState<string>('');

  useEffect(() => {
    // Calcular la URL completa de la API como lo hace api-client.ts
    let apiBaseUrl = '/api';
    if (process.env.NEXT_PUBLIC_API_URL) {
      apiBaseUrl = process.env.NEXT_PUBLIC_API_URL.endsWith('/api') 
        ? process.env.NEXT_PUBLIC_API_URL 
        : `${process.env.NEXT_PUBLIC_API_URL}/api`;
    }
    setFullApiUrl(apiBaseUrl);

    const testBackendConnection = async () => {
      try {
        // Usar la URL calculada
        const healthUrl = `${apiBaseUrl}/health`;
        setBackendResponse(`Trying to connect to: ${healthUrl}`);
        const response = await axios.get(healthUrl);
        setBackendResponse(JSON.stringify(response.data, null, 2));
      } catch (err) {
        console.error('Error connecting to backend:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    testBackendConnection();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Information</h1>
      
      <h2>Environment Variables</h2>
      <ul>
        <li><strong>NEXT_PUBLIC_API_URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'not set'}</li>
        <li><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</li>
        <li><strong>Calculated API URL:</strong> {fullApiUrl}</li>
      </ul>
      
      <h2>Backend Connection Test</h2>
      {error ? (
        <div style={{ color: 'red' }}>
          <p>Error connecting to backend:</p>
          <pre>{error}</pre>
        </div>
      ) : (
        <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '4px' }}>
          {backendResponse}
        </pre>
      )}
      
      <h2>Config Check</h2>
      <p>Verifying if application is properly configured:</p>
      <ul>
        <li>
          <strong>API URL configured: </strong> 
          {process.env.NEXT_PUBLIC_API_URL ? '✅ Yes' : '❌ No - Using default /api'}
        </li>
      </ul>
    </div>
  );
} 