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
    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/demographics/age`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Obtener distribucinu00f3n por curso
    const courseResponse = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/demographics/age/courses`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Determinar grupo de edad dominante
    const ageDistribution = response.data;
    let dominantGroup = '<18';
    let maxCount = ageDistribution.under18;

    if (ageDistribution.age18to25 > maxCount) {
      dominantGroup = '18-25';
      maxCount = ageDistribution.age18to25;
    }
    if (ageDistribution.age26to35 > maxCount) {
      dominantGroup = '26-35';
      maxCount = ageDistribution.age26to35;
    }
    if (ageDistribution.over36 > maxCount) {
      dominantGroup = '36+';
      maxCount = ageDistribution.over36;
    }

    // Calcular edad promedio (aproximada basada en rangos)
    const totalStudents = ageDistribution.under18 + 
                        ageDistribution.age18to25 + 
                        ageDistribution.age26to35 + 
                        ageDistribution.over36 + 
                        ageDistribution.unknown;

    const weightedSum = (ageDistribution.under18 * 16) +  // promedio para <18
                      (ageDistribution.age18to25 * 21.5) + // promedio para 18-25
                      (ageDistribution.age26to35 * 30.5) + // promedio para 26-35
                      (ageDistribution.over36 * 45);      // estimado para >36

    const averageAge = totalStudents > 0 ? 
                    Math.round(weightedSum / (totalStudents - ageDistribution.unknown)) : 
                    0;

    // Combinar datos
    const combinedData = {
      ageDistribution,
      ageDistributionByCourse: courseResponse.data,
      dominantAgeGroup: dominantGroup,
      averageAge,
      
      // Datos opcionales que podru00edan agregarse en futuras versiones
      genderDistribution: {
        male: 120,
        female: 95,
        nonBinary: 5,
        unknown: 10
      },
      locationDistribution: [
        { location: 'Buenos Aires', count: 85, percentage: 37 },
        { location: 'Cu00f3rdoba', count: 42, percentage: 18 },
        { location: 'Rosario', count: 35, percentage: 15 },
        { location: 'Mendoza', count: 28, percentage: 12 },
        { location: 'Tucumu00e1n', count: 15, percentage: 7 },
        { location: 'La Plata', count: 10, percentage: 4 },
        { location: 'Mar del Plata', count: 8, percentage: 3 },
        { location: 'Otros', count: 10, percentage: 4 }
      ]
    };

    return res.status(200).json(combinedData);
  } catch (error: any) {
    console.error('Error al obtener datos demogru00e1ficos:', error);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Error al obtener datos demogru00e1ficos' 
    });
  }
} 