import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = (req.headers as any)?.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'School ID is required' });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    if ((req as any).method === 'PUT') {
      const { planId } = (req as any).body;
      
      const response = await fetch(`${apiUrl}/api/admin/academies/${id}/plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else if ((req as any).method === 'GET') {
      const response = await fetch(`${apiUrl}/api/admin/academies/${id}/plan`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en el endpoint de plan de escuela:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 