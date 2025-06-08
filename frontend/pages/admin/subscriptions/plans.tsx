import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../../components/AdminNavigation';

interface Plan {
  _id: string;
  id: string;
  name: string;
  type: string;
  description: string;
  price: number; // Price in cents from backend
  isActive: boolean;
  studentSeats: number;
  teachers: number;
  maxConcurrentCoursesPerStudent: number;
  storageGb: number; // Backend returns 'storageGb' not 'storageGB'
  streamingHours: number; // Backend returns 'streamingHours' not 'streamingHoursPerMonth'
  features: string[];
  subscriptionsCount: number;
}

type SortField = 'name' | 'price' | 'studentSeats' | 'teachers' | 'storageGb' | 'streamingHours';
type SortDirection = 'asc' | 'desc';

interface CreatePlanForm {
  name: string;
  type: 'basic' | 'intermediate' | 'advanced' | 'premium';
  description: string;
  price: number; // Price in cents
  studentSeats: number;
  teachers: number;
  maxConcurrentCoursesPerStudent: number;
  storageGb: number;
  streamingHours: number;
  features: string;
  isActive: boolean;
}

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [createForm, setCreateForm] = useState<CreatePlanForm>({
    name: '',
    type: 'basic',
    description: '',
    price: 10000, // $100 in cents
    studentSeats: 20,
    teachers: 2,
    maxConcurrentCoursesPerStudent: 1,
    storageGb: 20,
    streamingHours: 20,
    features: 'Acceso básico, Soporte email',
    isActive: true
  });
  const [editForm, setEditForm] = useState<CreatePlanForm>({
    name: '',
    type: 'basic',
    description: '',
    price: 10000,
    studentSeats: 20,
    teachers: 2,
    maxConcurrentCoursesPerStudent: 1,
    storageGb: 20,
    streamingHours: 20,
    features: 'Acceso básico, Soporte email',
    isActive: true
  });
  const router = useRouter();

  // Fix hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      checkAuth();
      fetchPlans();
    }
  }, [mounted]);

    const checkAuth = async () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Check if user is super_admin
      try {
        const response = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          if (userData.role !== 'super_admin') {
            router.push('/admin/dashboard');
            return;
          }
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
        return;
      }
    };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      console.log('Fetching plans from: /api/admin/subscriptions/plans');
      
      const response = await fetch('/api/admin/subscriptions/plans', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setPlans(data.plans || data || []);
    } catch (error) {
      console.error('Error al obtener planes:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const token = Cookies.get('token');
      if (!token) return;

      const planData = {
        ...createForm,
        features: createForm.features.split(',').map(f => f.trim()),
        // Add all required backend fields
        monthlyPriceCents: createForm.price,
        storageGB: createForm.storageGb,
        streamingHoursPerMonth: createForm.streamingHours,
        overageStudentCents: Math.floor(createForm.price * 0.03), // 3% of monthly price
        overageStorageCentsPerGB: 20, // $0.20 per GB
        overageStreamingCentsPerHour: 6, // $0.06 per hour
        // Legacy fields
        maxUsers: createForm.studentSeats,
        maxStorageGb: createForm.storageGb,
        maxStreamingMinutesPerMonth: createForm.streamingHours * 60,
        maxCoursesPerUser: createForm.maxConcurrentCoursesPerStudent,
        monthlyPrice: createForm.price / 100,
        isDefault: createForm.type === 'basic',
        extraUserPrice: (createForm.price * 0.03) / 100,
        extraStorageGbPrice: 0.20,
        extraStreamingMinutesPrice: 0.001,
        extraCoursePerUserPrice: 5.00
      };

      const response = await fetch('/api/admin/subscriptions/plans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Success - refresh plans and close modal
      await fetchPlans();
      setShowCreateModal(false);
      resetCreateForm();
      
    } catch (error) {
      console.error('Error creating plan:', error);
      setError(error instanceof Error ? error.message : 'Error al crear plan');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      type: 'basic',
      description: '',
      price: 10000,
      studentSeats: 20,
      teachers: 2,
      maxConcurrentCoursesPerStudent: 1,
      storageGb: 20,
      streamingHours: 20,
      features: 'Acceso básico, Soporte email',
      isActive: true
    });
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      type: plan.type as any,
      description: plan.description,
      price: plan.price,
      studentSeats: plan.studentSeats,
      teachers: plan.teachers,
      maxConcurrentCoursesPerStudent: plan.maxConcurrentCoursesPerStudent,
      storageGb: plan.storageGb,
      streamingHours: plan.streamingHours,
      features: plan.features.join(', '),
      isActive: plan.isActive
    });
    setShowEditModal(true);
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    
    setEditing(true);

    try {
      const token = Cookies.get('token');
      if (!token) return;

      const planData = {
        ...editForm,
        features: editForm.features.split(',').map(f => f.trim()),
        // Add all required backend fields
        monthlyPriceCents: editForm.price,
        storageGB: editForm.storageGb,
        streamingHoursPerMonth: editForm.streamingHours,
        overageStudentCents: Math.floor(editForm.price * 0.03),
        overageStorageCentsPerGB: 20,
        overageStreamingCentsPerHour: 6,
        // Legacy fields
        maxUsers: editForm.studentSeats,
        maxStorageGb: editForm.storageGb,
        maxStreamingMinutesPerMonth: editForm.streamingHours * 60,
        maxCoursesPerUser: editForm.maxConcurrentCoursesPerStudent,
        monthlyPrice: editForm.price / 100,
        isDefault: editForm.type === 'basic',
        extraUserPrice: (editForm.price * 0.03) / 100,
        extraStorageGbPrice: 0.20,
        extraStreamingMinutesPrice: 0.001,
        extraCoursePerUserPrice: 5.00
      };

      const response = await fetch(`/api/admin/subscriptions/plans/${editingPlan._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Success - refresh plans and close modal
      await fetchPlans();
      setShowEditModal(false);
      setEditingPlan(null);
      
    } catch (error) {
      console.error('Error updating plan:', error);
      setError(error instanceof Error ? error.message : 'Error al actualizar plan');
    } finally {
      setEditing(false);
    }
  };

  const formatPrice = (cents: number) => {
    if (!cents || isNaN(cents)) return '$0';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatOveragePrice = (cents: number) => {
    if (!cents || isNaN(cents)) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedPlans = () => {
    return [...plans].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle string comparison for name
      if (sortField === 'name') {
        aValue = (aValue as string).toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      // Handle numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
          <h1>Planes de Suscripción</h1>
          <p>Gestiona los planes disponibles para las escuelas.</p>
        </div>
        <div className={styles.content}>
          <AdminNavigation userRole="super_admin" />
          <div className={styles.mainContent}>
            <div className={styles.loading}>Cargando planes...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && plans.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={fetchPlans}
          className={styles.refreshButton}
        >
          Reintentar
        </button>
          <Link href="/admin/dashboard" className={styles.backButton}>
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const activePlans = plans.filter(plan => plan.isActive);

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Planes de Suscripción</h1>
        <p>Gestiona los planes disponibles para las escuelas.</p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole="super_admin" />

        <div className={styles.mainContent}>
          <div className={styles.actionsRow}>
            <div className={styles.statsContainer}>
              <div className={styles.statCard}>
                <h3>Total de Plans</h3>
                <p className={styles.statNumber}>{plans.length}</p>
              </div>
              <div className={styles.statCard}>
                <h3>Planes Activos</h3>
                <p className={styles.statNumber}>{activePlans.length}</p>
              </div>
            </div>
            <button 
              className={styles.addButton}
              onClick={() => setShowCreateModal(true)}
            >
              Crear Nuevo Plan
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th 
                    className={styles.sortableHeader}
                    onClick={() => handleSort('name')}
                    style={{ cursor: 'pointer' }}
                  >
                    Plan {getSortIcon('name')}
                  </th>
                  <th 
                    className={styles.sortableHeader}
                    onClick={() => handleSort('price')}
                    style={{ cursor: 'pointer' }}
                  >
                    Precio Mensual {getSortIcon('price')}
                  </th>
                  <th 
                    className={styles.sortableHeader}
                    onClick={() => handleSort('studentSeats')}
                    style={{ cursor: 'pointer' }}
                  >
                    Asientos {getSortIcon('studentSeats')}
                  </th>
                  <th 
                    className={styles.sortableHeader}
                    onClick={() => handleSort('teachers')}
                    style={{ cursor: 'pointer' }}
                  >
                    Profesores {getSortIcon('teachers')}
                  </th>
                  <th>Cursos Concurrentes</th>
                  <th 
                    className={styles.sortableHeader}
                    onClick={() => handleSort('storageGb')}
                    style={{ cursor: 'pointer' }}
                  >
                    Storage {getSortIcon('storageGb')}
                  </th>
                  <th 
                    className={styles.sortableHeader}
                    onClick={() => handleSort('streamingHours')}
                    style={{ cursor: 'pointer' }}
                  >
                    Streaming {getSortIcon('streamingHours')}
                  </th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plans.length > 0 ? (
                  getSortedPlans().map((plan) => (
                    <tr key={plan._id}>
                      <td>
                        <div className={styles.planInfo}>
                          <strong>{plan.name}</strong>
                          <br />
                          <small className={styles.planType}>{plan.type}</small>
                        </div>
                      </td>
                      <td className={styles.priceCell}>
                        {formatPrice(plan.price)}/mes
                      </td>
                      <td>
                        {plan.studentSeats || 0}
                        <br />
                        <small>(sin datos extra)</small>
                      </td>
                      <td>{plan.teachers || 0}</td>
                      <td>{plan.maxConcurrentCoursesPerStudent || 0}</td>
                      <td>
                        {plan.storageGb || 0} GB
                        <br />
                        <small>(sin datos extra)</small>
                      </td>
                      <td>
                        {plan.streamingHours || 0}h
                        <br />
                        <small>(sin datos extra)</small>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${plan.isActive ? styles.active : styles.inactive}`}>
                          {plan.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button 
                            className={styles.viewButton}
                            title="Ver características del plan"
                            onClick={() => {
                              alert(`Características de ${plan.name}:\n${plan.features.join('\n')}`);
                            }}
                          >
                            Ver
                          </button>
                          <button 
                            className={styles.editButton}
                            title="Editar plan"
                            onClick={() => handleEditPlan(plan)}
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className={styles.noDataMessage}>
                      No hay planes disponibles. <button onClick={() => setShowCreateModal(true)} className={styles.linkButton}>Crear el primer plan</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.actionsRow}>
            <Link href="/admin/subscriptions/list" className={styles.primaryButton}>
              Ver Suscripciones
            </Link>
            <Link href="/admin/schools" className={styles.secondaryButton}>
              Gestionar Escuelas
            </Link>
          </div>
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Crear Nuevo Plan</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePlan} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Nombre del Plan</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tipo</label>
                  <select
                    className={styles.formInput}
                    value={createForm.type}
                    onChange={(e) => setCreateForm({...createForm, type: e.target.value as any})}
                    required
                  >
                    <option value="basic">Basic</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea
                  className={styles.formInput}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Precio Mensual ($)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={createForm.price / 100}
                    onChange={(e) => setCreateForm({...createForm, price: Math.round(parseFloat(e.target.value) * 100)})}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Asientos de Estudiantes</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={createForm.studentSeats}
                    onChange={(e) => setCreateForm({...createForm, studentSeats: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Profesores</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={createForm.teachers}
                    onChange={(e) => setCreateForm({...createForm, teachers: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Cursos Concurrentes/Estudiante</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={createForm.maxConcurrentCoursesPerStudent}
                    onChange={(e) => setCreateForm({...createForm, maxConcurrentCoursesPerStudent: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Almacenamiento (GB)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={createForm.storageGb}
                    onChange={(e) => setCreateForm({...createForm, storageGb: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Horas de Streaming/Mes</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={createForm.streamingHours}
                    onChange={(e) => setCreateForm({...createForm, streamingHours: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Características (separadas por comas)</label>
                <textarea
                  className={styles.formInput}
                  value={createForm.features}
                  onChange={(e) => setCreateForm({...createForm, features: e.target.value})}
                  rows={2}
                  placeholder="Ej: Acceso básico, Soporte email, 20GB almacenamiento"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({...createForm, isActive: e.target.checked})}
                  />
                  Plan activo
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={creating}
                >
                  {creating ? 'Creando...' : 'Crear Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditModal && editingPlan && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Editar Plan: {editingPlan.name}</h2>
              <button 
                className={styles.closeButton}
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPlan(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePlan} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Nombre del Plan</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tipo</label>
                  <select
                    className={styles.formInput}
                    value={editForm.type}
                    onChange={(e) => setEditForm({...editForm, type: e.target.value as any})}
                    required
                  >
                    <option value="basic">Basic</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea
                  className={styles.formInput}
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Precio Mensual ($)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editForm.price / 100}
                    onChange={(e) => setEditForm({...editForm, price: Math.round(parseFloat(e.target.value) * 100)})}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Asientos de Estudiantes</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editForm.studentSeats}
                    onChange={(e) => setEditForm({...editForm, studentSeats: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Profesores</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editForm.teachers}
                    onChange={(e) => setEditForm({...editForm, teachers: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Cursos Concurrentes/Estudiante</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editForm.maxConcurrentCoursesPerStudent}
                    onChange={(e) => setEditForm({...editForm, maxConcurrentCoursesPerStudent: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Almacenamiento (GB)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editForm.storageGb}
                    onChange={(e) => setEditForm({...editForm, storageGb: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Horas de Streaming/Mes</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={editForm.streamingHours}
                    onChange={(e) => setEditForm({...editForm, streamingHours: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Características (separadas por comas)</label>
                <textarea
                  className={styles.formInput}
                  value={editForm.features}
                  onChange={(e) => setEditForm({...editForm, features: e.target.value})}
                  rows={2}
                  placeholder="Ej: Acceso básico, Soporte email, 20GB almacenamiento"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})}
                  />
                  Plan activo
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPlan(null);
                  }}
                  disabled={editing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={editing}
                >
                  {editing ? 'Actualizando...' : 'Actualizar Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 