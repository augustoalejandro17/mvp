import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Layout from '../../components/Layout';
import AdminNavigation from '../../components/AdminNavigation';
import StatisticsDashboard from '../../components/analytics/StatisticsDashboard';
import styles from '../../styles/AdminDashboard.module.css';

interface DecodedToken {
  sub: string;
  id?: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface School {
  _id: string;
  name: string;
  description?: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/');
        return;
      }

      const decoded: DecodedToken = jwtDecode(token);
      
      const role = decoded.role?.toLowerCase();

      // Check if user has admin access
      const adminRoles = ['super_admin', 'school_owner', 'administrative', 'admin'];
      if (!adminRoles.some(adminRole => role.includes(adminRole))) {
        router.push('/admin/dashboard');
        return;
      }

      setUser(decoded);
      await loadUserSchools(decoded);
    } catch (error) {
      console.error('Error during authentication:', error);
      setError('Error de autenticación');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSchools = async (userToken: DecodedToken) => {
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const userId = userToken.id || userToken.sub;
      const userRole = userToken.role?.toLowerCase();

      let schoolsData: School[] = [];

      if (userRole === 'super_admin' || userRole === 'admin') {
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

      setSchools(schoolsData);
      
      // Auto-select first school if only one available
      if (schoolsData.length === 1) {
        setSelectedSchool(schoolsData[0]._id);
      }
    } catch (error) {
      console.error('Error loading schools for analytics:', error);
      setError('Error al cargar las escuelas');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.loading}>
            <p>Cargando panel de analíticas...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.errorMessage}>
            <p>Error: {error}</p>
            <button onClick={() => router.push('/admin/dashboard')} className={styles.retryButton}>
              Volver al Panel
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={`${styles.dashboardHeader} ${styles.dashboardHeaderCompact}`}>
          <h1>Analíticas</h1>
          <p>Selecciona una dimensión y rango de fechas para analizar métricas de rendimiento.</p>
        </div>

        <div className={styles.content}>
          <AdminNavigation userRole={user?.role || "admin"} />
          
          <div className={styles.mainContent}>
            {/* School selector - only show if user has access to multiple schools */}
            {schools.length > 1 && (
              <div className={styles.schoolSelector}>
                <label htmlFor="school-select">Escuela:</label>
                <select
                  id="school-select"
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className={styles.schoolSelect}
                >
                  <option value="">Todas las Escuelas</option>
                  {schools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show selected school name for single school users */}
            {schools.length === 1 && selectedSchool && (
              <div className={styles.schoolSelector}>
                <p className={styles.pageSubheading}>
                  Analíticas para: {schools.find(s => s._id === selectedSchool)?.name}
                </p>
              </div>
            )}

            <StatisticsDashboard schoolId={selectedSchool || undefined} />
          </div>
        </div>
      </div>
    </Layout>
  );
} 
