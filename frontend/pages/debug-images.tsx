import { useState, useEffect } from 'react';
import axios from 'axios';
import ImageFallback from '../components/ImageFallback';

export default function DebugImages() {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [cloudFrontInfo, setCloudFrontInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string>('');
  const [extractedKey, setExtractedKey] = useState<string>('');
  const [refreshedUrl, setRefreshedUrl] = useState<string>('');

  useEffect(() => {
    // Calcular baseURL para la API como en api-client.ts
    let baseUrl = '/api';
    if (process.env.NEXT_PUBLIC_API_URL) {
      baseUrl = process.env.NEXT_PUBLIC_API_URL.endsWith('/api') 
        ? process.env.NEXT_PUBLIC_API_URL 
        : `${process.env.NEXT_PUBLIC_API_URL}/api`;
    }
    setApiBaseUrl(baseUrl);

    // Verificar health endpoint
    const fetchHealth = async () => {
      try {
        const response = await axios.get(`${baseUrl}/health`);
        setHealthInfo(response.data);
      } catch (err) {
        console.error('Error fetching health info:', err);
        setError(`Error al obtener información de salud: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    // Verificar la información de CloudFront
    const fetchCloudFrontInfo = async () => {
      try {
        const response = await axios.get(`${baseUrl}/debug/cloudfront`);
        setCloudFrontInfo(response.data);
      } catch (err) {
        console.error('Error fetching CloudFront info:', err);
      }
    };

    fetchHealth();
    fetchCloudFrontInfo();
  }, []);

  // Función para extraer clave S3 de una URL
  const extractS3Key = (url: string): string | null => {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Para URLs de CloudFront o S3
      if (pathname.includes('/images/')) {
        const pathParts = pathname.split('/images/');
        if (pathParts.length > 1) {
          return `images/${pathParts[1].split('?')[0]}`;
        }
      }
      
      // Para URLs de videos
      if (pathname.includes('/videos/')) {
        const pathParts = pathname.split('/videos/');
        if (pathParts.length > 1) {
          return `videos/${pathParts[1].split('?')[0]}`;
        }
      }
      
      // Si no encontramos un patrón conocido, retornar la ruta completa sin query params
      return pathname.startsWith('/') ? pathname.substring(1).split('?')[0] : pathname.split('?')[0];
    } catch (e) {
      console.error('Error extracting S3 key:', e);
      return null;
    }
  };

  // Función para refrescar una URL
  const refreshUrl = async (key: string) => {
    if (!key) return;
    
    try {
      const response = await axios.get(`${apiBaseUrl}/images/refresh-url`, {
        params: { key }
      });
      
      if (response.data && response.data.url) {
        setRefreshedUrl(response.data.url);
      }
    } catch (err) {
      console.error('Error refreshing URL:', err);
      setError(`Error al refrescar URL: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Diagnóstico de Imágenes y CloudFront</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Configuración</h2>
        <ul>
          <li><strong>NEXT_PUBLIC_API_URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'no configurado'}</li>
          <li><strong>API Base URL calculada:</strong> {apiBaseUrl}</li>
          <li><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</li>
        </ul>
      </div>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', border: '1px solid red' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
        <h2>Health Check</h2>
        {healthInfo ? (
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(healthInfo, null, 2)}
          </pre>
        ) : (
          <p>Cargando información de salud...</p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
        <h2>Información de CloudFront</h2>
        {cloudFrontInfo ? (
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(cloudFrontInfo, null, 2)}
          </pre>
        ) : (
          <p>Cargando información de CloudFront...</p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
        <h2>Probar Extracción de Clave</h2>
        <div style={{ marginBottom: '10px' }}>
          <input 
            type="text" 
            value={testUrl} 
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Pega una URL para extraer la clave S3" 
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <button 
            onClick={() => setExtractedKey(extractS3Key(testUrl) || 'No se pudo extraer')}
            style={{ padding: '8px 16px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Extraer Clave
          </button>
        </div>
        {extractedKey && (
          <div>
            <p><strong>Clave extraída:</strong> {extractedKey}</p>
            <button 
              onClick={() => refreshUrl(extractedKey)}
              style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
            >
              Refrescar URL
            </button>
          </div>
        )}
        {refreshedUrl && (
          <div style={{ marginTop: '15px' }}>
            <h3>URL Refrescada</h3>
            <p style={{ wordBreak: 'break-all' }}>{refreshedUrl}</p>
            <div style={{ marginTop: '10px' }}>
              <h4>Previsualización:</h4>
              <div style={{ border: '1px dashed #ccc', padding: '10px', textAlign: 'center' }}>
                <ImageFallback 
                  src={refreshedUrl} 
                  alt="Previsualización" 
                  className="debug-preview-image" 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 