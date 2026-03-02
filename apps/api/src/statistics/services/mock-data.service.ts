import { Injectable } from '@nestjs/common';

@Injectable()
export class MockDataService {
  /**
   * Genera un conjunto de datos falsos para usar en desarrollo
   */
  generateMockRetentionData() {
    return [
      {
        courseId: '1',
        courseName: 'Programación Java',
        initialEnrollment: 45,
        currentEnrollment: 35,
        retentionRate: 78,
        completedCount: 32,
        completionRate: 71,
      },
      {
        courseId: '2',
        courseName: 'Marketing Digital',
        initialEnrollment: 60,
        currentEnrollment: 52,
        retentionRate: 87,
        completedCount: 50,
        completionRate: 83,
      },
      {
        courseId: '3',
        courseName: 'Diseño UX/UI',
        initialEnrollment: 30,
        currentEnrollment: 25,
        retentionRate: 83,
        completedCount: 24,
        completionRate: 80,
      },
      {
        courseId: '4',
        courseName: 'Desarrollo Web',
        initialEnrollment: 50,
        currentEnrollment: 38,
        retentionRate: 76,
        completedCount: 35,
        completionRate: 70,
      },
      {
        courseId: '5',
        courseName: 'Data Science',
        initialEnrollment: 25,
        currentEnrollment: 18,
        retentionRate: 72,
        completedCount: 17,
        completionRate: 68,
      },
    ];
  }

  generateMockPerformanceData() {
    return [
      {
        teacherId: '1',
        teacherName: 'Juan Pérez',
        avgRetentionRate: 87,
        avgAttendanceRate: 92,
        coursesCount: 3,
        studentsCount: 75,
        satisfaction: 95,
        monthlyTrend: this.generateMonthlyTrend(85, 95, 90, 95),
      },
      {
        teacherId: '2',
        teacherName: 'María González',
        avgRetentionRate: 82,
        avgAttendanceRate: 85,
        coursesCount: 2,
        studentsCount: 45,
        satisfaction: 88,
        monthlyTrend: this.generateMonthlyTrend(80, 85, 82, 88),
      },
      {
        teacherId: '3',
        teacherName: 'Carlos Rodríguez',
        avgRetentionRate: 78,
        avgAttendanceRate: 83,
        coursesCount: 4,
        studentsCount: 120,
        satisfaction: 82,
        monthlyTrend: this.generateMonthlyTrend(75, 80, 80, 85),
      },
      {
        teacherId: '4',
        teacherName: 'Ana Martínez',
        avgRetentionRate: 91,
        avgAttendanceRate: 94,
        coursesCount: 2,
        studentsCount: 50,
        satisfaction: 97,
        monthlyTrend: this.generateMonthlyTrend(90, 93, 92, 95),
      },
      {
        teacherId: '5',
        teacherName: 'Luis Sánchez',
        avgRetentionRate: 79,
        avgAttendanceRate: 80,
        coursesCount: 3,
        studentsCount: 65,
        satisfaction: 84,
        monthlyTrend: this.generateMonthlyTrend(75, 80, 82, 80),
      },
    ];
  }

