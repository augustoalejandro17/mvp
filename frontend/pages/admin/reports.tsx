import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../components/AdminNavigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub?: string;
  id?: string;
  email: string;
  name: string;
  role: string;
}

interface School {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  title: string;
  school: string;
}

interface CourseAttendanceData {
  courseId: string;
  courseName: string;
  totalClasses: number;
  totalStudents: number;
  attendancePercentage: number;
  presentCount: number;
  absentCount: number;
}

interface MonthlyAttendanceReport {
  school: {
    id: string;
    name: string;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
  summary: {
    totalCourses: number;
    totalClasses: number;
    totalStudents: number;
    overallAttendancePercentage: number;
  };
  courseDetails: CourseAttendanceData[];
}

export default function Reports() {
  const router = useRouter();
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [report, setReport] = useState<MonthlyAttendanceReport | null>(null);
  
  // Filter states
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  
  // UI states
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<'attendance' | 'performance' | 'enrollment'>('attendance');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const reportTypes = [
    { value: 'attendance', label: '📊 Reportes de Asistencia', description: 'Asistencia mensual por curso y escuela' },
    { value: 'performance', label: '📈 Reportes de Rendimiento', description: 'Calificaciones y progreso (Próximamente)' },
    { value: 'enrollment', label: '👥 Reportes de Matrícula', description: 'Inscripciones y demografía (Próximamente)' }
  ];

  // Authentication and initial setup
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/reports');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const userId = decoded.id || decoded.sub;
      
      if (!userId) {
        setError('Error al obtener información del usuario');
        return;
      }

      // Check if user has permission to view reports
      const role = decoded.role?.toLowerCase();
      if (!['super_admin', 'admin', 'school_owner', 'administrative'].includes(role)) {
        router.push('/');
        return;
      }

      setUser(decoded);
      loadInitialData(decoded);
    } catch (e: any) {
      console.error('Failed to decode token:', e);
      setError('Token inválido o expirado.');
      router.push('/login');
    }
  }, [router]);

  const loadInitialData = async (userToken: DecodedToken) => {
    try {
      setLoading(true);
      await loadUserSchools(userToken);
      // Note: courses will be loaded when a school is selected
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Error al cargar datos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSchools = async (userToken: DecodedToken) => {
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const userId = userToken.id || userToken.sub;
      const userRole = userToken.role?.toLowerCase();

      let schoolsData: School[] = [];

      if (userRole === 'super_admin') {
        const response = await axios.get(`${apiUrl}/api/schools`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        schoolsData = response.data.schools || response.data;
      } else if (userRole === 'school_owner') {
        const response = await axios.get(`${apiUrl}/api/users/${userId}/owned-schools`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        schoolsData = response.data || [];
      } else if (userRole === 'administrative') {
        const response = await axios.get(`${apiUrl}/api/users/${userId}/administered-schools`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        schoolsData = response.data || [];
      }

      console.log(`Loaded ${schoolsData.length} schools for ${userRole}:`, schoolsData.map(s => s.name));
      setSchools(schoolsData);
      
      // Auto-select first school if only one available (but not for super_admin to allow them to see the dropdown)
      if (schoolsData.length === 1 && userRole !== 'super_admin') {
        console.log(`Auto-selecting school for ${userRole}:`, schoolsData[0].name);
        setSelectedSchool(schoolsData[0]._id);
      }
    } catch (error) {
      console.error('Error loading schools:', error);
      throw error;
    }
  };

  const loadCourses = async (schoolId?: string) => {
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // If no schoolId provided, clear courses
      if (!schoolId) {
        setCourses([]);
        return;
      }
      
      const response = await axios.get(`${apiUrl}/api/courses?school=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const coursesData = response.data || [];
      console.log(`Loaded ${coursesData.length} courses for school ${schoolId}`);
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]); // Clear courses on error
    }
  };

  // Load courses when a school is selected
  useEffect(() => {
    if (selectedSchool) {
      console.log(`School selected: ${selectedSchool}, loading courses`);
      loadCourses(selectedSchool);
      // Reset course selection when school changes
      setSelectedCourse('');
    } else {
      setCourses([]);
      setSelectedCourse('');
    }
  }, [selectedSchool]);

  const loadReport = async () => {
    if (!selectedSchool) {
      setError('Por favor selecciona una escuela');
      return;
    }

    try {
      setLoadingReport(true);
      setError(null);
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const params = new URLSearchParams({
        schoolId: selectedSchool,
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      
      if (selectedCourse) {
        params.append('courseId', selectedCourse);
      }
      
      const response = await axios.get(`${apiUrl}/api/reports/attendance/monthly?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setReport(response.data);
    } catch (error: any) {
      console.error('Error loading report:', error);
      setError(error.response?.data?.message || 'Error al cargar el reporte');
    } finally {
      setLoadingReport(false);
    }
  };

  const exportReport = async (format: 'csv' | 'excel') => {
    if (!selectedSchool || !report) {
      setError('No hay reporte para exportar');
      return;
    }

    try {
      setExporting(true);
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const params = new URLSearchParams({
        schoolId: selectedSchool,
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
        format,
      });
      
      if (selectedCourse) {
        params.append('courseId', selectedCourse);
      }
      
      const response = await axios.get(`${apiUrl}/api/reports/attendance/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: format === 'excel' ? 'blob' : 'json'
      });
      
      // Handle different response types
      if (format === 'excel') {
        // For Excel files, the response is already a blob
        const blob = response.data;
        const contentDisposition = response.headers['content-disposition'];
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `asistencia_detallada_${selectedMonth}_${selectedYear}.xlsx`;
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // For CSV files, use the JSON response
        const blob = new Blob([response.data.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
    } catch (error: any) {
      console.error('Error exporting report:', error);
      setError(error.response?.data?.message || 'Error al exportar el reporte');
    } finally {
      setExporting(false);
    }
  };

  const getFilteredCourses = () => {
    if (!selectedSchool) {
      console.log('No school selected, returning empty courses');
      return [];
    }
    
    // Since courses are now loaded specifically for the selected school,
    // we can return them directly without additional filtering
    console.log(`Returning ${courses.length} courses for school ${selectedSchool}`);
    console.log('Available courses:', courses.map(c => ({ id: c._id, title: c.title, school: c.school })));
    
    return courses;
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 5; year--) {
      years.push(year);
    }
    return years;
  };

  if (loading) {
    return <div className={styles.loading}>Cargando reportes...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>📊 Reportes de Asistencia</h1>
        <p>Visualiza y descarga reportes mensuales de asistencia por escuela y curso.</p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole={user?.role} />

        <div className={styles.mainContent}>
          {/* Report Type Selection */}
          <div className={styles.reportTypeSection}>
            <h2>📋 Tipo de Reporte</h2>
            <div className={styles.reportTypeGrid}>
              {reportTypes.map((type) => (
                <div 
                  key={type.value}
                  className={`${styles.reportTypeCard} ${
                    selectedReportType === type.value ? styles.active : ''
                  } ${type.value !== 'attendance' ? styles.disabled : ''}`}
                  onClick={() => {
                    if (type.value === 'attendance') {
                      setSelectedReportType(type.value as any);
                    }
                  }}
                >
                  <h3>{type.label}</h3>
                  <p>{type.description}</p>
                  {type.value !== 'attendance' && (
                    <div className={styles.comingSoon}>Próximamente</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Filter Section - Only show for attendance reports */}
          {selectedReportType === 'attendance' && (
            <div className={styles.filterSection}>
              <h2>🔍 Filtros del Reporte de Asistencia</h2>
              
              <div className={styles.filterGrid}>
              {/* School Filter */}
              <div className={styles.filterGroup}>
                <label htmlFor="school-select">🏫 Escuela:</label>
                <select 
                  id="school-select"
                  value={selectedSchool} 
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className={styles.filterSelect}
                  disabled={user?.role?.toLowerCase() !== 'super_admin' && schools.length <= 1}
                >
                  <option value="">Seleccionar escuela</option>
                  {schools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div className={styles.filterGroup}>
                <label htmlFor="month-select">📅 Mes:</label>
                <select 
                  id="month-select"
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className={styles.filterSelect}
                >
                  {monthNames.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Filter */}
              <div className={styles.filterGroup}>
                <label htmlFor="year-select">📅 Año:</label>
                <select 
                  id="year-select"
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={styles.filterSelect}
                >
                  {generateYearOptions().map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course Filter (Optional) */}
              <div className={styles.filterGroup}>
                <label htmlFor="course-select">📚 Curso (Opcional):</label>
                <select 
                  id="course-select"
                  value={selectedCourse} 
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Todos los cursos</option>
                  {getFilteredCourses().map(course => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.filterActions}>
              <button 
                onClick={loadReport}
                disabled={!selectedSchool || loadingReport}
                className={styles.generateButton}
              >
                {loadingReport ? '🔄 Generando...' : '📊 Generar Reporte'}
              </button>
            </div>
          </div>
          )}

          {/* Error Display */}
          {error && (
            <div className={styles.errorMessage}>
              ❌ {error}
            </div>
          )}

          {/* Report Display */}
          {report && (
            <div className={styles.reportSection}>
              {/* Report Header */}
              <div className={styles.reportHeader}>
                <div className={styles.reportTitleRow}>
                  <div className={styles.titleAndInfo}>
                    <h2>📋 Reporte de Asistencia</h2>
                    <div className={styles.reportInfo}>
                      <p><strong>🏫 Escuela:</strong> {report.school.name}</p>
                      <p><strong>📅 Período:</strong> {report.period.monthName} {report.period.year}</p>
                    </div>
                  </div>
                  
                  <div className={styles.exportButtonContainer}>
                    <button 
                      onClick={() => exportReport('excel')}
                      disabled={exporting}
                      className={`${styles.exportButton} ${styles.excelButton}`}
                    >
                      {exporting ? '⏳' : '📊'} Descargar Excel Detallado
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <h3>📚 Total Cursos</h3>
                  <p className={styles.summaryValue}>{report.summary.totalCourses}</p>
                </div>
                <div className={styles.summaryCard}>
                  <h3>🏫 Total Clases</h3>
                  <p className={styles.summaryValue}>{report.summary.totalClasses}</p>
                </div>
                <div className={styles.summaryCard}>
                  <h3>👥 Total Estudiantes</h3>
                  <p className={styles.summaryValue}>{report.summary.totalStudents}</p>
                </div>
                <div className={styles.summaryCard}>
                  <h3>📊 Asistencia General</h3>
                  <p className={styles.summaryValue}>{report.summary.overallAttendancePercentage}%</p>
                </div>
              </div>

              {/* Course Details Table */}
              {report.courseDetails.length > 0 ? (
                <div className={styles.tableContainer}>
                  <h3>📋 Detalle por Curso</h3>
                  <table className={styles.reportTable}>
                    <thead>
                      <tr>
                        <th>Curso</th>
                        <th>Clases</th>
                        <th>Estudiantes</th>
                        <th>Presentes</th>
                        <th>Ausentes</th>
                        <th>% Asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.courseDetails.map((course) => (
                        <tr key={course.courseId}>
                          <td>{course.courseName}</td>
                          <td>{course.totalClasses}</td>
                          <td>{course.totalStudents}</td>
                          <td className={styles.presentCount}>{course.presentCount}</td>
                          <td className={styles.absentCount}>{course.absentCount}</td>
                          <td className={styles.attendancePercentage}>
                            <span className={course.attendancePercentage >= 80 ? styles.goodAttendance : 
                                           course.attendancePercentage >= 60 ? styles.okAttendance : 
                                           styles.poorAttendance}>
                              {course.attendancePercentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.noData}>
                  📭 No hay datos de asistencia para el período seleccionado.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 