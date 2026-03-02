import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import Layout from '../../components/Layout';
import AdminNavigation from '../../components/AdminNavigation';
import UsageDashboard from '../../components/usage/UsageDashboard';
import styles from '../../styles/AdminDashboard.module.css';

interface DecodedToken {
  sub: string;
  name: string;
  role: string;
  schoolId?: string;
  schools?: Array<{ _id: string; name: string }>;
}

interface School {
  _id: string;
  name: string;
}

export default function UsageTrackingPage() {
  const router = useRouter();
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [userSchools, setUserSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = Cookies.get('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const decoded = jwtDecode<DecodedToken>(token);
        setUser(decoded);

        // Fetch user's schools from API instead of relying on token
        await fetchUserSchools(token, decoded);

        setLoading(false);
      } catch (error) {
        console.error('Error al decodificar token:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const fetchUserSchools = async (token: string, user: DecodedToken) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Fetch schools based on user role
      let response;
      if (user.role === 'super_admin') {
        // Super admin can see all schools
        response = await fetch(`${apiUrl}/api/schools`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else if (user.role === 'school_owner') {
        // School owners see their owned schools
        response = await fetch(`${apiUrl}/api/users/${user.sub}/owned-schools`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else if (user.role === 'administrative') {
        // Administrative users see administered schools
        response = await fetch(`${apiUrl}/api/users/${user.sub}/administered-schools`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        // For other roles, try general schools endpoint
        response = await fetch(`${apiUrl}/api/schools`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      if (response?.ok) {
        const schools = await response.json();
        setUserSchools(schools || []);

        // Set default selected school
        if (schools && schools.length > 0) {
          setSelectedSchool(schools[0]._id);
        }
      } else {
        console.error('Error fetching schools:', response?.statusText);
        setUserSchools([]);
      }
    } catch (error) {
      console.error('Error fetching user schools:', error);
      setUserSchools([]);
    }
  };

  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchool(schoolId);
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>Cargando panel de uso de recursos...</div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className={styles.error}>No autorizado</div>
      </Layout>
    );
  }

  const selectedSchoolData = userSchools.find(school => school._id === selectedSchool);

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
          <h1>Uso de Recursos</h1>
          <p>Monitorea el uso de almacenamiento y streaming de tu escuela.</p>
        </div>

        <div className={styles.content}>
          <AdminNavigation userRole={user?.role} />

          <div className={styles.mainContent}>
            {/* School selector for users with multiple schools */}
            {userSchools.length > 1 && (
              <div className={styles.schoolSelector}>
                <label htmlFor="school-select">Escuela: </label>
                <select 
                  id="school-select" 
                  value={selectedSchool} 
                  onChange={(e) => handleSchoolChange(e.target.value)}
                  className={styles.schoolSelect}
                >
                  {userSchools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Usage Dashboard */}
            {selectedSchool && (
              <UsageDashboard 
                schoolId={selectedSchool}
                schoolName={selectedSchoolData?.name}
                userRole={user.role}
              />
            )}

            {/* No school selected state */}
            {!selectedSchool && userSchools.length === 0 && (
              <div className={styles.noSchoolsMessage}>
                <div className={styles.noSchoolsIcon}>🏫</div>
                <h3>No hay escuelas disponibles</h3>
                <p>No tienes acceso a ninguna escuela para ver el uso de recursos.</p>
                <p>Usuario: {user?.name} | Rol: {user?.role}</p>
                <p>Contacta con el administrador si crees que esto es un error.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className={styles.plainButton}
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 
