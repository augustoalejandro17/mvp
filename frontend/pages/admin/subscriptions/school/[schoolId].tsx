import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../../styles/AdminDashboard.module.css';

interface SubscriptionDetails {
  schoolId: string;
  schoolName: string;
  planName: string;
  planType: string;
  status: string;
  startDate: string;
  endDate?: string;
  
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
  
  streaming: {
    used: number;
    limit: number;
    percentage: number;
  };
  
  users: {
    count: number;
    limit: number;
    percentage: number;
  };
  
  coursesPerUser: {
    limit: number;
  };
  
  extraResourcesApproved: {
    extraUsers: number;
    extraStorageGb: number;
    extraStreamingMinutes: number;
    extraCoursesPerUser: number;
  };
  
  monthlyUsage: Array<{
    month: number;
    year: number;
    usedStorageGb: number;
    usedStreamingMinutes: number;
    activeUsers: number;
  }>;
  
  error?: string;
}

interface ExtraResourcesForm {
  extraUsers: number;
  extraStorageGb: number;
  extraStreamingMinutes: number;
  extraCoursesPerUser: number;
}

export default function SchoolSubscriptionDetails() {
  const router = useRouter();
  const { schoolId } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para el formulario de addons
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ExtraResourcesForm>({
    extraUsers: 0,
    extraStorageGb: 0,
    extraStreamingMinutes: 0,
    extraCoursesPerUser: 0
  });
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  useEffect(() => {
    if (!schoolId) return;
    
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/subscriptions');
        return;
      }

      // Verificar si es super admin
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        
        // Verificar si tiene el rol super_admin
        const role = Array.isArray(decoded.role) 
          ? decoded.role.find((r: string) => r.toLowerCase().includes('super_admin'))
          : decoded.role;
        
        if (!role || !role.toLowerCase().includes('super_admin')) {
          router.push('/admin/dashboard');
          return;
        }
        
        // Cargar detalles de la suscripción
        fetchSubscriptionDetails();
      } catch (error) {
        console.error('Error al verificar rol:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [schoolId, router]);
  
  const fetchSubscriptionDetails = async () => {
    if (!schoolId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      const response = await fetch(`/api/admin-stats/subscriptions/${schoolId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setSubscription(data);
      
      // Inicializar el formulario con valores actuales
      if (data.extraResourcesApproved) {
        setFormData({
          extraUsers: data.extraResourcesApproved.extraUsers || 0,
          extraStorageGb: data.extraResourcesApproved.extraStorageGb || 0,
          extraStreamingMinutes: data.extraResourcesApproved.extraStreamingMinutes || 0,
          extraCoursesPerUser: data.extraResourcesApproved.extraCoursesPerUser || 0
        });
      }
    } catch (error) {
      console.error('Error al obtener detalles de suscripción:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: parseInt(value) || 0
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setUpdateSuccess(false);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      // Obtener el ID de la suscripción desde el objeto subscription
      const subscriptionId = subscription?.schoolId;
      if (!subscriptionId) return;
      
      // Corregir la ruta para agregar recursos adicionales
      const response = await fetch(`/api/admin-subscriptions/${subscriptionId}/add-extra-resources`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // Recargar la información
      fetchSubscriptionDetails();
      setIsEditing(false);
      setUpdateSuccess(true);
      
      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error al actualizar recursos:', error);
      setError(error instanceof Error ? error.message : 'Error al actualizar recursos adicionales');
    }
  };
  
  if (loading) {
    return <div className={styles.loading}>Cargando detalles de la suscripción...</div>;
  }
  
  if (error) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={fetchSubscriptionDetails}
          className={styles.refreshButton}
        >
          Reintentar
        </button>
        <Link href="/admin/subscriptions" className={styles.backButton}>
          Volver a suscripciones
        </Link>
      </div>
    );
  }
  
  if (!subscription) {
    return (
      <div className={styles.container}>
        <h1>No se encontró información</h1>
        <Link href="/admin/subscriptions" className={styles.backButton}>
          Volver a suscripciones
        </Link>
      </div>
    );
  }
  
  // Formatear fechas
  const startDate = new Date(subscription.startDate).toLocaleDateString();
  const endDate = subscription.endDate 
    ? new Date(subscription.endDate).toLocaleDateString() 
    : 'No definido';
  
  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Detalles de Suscripción</h1>
        <p>Escuela: {subscription.schoolName}</p>
      </div>
      
      <div className={styles.content}>
        <div className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navLink}>
              Inicio
            </Link>
            <Link href="/admin/dashboard" className={styles.navLink}>
              Dashboard
            </Link>
            <Link href="/admin/subscriptions" className={styles.navLink}>
              Suscripciones
            </Link>
            <Link href="/admin/subscriptions/plans" className={styles.navLink}>
              Planes
            </Link>
            <Link href="/admin/users" className={styles.navLink}>
              Usuarios
            </Link>
            <Link href="/admin/schools" className={styles.navLink}>
              Escuelas
            </Link>
          </nav>
        </div>
        
        <div className={styles.mainContent}>
          {/* Información principal */}
          <div className={styles.infoCard}>
            <div className={styles.infoRow}>
              <div className={styles.infoItem}>
                <h3>Plan</h3>
                <p>{subscription.planName} ({subscription.planType})</p>
              </div>
              <div className={styles.infoItem}>
                <h3>Estado</h3>
                <p>{subscription.status}</p>
              </div>
              <div className={styles.infoItem}>
                <h3>Fecha de inicio</h3>
                <p>{startDate}</p>
              </div>
              <div className={styles.infoItem}>
                <h3>Fecha de finalización</h3>
                <p>{endDate}</p>
              </div>
            </div>
          </div>
          
          {/* Uso de recursos */}
          <div className={styles.resourceSection}>
            <h2>Uso de Recursos</h2>
            
            <div className={styles.usageRow}>
              <div className={styles.usageCard}>
                <h3>Almacenamiento</h3>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${subscription.storage.percentage}%` }}
                  ></div>
                </div>
                <p className={styles.usageText}>
                  {subscription.storage.used.toFixed(2)} GB de {subscription.storage.limit} GB
                  ({subscription.storage.percentage.toFixed(0)}%)
                </p>
              </div>
              
              <div className={styles.usageCard}>
                <h3>Minutos de Streaming</h3>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${subscription.streaming.percentage}%` }}
                  ></div>
                </div>
                <p className={styles.usageText}>
                  {subscription.streaming.used.toFixed(0)} min de {subscription.streaming.limit} min
                  ({subscription.streaming.percentage.toFixed(0)}%)
                </p>
              </div>
              
              <div className={styles.usageCard}>
                <h3>Usuarios</h3>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${subscription.users.percentage}%` }}
                  ></div>
                </div>
                <p className={styles.usageText}>
                  {subscription.users.count} de {subscription.users.limit} usuarios
                  ({subscription.users.percentage.toFixed(0)}%)
                </p>
              </div>
              
              <div className={styles.usageCard}>
                <h3>Cursos por Usuario</h3>
                <p className={styles.usageText}>
                  Límite: {subscription.coursesPerUser.limit} cursos por usuario
                </p>
              </div>
            </div>
          </div>
          
          {/* Recursos adicionales */}
          <div className={styles.resourceSection}>
            <h2>Recursos Adicionales Aprobados</h2>
            
            {updateSuccess && (
              <div className={styles.successMessage}>
                Recursos adicionales actualizados correctamente
              </div>
            )}
            
            {isEditing ? (
              <form onSubmit={handleSubmit} className={styles.resourceForm}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="extraUsers">Usuarios Extra</label>
                    <input
                      type="number"
                      id="extraUsers"
                      name="extraUsers"
                      min="0"
                      value={formData.extraUsers}
                      onChange={handleInputChange}
                      className={styles.formInput}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="extraStorageGb">Almacenamiento Extra (GB)</label>
                    <input
                      type="number"
                      id="extraStorageGb"
                      name="extraStorageGb"
                      min="0"
                      value={formData.extraStorageGb}
                      onChange={handleInputChange}
                      className={styles.formInput}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="extraStreamingMinutes">Minutos Streaming Extra</label>
                    <input
                      type="number"
                      id="extraStreamingMinutes"
                      name="extraStreamingMinutes"
                      min="0"
                      value={formData.extraStreamingMinutes}
                      onChange={handleInputChange}
                      className={styles.formInput}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="extraCoursesPerUser">Cursos Extra por Usuario</label>
                    <input
                      type="number"
                      id="extraCoursesPerUser"
                      name="extraCoursesPerUser"
                      min="0"
                      value={formData.extraCoursesPerUser}
                      onChange={handleInputChange}
                      className={styles.formInput}
                    />
                  </div>
                </div>
                
                <div className={styles.formActions}>
                  <button type="submit" className={styles.saveButton}>
                    Guardar Cambios
                  </button>
                  <button 
                    type="button" 
                    className={styles.cancelButton}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className={styles.resourceList}>
                  <div className={styles.resourceItem}>
                    <strong>Usuarios adicionales:</strong> {subscription.extraResourcesApproved?.extraUsers || 0}
                  </div>
                  <div className={styles.resourceItem}>
                    <strong>Almacenamiento adicional:</strong> {subscription.extraResourcesApproved?.extraStorageGb || 0} GB
                  </div>
                  <div className={styles.resourceItem}>
                    <strong>Minutos de streaming adicionales:</strong> {subscription.extraResourcesApproved?.extraStreamingMinutes || 0} min
                  </div>
                  <div className={styles.resourceItem}>
                    <strong>Cursos adicionales por usuario:</strong> {subscription.extraResourcesApproved?.extraCoursesPerUser || 0}
                  </div>
                </div>
                
                <button 
                  className={styles.editButton}
                  onClick={() => setIsEditing(true)}
                >
                  Modificar Recursos Adicionales
                </button>
              </div>
            )}
          </div>
          
          {/* Historial de uso mensual */}
          <div className={styles.resourceSection}>
            <h2>Historial de Uso Mensual</h2>
            
            {subscription.monthlyUsage && subscription.monthlyUsage.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.statsTable}>
                  <thead>
                    <tr>
                      <th>Mes/Año</th>
                      <th>Usuarios Activos</th>
                      <th>Almacenamiento (GB)</th>
                      <th>Streaming (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscription.monthlyUsage.map((month, index) => (
                      <tr key={index}>
                        <td>{month.month}/{month.year}</td>
                        <td>{month.activeUsers}</td>
                        <td>{month.usedStorageGb.toFixed(2)}</td>
                        <td>{month.usedStreamingMinutes.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No hay historial de uso mensual disponible</p>
            )}
          </div>
          
          <div className={styles.actionButtons}>
            <Link href="/admin/subscriptions" className={styles.backButton}>
              Volver a Suscripciones
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 