import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Enrollment } from '../../courses/schemas/enrollment.schema';
import { RevenueDto, DateRangeDto } from '../dto/statistics.dto';

@Injectable()
export class RevenueService {
  constructor(
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
  ) {}

  /**
   * Calcula métricas de ingresos en un rango de fechas
   * @param dateRange Rango de fechas para la consulta
   * @returns Datos de ingresos en el período
   */
  async getRevenueMetrics(dateRange: DateRangeDto): Promise<RevenueDto> {
    const { startDate, endDate } = dateRange;
    
    // Asegurarnos de que las fechas son objetos Date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Consulta agregada para obtener pagos por fecha
    const paymentsByDate = await this.enrollmentModel.aggregate([
      // Desenrollar el historial de pagos para poder filtrar por fecha
      { $unwind: '$paymentHistory' },
      // Filtrar por el rango de fechas
      {
        $match: {
          'paymentHistory.date': { $gte: start, $lte: end }
        }
      },
      // Agrupar por fecha y sumar los montos
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$paymentHistory.date' } 
          },
          dailyAmount: { $sum: '$paymentHistory.amount' }
        }
      },
      // Ordenar por fecha
      { $sort: { _id: 1 } }
    ]).exec();
    
    // Formatear los resultados para la respuesta
    const byDate = paymentsByDate.map(item => ({
      date: item._id,
      amount: item.dailyAmount
    }));
    
    // Calcular total de ingresos
    const totalRevenue = byDate.reduce((sum, item) => sum + item.amount, 0);
    
    // Calcular promedio diario
    const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
    const avgDailyRevenue = Math.round(totalRevenue / daysDiff);
    
    // Calcular proyección para el próximo mes (30 días)
    const nextMonthProjection = avgDailyRevenue * 30;
    
    return {
      byDate,
      totalRevenue,
      avgDailyRevenue,
      nextMonthProjection
    };
  }

  /**
   * Obtiene los ingresos por curso
   * @param dateRange Rango de fechas opcional
   * @returns Ingresos agrupados por curso
   */
  async getRevenueByCourse(dateRange?: DateRangeDto) {
    const matchStage: any = {};
    
    if (dateRange) {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      matchStage['paymentHistory.date'] = { $gte: start, $lte: end };
    }
    
    const revenueByCourse = await this.enrollmentModel.aggregate([
      // Desenrollar el historial de pagos
      { $unwind: '$paymentHistory' },
      // Aplicar filtro de fechas si existe
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      // Buscar los datos del curso
      {
        $lookup: {
          from: 'courses',
          localField: 'course',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      { $unwind: '$courseInfo' },
      // Agrupar por curso y sumar los montos
      {
        $group: {
          _id: '$course',
          courseName: { $first: '$courseInfo.title' },
          totalAmount: { $sum: '$paymentHistory.amount' },
          paymentsCount: { $sum: 1 }
        }
      },
      // Ordenar por el monto total (descendente)
      { $sort: { totalAmount: -1 } }
    ]).exec();
    
    return revenueByCourse;
  }

  /**
   * Obtiene los ingresos mensuales para análisis de tendencias
   * @param year Año para el análisis (default: año actual)
   * @returns Ingresos mensuales del año especificado
   */
  async getMonthlyRevenue(year: number = new Date().getFullYear()) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
    
    const monthlyRevenue = await this.enrollmentModel.aggregate([
      // Desenrollar el historial de pagos
      { $unwind: '$paymentHistory' },
      // Filtrar por el año
      {
        $match: {
          'paymentHistory.date': { $gte: startOfYear, $lte: endOfYear }
        }
      },
      // Agrupar por mes y sumar los montos
      {
        $group: {
          _id: { 
            month: { $month: '$paymentHistory.date' } 
          },
          monthlyAmount: { $sum: '$paymentHistory.amount' }
        }
      },
      // Ordenar por mes
      { $sort: { '_id.month': 1 } }
    ]).exec();
    
    // Asegurar que tenemos todos los meses (incluso con 0)
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const result = months.map(month => {
      const found = monthlyRevenue.find(item => item._id.month === month);
      return {
        month,
        amount: found ? found.monthlyAmount : 0
      };
    });
    
    return result;
  }
} 