import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    const { id } = req.query;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (req.method === 'PUT') {
      // Update extra resources for school
      const { extraSeats, extraStorageGB, extraStreamingHours } = req.body;
      
      const response = await fetch(`${apiUrl}/api/admin/academies/${id}/addons`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ extraSeats, extraStorageGB, extraStreamingHours })
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en el endpoint de addons de escuela:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 