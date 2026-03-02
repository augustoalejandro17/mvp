import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir método PATCH
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar el token y el rol de super_admin
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    // La función verifyToken es asíncrona
    const userInfo = await verifyToken(token);
    
    if (!userInfo || (!Array.isArray(userInfo.role) && userInfo.role !== 'super_admin') || 
        (Array.isArray(userInfo.role) && !userInfo.role.includes('super_admin'))) {
      return res.status(403).json({ error: 'Prohibido: No tienes permisos para acceder a este recurso' });
    }

    // Obtener el ID de la suscripción
    const { subscriptionId } = req.query;
    
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return res.status(400).json({ error: 'ID de suscripción inválido' });
    }
    
    // Construir la URL para la solicitud al backend
    const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/subscriptions/${subscriptionId}/add-extra-resources`;

    // Realizar la solicitud al backend
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: `Error ${response.status}: ${response.statusText}` };
      }
      
      return res.status(response.status).json({
        error: errorData.message || 'Error al procesar la solicitud',
        message: errorData.message || `Error ${response.status}: ${response.statusText}`
      });
    }

    // Devolver los resultados
    try {
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Error al actualizar recursos adicionales:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 