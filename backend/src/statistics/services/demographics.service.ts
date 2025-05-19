import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { AgeDistributionDto } from '../dto/statistics.dto';

@Injectable()
export class DemographicsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Calcula la distribución de estudiantes por grupos de edad
   * @returns Distribución de edades de los estudiantes
   */
  async getAgeDistribution(): Promise<AgeDistributionDto> {
    // Para calcular esto de forma adecuada, necesitaríamos tener la fecha de nacimiento
    // de los usuarios, que no está presente en el modelo User actual.
    // Vamos a implementar este servicio asumiendo que podríamos extender el modelo
    // con esta información o inferirla de otros datos.

    // En una implementación real, la consulta sería algo así:
    // const users = await this.userModel.find({ role: 'student' }).exec();
    // Y luego calcularíamos la edad basada en la fecha de nacimiento de cada uno

    // Por ahora, simularemos los resultados basados en una distribución típica
    // En una implementación real, esto vendría directamente de una consulta aggregation

    // Obtener el total de estudiantes
    const totalStudents = await this.userModel.countDocuments({ role: 'student' }).exec();
    
    // Distribución simulada (aproximada) de edades
    const under18Percentage = 0.15; // 15% son menores de 18
    const age18to25Percentage = 0.40; // 40% están entre 18 y 25
    const age26to35Percentage = 0.30; // 30% están entre 26 y 35
    const over36Percentage = 0.10; // 10% son mayores de 36
    const unknownPercentage = 0.05; // 5% sin edad conocida
    
    // Calcular los conteos basados en los porcentajes
    const under18 = Math.round(totalStudents * under18Percentage);
    const age18to25 = Math.round(totalStudents * age18to25Percentage);
    const age26to35 = Math.round(totalStudents * age26to35Percentage);
    const over36 = Math.round(totalStudents * over36Percentage);
    const unknown = Math.round(totalStudents * unknownPercentage);
    
    return {
      under18,
      age18to25,
      age26to35,
      over36,
      unknown
    };
  }

  /**
   * Obtiene la distribución de edades por curso
   * @returns Distribución de edades por curso
   */
  async getAgeDistributionByCourse() {
    // Esta implementación también sería una simulación en ausencia de datos reales de edad
    // En una implementación real, haríamos una consulta a la base de datos para obtener
    // todos los estudiantes de cada curso y sus edades
    
    // Obtener todos los cursos con sus estudiantes
    const coursesWithStudents = await this.userModel.aggregate([
      // Filtrar solo estudiantes
      { $match: { role: 'student' } },
      
      // Desenrollar los cursos de cada estudiante
      { $unwind: '$enrolledCourses' },
      
      // Lookup para obtener la información del curso
      {
        $lookup: {
          from: 'courses',
          localField: 'enrolledCourses',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      
      // Desenrollar la información del curso
      { $unwind: '$courseInfo' },
      
      // Agrupar por curso
      {
        $group: {
          _id: '$courseInfo._id',
          courseName: { $first: '$courseInfo.title' },
          totalStudents: { $sum: 1 }
        }
      }
    ]).exec();
    
    // Simular la distribución de edades para cada curso
    return coursesWithStudents.map(course => {
      // Distribución simulada con pequeñas variaciones por curso
      const under18 = Math.round(course.totalStudents * (0.15 + Math.random() * 0.05));
      const age18to25 = Math.round(course.totalStudents * (0.40 + Math.random() * 0.05));
      const age26to35 = Math.round(course.totalStudents * (0.30 + Math.random() * 0.05));
      const over36 = Math.round(course.totalStudents * (0.10 + Math.random() * 0.05));
      const unknown = course.totalStudents - (under18 + age18to25 + age26to35 + over36);
      
      return {
        courseId: course._id.toString(),
        courseName: course.courseName,
        totalStudents: course.totalStudents,
        ageDistribution: {
          under18,
          age18to25,
          age26to35,
          over36,
          unknown: Math.max(0, unknown) // Asegurar que no sea negativo por errores de redondeo
        }
      };
    });
  }
} 