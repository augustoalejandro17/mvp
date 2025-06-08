import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    const { status } = req.query;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let url = `${apiUrl}/api/admin/subscriptions/list`;
    if (status && status !== 'all') {
      url += `?status=${status}`;
    }

    console.log(`Intentando conectar a: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Respuesta del backend: código ${response.status}`);
    
    const data = await response.json();
    console.log('Datos recibidos:', JSON.stringify(data).substring(0, 200) + '...');
    
    if (!response.ok) {
      console.error('Error en la respuesta del backend:', data);
      return res.status(response.status).json({
        error: `Error del backend: ${response.status} ${response.statusText}`,
        backendMessage: data.message || 'Sin mensaje del backend',
        backendError: data.error || 'Sin detalles adicionales',
        subscriptions: [],
        totalCount: 0
      });
    }
    
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error en el endpoint de lista de suscripciones:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido',
      subscriptions: [],
      totalCount: 0
    });
  }
} 