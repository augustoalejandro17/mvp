import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../../../components/AdminNavigation';

interface Plan {
  _id: string;
  id: string;
  name: string;
  type: string;
  description: string;
  price: number;
  studentSeats: number;
  teachers: number;
  maxConcurrentCoursesPerStudent: number;
  storageGb: number;
  streamingHours: number;
  isActive: boolean;
  features: string[];
}

interface SchoolPlanDetails {
  school: {
    _id: string;
    name: string;
    description: string;
  };
  currentPlan: Plan | null;
  planId: string | null;
  extraSeats: number;
  extraStorageGB: number;
  extraStreamingHours: number;
  currentSeats: number;
  currentStorageUsageGB: number;
  currentStreamingUsageHours: number;
  totalSeats: number;
  totalStorageGB: number;
  totalStreamingHours: number;
}

interface Overage {
  id: string;
  type: 'student' | 'storage' | 'streaming';
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  date: string;
}

export default function SchoolSubscriptionManager() {
  const router = useRouter();
  const { schoolId } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<SchoolPlanDetails | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [overages, setOverages] = useState<Overage[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [extraSeats, setExtraSeats] = useState<number>(0);
  const [extraStorage, setExtraStorage] = useState<number>(0);
  const [extraStreaming, setExtraStreaming] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  
  useEffect(() => {
    console.log('Router query:', router.query);
    console.log('SchoolId:', schoolId);
    
    if (router.isReady && schoolId) {
      checkAuth();
      fetchSchoolDetails();
      fetchAvailablePlans();
      fetchOverages();
    }
  }, [router.isReady, schoolId]);
    
    const checkAuth = async () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Check user role and permissions
      try {
        const response = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('User data:', userData);
          setUserRole(userData.role);
          
          // Define allowed roles
          const allowedRoles = ['super_admin', 'administrative', 'school_owner'];
          
          if (!allowedRoles.includes(userData.role)) {
            router.push('/admin/dashboard');
            return;
          }
        } else {
          console.log('Auth failed, response status:', response.status);
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
        return;
      }
    };

  const fetchSchoolDetails = async () => {
      try {
      const token = Cookies.get('token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/admin/academies/${schoolId}/plan`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
        
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);
      
      // Transform backend response to match frontend interface
      const transformedData = {
        school: {
          _id: data.academy?.id || schoolId,
          name: data.academy?.name || 'Unknown School',
          description: data.academy?.description || ''
        },
        currentPlan: data.plan ? {
          _id: data.plan._id,
          id: data.plan._id,
          name: data.plan.name,
          type: data.plan.type,
          description: '',
          price: (() => {
            if (typeof data.plan.monthlyPrice === 'string') {
              // Remove dollar sign and convert to cents
              const dollarAmount = parseFloat(data.plan.monthlyPrice.replace('$', ''));
              return !isNaN(dollarAmount) ? Math.round(dollarAmount * 100) : 0;
            } else if (typeof data.plan.monthlyPrice === 'number') {
              return data.plan.monthlyPrice * 100;
            }
            return 0;
          })(),
          studentSeats: data.limits?.studentSeats || 0,
          teachers: data.limits?.teachers || 0,
          maxConcurrentCoursesPerStudent: 1,
          storageGb: data.limits?.storageGB || 0,
          streamingHours: data.limits?.streamingHours || 0,
          isActive: true,
          features: []
        } : null,
        planId: data.plan?._id || null,
        extraSeats: data.extras?.seats || 0,
        extraStorageGB: data.extras?.storageGB || 0,
        extraStreamingHours: data.extras?.streamingHours || 0,
        currentSeats: data.usage?.currentSeats || 0,
        currentStorageUsageGB: data.usage?.usedStorageGB || 0,
        currentStreamingUsageHours: data.usage?.usedStreamingHours || 0,
        totalSeats: data.limits?.studentSeats || 0,
        totalStorageGB: data.limits?.storageGB || 0,
        totalStreamingHours: data.limits?.streamingHours || 0
      };
      
      setSchoolDetails(transformedData);
      setSelectedPlanId(transformedData.planId || '');
      setExtraSeats(transformedData.extraSeats || 0);
      setExtraStorage(transformedData.extraStorageGB || 0);
      setExtraStreaming(transformedData.extraStreamingHours || 0);
      } catch (error) {
      console.error('Error al obtener detalles de la escuela:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      }
    };

  const fetchAvailablePlans = async () => {
    try {
      const token = Cookies.get('token');
      if (!token) return;
      
      const response = await fetch('/api/admin/subscriptions/plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAvailablePlans(data.plans || []);
    } catch (error) {
      console.error('Error al obtener planes:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchOverages = async () => {
    try {
      const token = Cookies.get('token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/admin/academies/${schoolId}/overages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOverages(data.overages || []);
      }
    } catch (error) {
      console.error('Error al obtener sobrecostos:', error);
    }
  };
  
  const handleSavePlan = async () => {
    if (!selectedPlanId) {
      setError('Por favor selecciona un plan');
      return;
    }

    setSaving(true);
    try {
      const token = Cookies.get('token');
      if (!token) return;
      
      // Assign plan
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const planResponse = await fetch(`${apiUrl}/api/admin/academies/${schoolId}/plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId: selectedPlanId })
      });

      if (!planResponse.ok) {
        throw new Error('Error al asignar plan');
      }

      // Update extra resources
      const addonsResponse = await fetch(`${apiUrl}/api/admin/academies/${schoolId}/addons`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          extraSeats,
          extraStorageGB: extraStorage,
          extraStreamingHours: extraStreaming
        })
      });
      
      if (!addonsResponse.ok) {
        throw new Error('Error al actualizar recursos adicionales');
      }
      
      // Refresh data
      await fetchSchoolDetails();
      setError(null);
      alert('Plan y recursos actualizados correctamente');
    } catch (error) {
      console.error('Error al guardar:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };
  
  if (!router.isReady || loading) {
    return <div className={styles.loading}>
      {!router.isReady ? 'Inicializando...' : 'Cargando detalles de suscripción...'}
    </div>;
  }

  if (!schoolId) {
    return (
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
          <h1>Error</h1>
          <p className={styles.error}>ID de escuela no válido</p>
          <Link href="/admin/schools" className={styles.backButton}>
            Volver a Escuelas
          </Link>
        </div>
      </div>
    );
  }
  
  if (error && !schoolDetails) {
    return (
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
          <Link href="/admin/schools" className={styles.backButton}>
            Volver a Escuelas
        </Link>
      </div>
      </div>
    );
  }
  
  const selectedPlan = availablePlans.find(plan => plan._id === selectedPlanId);
  
  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Gestión de Suscripción</h1>
        <p>Administra el plan y recursos de {schoolDetails?.school.name}</p>
      </div>
      
      <div className={styles.content}>
        <AdminNavigation userRole={userRole} />
        
        <div className={styles.mainContent}>
          {error && (
            <div className={styles.error} style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* Current Status */}
          <div className={styles.card} style={{ marginBottom: '2rem' }}>
            <h2 className={styles.cardTitle}>Estado Actual</h2>
            {schoolDetails && (
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Plan Actual</h3>
                  <div className={styles.statValue}>
                    {schoolDetails.currentPlan ? schoolDetails.currentPlan.name : 'Sin plan'}
          </div>
                  {schoolDetails.currentPlan && (
                    <p className={styles.statDescription}>
                      ${(schoolDetails.currentPlan.price / 100).toFixed(2)}/mes
                    </p>
                  )}
                </div>
                <div className={styles.statCard}>
                  <h3>Asientos</h3>
                  <div className={styles.statValue}>
                    {schoolDetails.currentSeats} / {schoolDetails.totalSeats}
                  </div>
                  <p className={styles.statDescription}>
                    Base: {schoolDetails.currentPlan?.studentSeats || 0} + Extra: {schoolDetails.extraSeats}
                  </p>
                </div>
                <div className={styles.statCard}>
                  <h3>Almacenamiento</h3>
                  <div className={styles.statValue}>
                    {(schoolDetails.currentStorageUsageGB || 0).toFixed(2)}GB / {schoolDetails.totalStorageGB}GB
                  </div>
                  <p className={styles.statDescription}>
                    Base: {schoolDetails.currentPlan?.storageGb || 0}GB + Extra: {schoolDetails.extraStorageGB}GB
                  </p>
                </div>
                <div className={styles.statCard}>
                  <h3>Streaming</h3>
                  <div className={styles.statValue}>
                    {(schoolDetails.currentStreamingUsageHours || 0).toFixed(2)}h / {schoolDetails.totalStreamingHours}h
              </div>
                  <p className={styles.statDescription}>
                    Base: {schoolDetails.currentPlan?.streamingHours || 0}h + Extra: {schoolDetails.extraStreamingHours}h
                </p>
              </div>
              </div>
            )}
                  </div>
                  
          {/* Plan Assignment - Only for super_admin */}
          {userRole === 'super_admin' && (
            <div className={styles.card} style={{ marginBottom: '2rem' }}>
              <h2 className={styles.cardTitle}>Asignar Plan</h2>
                    <div className={styles.formGroup}>
                <label htmlFor="planSelect">Seleccionar Plan:</label>
                <select
                  id="planSelect"
                  className={styles.select}
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  <option value="">Selecciona un plan...</option>
                  {availablePlans.map((plan) => (
                    <option key={plan._id} value={plan._id}>
                      {plan.name} - ${(plan.price / 100).toFixed(2)}/mes 
                      ({plan.studentSeats} asientos, {plan.storageGb}GB, {plan.streamingHours}h)
                    </option>
                  ))}
                </select>
                    </div>
                    
              {selectedPlan && (
                <div className={styles.infoCard} style={{ marginTop: '1rem' }}>
                  <h3>{selectedPlan.name}</h3>
                  <p>{selectedPlan.description}</p>
                  <div className={styles.infoRow}>
                    <div className={styles.infoItem}>
                      <strong>Precio:</strong> ${(selectedPlan.price / 100).toFixed(2)}/mes
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Estudiantes:</strong> {selectedPlan.studentSeats}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Profesores:</strong> {selectedPlan.teachers}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Cursos/Estudiante:</strong> {selectedPlan.maxConcurrentCoursesPerStudent}
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Almacenamiento:</strong> {selectedPlan.storageGb}GB
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Streaming:</strong> {selectedPlan.streamingHours}h/mes
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Extra Resources - Only for super_admin */}
          {userRole === 'super_admin' && (
            <div className={styles.card} style={{ marginBottom: '2rem' }}>
              <h2 className={styles.cardTitle}>Recursos Adicionales</h2>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="extraSeats">Asientos Extra:</label>
                  <input
                    type="number"
                    id="extraSeats"
                    className={styles.formInput}
                    value={extraSeats}
                    onChange={(e) => setExtraSeats(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="extraStorage">Almacenamiento Extra (GB):</label>
                  <input
                    type="number"
                    id="extraStorage"
                    className={styles.formInput}
                    value={extraStorage}
                    onChange={(e) => setExtraStorage(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="extraStreaming">Streaming Extra (horas):</label>
                  <input
                    type="number"
                    id="extraStreaming"
                    className={styles.formInput}
                    value={extraStreaming}
                    onChange={(e) => setExtraStreaming(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Overages - Only for super_admin */}
          {userRole === 'super_admin' && overages.length > 0 && (
            <div className={styles.card} style={{ marginBottom: '2rem' }}>
              <h2 className={styles.cardTitle}>Sobrecostos Recientes</h2>
              <div className={styles.tableContainer}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>Precio Unitario</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overages.map((overage) => (
                      <tr key={overage.id}>
                        <td>{new Date(overage.date).toLocaleDateString()}</td>
                        <td style={{ textTransform: 'capitalize' }}>{overage.type}</td>
                        <td>{overage.quantity}</td>
                        <td>${(overage.unitPriceCents / 100).toFixed(2)}</td>
                        <td>${(overage.totalCents / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions - Only for super_admin */}
          {userRole === 'super_admin' && (
            <div className={styles.formActions}>
              <button
                onClick={handleSavePlan}
                className={styles.saveButton}
                disabled={saving || !selectedPlanId}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <Link href="/admin/schools" className={styles.cancelButton}>
                Cancelar
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 