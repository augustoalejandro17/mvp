import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import styles from '../../styles/Categories.module.css';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface Category {
  _id: string;
  name: string;
  description?: string;
  parentCategory?: string;
  isActive: boolean;
  sortOrder: number;
  color?: string;
  icon?: string;
  children?: Category[];
}

interface CategoryFormData {
  name: string;
  description: string;
  parentCategory: string;
  color: string;
  icon: string;
  sortOrder: number;
}

export default function CategoriesManagement() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    parentCategory: '',
    color: '#0070f3',
    icon: '',
    sortOrder: 0
  });
  
  // UI states
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const userRole = decoded.role.toLowerCase();
      
      if (!['super_admin', 'admin'].includes(userRole)) {
        router.push('/');
        return;
      }
    } catch (error) {
      router.push('/login');
      return;
    }

    fetchCategories();
  }, [router]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/categories?hierarchical=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      parentCategory: '',
      color: '#0070f3',
      icon: '',
      sortOrder: 0
    });
    setShowForm(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentCategory: category.parentCategory || '',
      color: category.color || '#0070f3',
      icon: category.icon || '',
      sortOrder: category.sortOrder
    });
    setShowForm(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        parentCategory: formData.parentCategory || undefined,
        color: formData.color,
        icon: formData.icon.trim() || undefined,
        sortOrder: formData.sortOrder
      };

      if (editingCategory) {
        await axios.put(`${apiUrl}/api/categories/${editingCategory._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Categoría actualizada exitosamente');
      } else {
        await axios.post(`${apiUrl}/api/categories`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Categoría creada exitosamente');
      }

      setShowForm(false);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      setError(error.response?.data?.message || 'Error al guardar la categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      await axios.delete(`${apiUrl}/api/categories/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Categoría eliminada exitosamente');
      fetchCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      setError(error.response?.data?.message || 'Error al eliminar la categoría');
    }
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategoryRow = (category: Category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category._id);
    
    return (
      <React.Fragment key={category._id}>
        <tr className={level > 0 ? styles.subcategoryRow : ''}>
          <td style={{ paddingLeft: `${level * 20 + 10}px` }}>
            <div className={styles.categoryCell}>
              {hasChildren && (
                <button
                  onClick={() => toggleCategoryExpansion(category._id)}
                  className={styles.expandButton}
                >
                  {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                </button>
              )}
              
              {category.icon && (
                <span className={styles.categoryIcon}>{category.icon}</span>
              )}
              
              <span className={styles.categoryName}>{category.name}</span>
              
              {category.color && (
                <span 
                  className={styles.colorIndicator}
                  style={{ backgroundColor: category.color }}
                />
              )}
            </div>
          </td>
          <td>{category.description || '-'}</td>
          <td>{category.parentCategory ? 'Subcategoría' : 'Categoría Principal'}</td>
          <td>{category.sortOrder}</td>
          <td>
            <span className={category.isActive ? styles.activeStatus : styles.inactiveStatus}>
              {category.isActive ? 'Activa' : 'Inactiva'}
            </span>
          </td>
          <td>
            <div className={styles.actionButtons}>
              <button
                onClick={() => handleEditCategory(category)}
                className={styles.editButton}
                title="Editar"
              >
                <FaEdit />
              </button>
              <button
                onClick={() => handleDeleteCategory(category._id)}
                className={styles.deleteButton}
                title="Eliminar"
              >
                <FaTrash />
              </button>
            </div>
          </td>
        </tr>
        
        {hasChildren && isExpanded && 
          category.children!.map(child => renderCategoryRow(child, level + 1))
        }
      </React.Fragment>
    );
  };

  const getAllParentCategories = (categories: Category[]): Category[] => {
    return categories.filter(cat => !cat.parentCategory);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando categorías...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Gestión de Categorías</h1>
        <button
          onClick={handleCreateCategory}
          className={styles.primaryButton}
        >
          <FaPlus /> Nueva Categoría
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {/* Category Form Modal */}
      {showForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button
                onClick={() => setShowForm(false)}
                className={styles.closeButton}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Nombre *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className={styles.textarea}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="parentCategory">Categoría Padre (opcional)</label>
                <select
                  id="parentCategory"
                  value={formData.parentCategory}
                  onChange={(e) => setFormData({ ...formData, parentCategory: e.target.value })}
                  className={styles.select}
                >
                  <option value="">Sin categoría padre (Categoría Principal)</option>
                  {getAllParentCategories(categories).map(category => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="color">Color</label>
                  <input
                    type="color"
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className={styles.colorInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="icon">Icono (emoji)</label>
                  <input
                    type="text"
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🎵"
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="sortOrder">Orden</label>
                  <input
                    type="number"
                    id="sortOrder"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.submitButton}
                >
                  <FaSave /> {submitting ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={styles.cancelButton}
                >
                  <FaTimes /> Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Orden</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  No hay categorías disponibles
                </td>
              </tr>
            ) : (
              categories.map(category => renderCategoryRow(category))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 