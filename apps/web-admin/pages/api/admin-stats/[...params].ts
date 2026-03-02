import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    const { params } = req.query;
    if (!params || !Array.isArray(params)) {
      return res.status(400).json({ error: 'Parámetros de ruta inválidos' });
    }

    let url = `${process.env.NEXT_PUBLIC_API_URL}/admin/stats`;
    for (const param of params) {
      url += `/${param}`;
    }

    const queryParams = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'params' && value) {
        queryParams.append(key, value.toString());
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url, {
      method: req.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...(req.method !== 'GET' && req.body ? { body: JSON.stringify(req.body) } : {})
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error en el endpoint dinámico de estadísticas:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 