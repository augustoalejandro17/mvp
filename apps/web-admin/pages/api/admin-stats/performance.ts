import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { verifyToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar el token de autenticaciu00f3n
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Verificar que el usuario tenga permisos de administrador
    const user = await verifyToken(token);
    if (!user || !['ADMIN', 'SCHOOL_OWNER', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Hacer la solicitud al backend
    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/performance`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error al obtener estadisticas de desempeu00f1o:', error);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Error al obtener estadisticas de desempeu00f1o' 
    });
  }
} 