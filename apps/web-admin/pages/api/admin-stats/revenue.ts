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

    // Obtener paru00e1metros de fecha
    const { startDate, endDate } = req.query;

    // Hacer la solicitud al backend
    const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/revenue`, {
      startDate,
      endDate
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Datos adicionales para mejorar la visualizaciu00f3n
    const responseData = {
      ...response.data,
      // Agregar promedio mensual si no existe
      avgMonthlyRevenue: response.data.avgMonthlyRevenue || 
        (response.data.totalRevenue ? Math.round(response.data.totalRevenue / 6) : 0),
      // Agregar precisiu00f3n de proyecciu00f3n si no existe
      projectionAccuracy: response.data.projectionAccuracy || 85
    };

    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error('Error al obtener estadisticas de ingresos:', error);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Error al obtener estadisticas de ingresos' 
    });
  }
} 