  generateMockRevenueData() {
    const today = new Date();
    const revenueByDate = [];

    // Generar ingresos diarios para los últimos 30 días
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      revenueByDate.push({
        date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 5000) + 3000,
      });
    }

    // Datos mensuales para un año
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const currentMonth = today.getMonth();
    const monthlyRevenue = [];

    for (let i = 0; i < 12; i++) {
      let monthIndex = (currentMonth - 11 + i) % 12;
      if (monthIndex < 0) monthIndex += 12;

      const revenue = Math.floor(Math.random() * 50000) + 80000;
      const projection =
        i > 9 ? Math.floor(revenue * (1 + Math.random() * 0.2 - 0.05)) : null;

      monthlyRevenue.push({
        month: months[monthIndex],
        revenue,
        projection,
      });
    }

    // Ingresos por curso
    const courseNames = [
      'Programación Java',
      'Marketing Digital',
      'Diseño UX/UI',
      'Desarrollo Web',
      'Data Science',
    ];
    const revenueByCourse = courseNames.map((name, idx) => ({
      courseId: (idx + 1).toString(),
      courseName: name,
      revenue: Math.floor(Math.random() * 30000) + 20000,
      studentsCount: Math.floor(Math.random() * 30) + 15,
      averageRevenuePerStudent: Math.floor(Math.random() * 500) + 800,
    }));

    return {
      byDate: revenueByDate,
      totalRevenue: revenueByDate.reduce((sum, item) => sum + item.amount, 0),
      avgDailyRevenue: Math.floor(
        revenueByDate.reduce((sum, item) => sum + item.amount, 0) /
          revenueByDate.length,
      ),
      nextMonthProjection: Math.floor(
        revenueByDate.reduce((sum, item) => sum + item.amount, 0) * 1.1,
      ),
      revenueByCourse,
      monthlyRevenue,
      projectionAccuracy: 92,
    };
  }

  generateMockDropoutData() {
    const dropoutRates = [
      {
        courseId: '1',
        courseName: 'Programación Java',
        dropoutRate: 22,
        dropoutCount: 10,
        enrollmentCount: 45,
        criticalPoints: [
          { timePoint: 7, dropoutCount: 3 },
          { timePoint: 14, dropoutCount: 5 },
          { timePoint: 21, dropoutCount: 2 },
        ],
      },
      {
        courseId: '2',
        courseName: 'Marketing Digital',
        dropoutRate: 13,
        dropoutCount: 8,
        enrollmentCount: 60,
        criticalPoints: [
          { timePoint: 5, dropoutCount: 2 },
          { timePoint: 12, dropoutCount: 4 },
          { timePoint: 19, dropoutCount: 2 },
        ],
      },
      {
        courseId: '3',
        courseName: 'Diseño UX/UI',
        dropoutRate: 17,
        dropoutCount: 5,
        enrollmentCount: 30,
        criticalPoints: [
          { timePoint: 3, dropoutCount: 1 },
          { timePoint: 10, dropoutCount: 3 },
          { timePoint: 15, dropoutCount: 1 },
        ],
      },
      {
        courseId: '4',
        courseName: 'Desarrollo Web',
        dropoutRate: 24,
        dropoutCount: 12,
        enrollmentCount: 50,
        criticalPoints: [
          { timePoint: 2, dropoutCount: 2 },
          { timePoint: 9, dropoutCount: 7 },
          { timePoint: 16, dropoutCount: 3 },
        ],
      },
      {
        courseId: '5',
        courseName: 'Data Science',
        dropoutRate: 28,
        dropoutCount: 7,
        enrollmentCount: 25,
        criticalPoints: [
          { timePoint: 4, dropoutCount: 2 },
          { timePoint: 11, dropoutCount: 4 },
          { timePoint: 18, dropoutCount: 1 },
        ],
      },
    ];

    const dropoutReasons = [
      { reason: 'Problemas económicos', count: 15, percentage: 35 },
      { reason: 'Falta de tiempo', count: 12, percentage: 28 },
      { reason: 'Insatisfacción con el curso', count: 8, percentage: 19 },
      { reason: 'Cambio de intereses', count: 5, percentage: 12 },
      { reason: 'Problemas de salud', count: 2, percentage: 6 },
    ];

    const periods = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const dropoutTrend = periods.map((period) => ({
      period,
      rate: Math.floor(Math.random() * 10) + 15,
    }));

    const courseNames = [
      'Programación Java',
      'Marketing Digital',
      'Diseño UX/UI',
      'Desarrollo Web',
      'Data Science',
    ];
    const courseComparisonData = courseNames.map((course, index) => ({
      course,
      initialRate:
        dropoutRates[index].dropoutRate + Math.floor(Math.random() * 8),
      currentRate: dropoutRates[index].dropoutRate,
    }));

    return {
      dropoutRates,
      overallDropoutRate: 19,
      dropoutReasons,
      dropoutTrend,
      courseComparisonData,
    };
  }

  generateMockDemographicsData() {
    // Distribución por edades general
    const ageDistribution = {
      under18: 25,
      age18to25: 120,
      age26to35: 85,
      over36: 40,
      unknown: 10,
    };

    // Distribución por edades por curso
    const courseNames = [
      'Programación Java',
      'Marketing Digital',
      'Diseño UX/UI',
      'Desarrollo Web',
      'Data Science',
    ];
    const ageDistributionByCourse = courseNames.map((name, idx) => {
      const totalStudents = Math.floor(Math.random() * 30) + 25;
      const under18 = Math.floor(totalStudents * (Math.random() * 0.2));
      const age18to25 = Math.floor(totalStudents * (0.3 + Math.random() * 0.2));
      const age26to35 = Math.floor(totalStudents * (0.2 + Math.random() * 0.2));
      const over36 = Math.floor(totalStudents * (Math.random() * 0.3));
      const unknown = totalStudents - under18 - age18to25 - age26to35 - over36;

      return {
        courseId: (idx + 1).toString(),
        courseName: name,
        under18,
        age18to25,
        age26to35,
        over36,
        unknown: unknown >= 0 ? unknown : 0,
        totalStudents,
      };
    });

    return {
      ageDistribution,
      ageDistributionByCourse,
      dominantAgeGroup: '18-25',
      averageAge: 28,
    };
  }

  // Utility para generar tendencias mensuales
  private generateMonthlyTrend(
    minRetention,
    maxRetention,
    minAttendance,
    maxAttendance,
  ) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    return months.map((month) => ({
      month,
      retention:
        Math.floor(Math.random() * (maxRetention - minRetention + 1)) +
        minRetention,
      attendance:
        Math.floor(Math.random() * (maxAttendance - minAttendance + 1)) +
        minAttendance,
    }));
  }
}
