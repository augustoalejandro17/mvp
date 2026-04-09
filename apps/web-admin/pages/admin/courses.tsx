import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../components/AdminNavigation';
import { getImageUrl } from '../../utils/image-utils';

interface DecodedToken {
  sub: string;
  id?: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

interface School {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  imageUrl?: string;
  isPublic: boolean;
  isActive: boolean;
  school: School | null;
  teacher: Teacher | null;
  teachers?: Teacher[];
  createdAt: string;
}

export default function CoursesManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  // Filters
  const [filterSchool, setFilterSchool] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/'); return; }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const role = decoded.role?.toLowerCase();
      const allowedRoles = ['super_admin', 'admin', 'school_owner', 'administrative', 'teacher'];
      if (!allowedRoles.some((r) => role.includes(r))) {
        router.push('/admin/dashboard');
        return;
      }
      const uid = decoded.id || decoded.sub;
      setUserRole(decoded.role);
      setUserId(uid);
      fetchAll(decoded, uid, token);
    } catch {
      router.push('/login');
    }
  }, [router]);

  const fetchAll = async (decoded: DecodedToken, uid: string, token: string) => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const role = decoded.role?.toLowerCase();
      const headers = { Authorization: `Bearer ${token}` };

      // Load courses
      const coursesRes = await axios.get(`${apiUrl}/api/courses`, { headers });
      const coursesData: Course[] = coursesRes.data || [];
      setCourses(coursesData);

      // Load schools for the filter (admin roles see all, others see their own)
      let schoolsData: School[] = [];
      if (role.includes('super_admin') || role.includes('admin')) {
        const schoolsRes = await axios.get(`${apiUrl}/api/schools`, { headers });
        schoolsData = schoolsRes.data.schools || schoolsRes.data || [];
      } else if (role.includes('school_owner')) {
        const schoolsRes = await axios.get(`${apiUrl}/api/users/${uid}/owned-schools`, { headers });
        schoolsData = schoolsRes.data || [];
      } else if (role.includes('administrative')) {
        const schoolsRes = await axios.get(`${apiUrl}/api/users/${uid}/administered-schools`, { headers });
        schoolsData = schoolsRes.data || [];
      } else {
        // Derive unique schools from the courses list
        const seen = new Set<string>();
        coursesData.forEach((c) => {
          if (c.school && !seen.has(c.school._id)) {
            seen.add(c.school._id);
            schoolsData.push(c.school);
          }
        });
      }
      setSchools(schoolsData);
    } catch (err) {
      console.error('Error loading courses:', err);
      setError('Error al cargar los cursos. Verifica tu conexión o inicia sesión de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Unique teachers derived from current courses list (for filter dropdown)
  const allTeachers = useMemo<Teacher[]>(() => {
    const map = new Map<string, Teacher>();
    courses.forEach((c) => {
      if (c.teacher) map.set(c.teacher._id, c.teacher);
      c.teachers?.forEach((t) => map.set(t._id, t));
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [courses]);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const matchSchool = !filterSchool || c.school?._id === filterSchool;
      const matchTeacher =
        !filterTeacher ||
        c.teacher?._id === filterTeacher ||
        c.teachers?.some((t) => t._id === filterTeacher);
      const q = filterSearch.toLowerCase();
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q);
      return matchSchool && matchTeacher && matchSearch;
    });
  }, [courses, filterSchool, filterTeacher, filterSearch]);

  const isSuperAdmin = userRole?.toLowerCase().includes('super_admin');
  const isAdmin = userRole?.toLowerCase().includes('admin');
  const canCreate = isSuperAdmin || isAdmin || userRole?.toLowerCase().includes('school_owner') || userRole?.toLowerCase().includes('administrative') || userRole?.toLowerCase().includes('teacher');

  if (loading) return <div className={styles.loading}>Cargando cursos...</div>;

  if (error) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button onClick={() => router.reload()} className={styles.refreshButton}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Gestión de Cursos</h1>
        <p>
          {isSuperAdmin || isAdmin
            ? 'Administra todos los cursos de la plataforma.'
            : 'Administra los cursos de tus escuelas.'}
        </p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole={userRole} />

        <div className={styles.mainContent}>
          {/* Top bar: stats + create button */}
          <div className={`${styles.actionsRow} ${styles.coursesTopBar}`}>
            <div className={styles.statsContainer}>
              <span className={styles.statItem}>
                Mostrando {filtered.length} de {courses.length} curso{courses.length !== 1 ? 's' : ''}
              </span>
            </div>
            {canCreate && (
              <Link href="/course/create" className={styles.addButton}>
                Crear Curso
              </Link>
            )}
          </div>

          {/* Filters */}
          <div className={`${styles.actionsRow} ${styles.coursesFiltersRow}`}>
            <input
              type="text"
              placeholder="Buscar por nombre o descripción..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className={`${styles.searchInput} ${styles.coursesSearchInput}`}
            />

            {schools.length > 1 && (
              <select
                value={filterSchool}
                onChange={(e) => { setFilterSchool(e.target.value); setFilterTeacher(''); }}
                className={`${styles.filterSelect} ${styles.coursesFilterSelect}`}
              >
                <option value="">Todas las escuelas</option>
                {schools.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            )}

            {allTeachers.length > 0 && (
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className={`${styles.filterSelect} ${styles.coursesFilterSelect}`}
              >
                <option value="">Todos los profesores</option>
                {allTeachers.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Table */}
          <div className={`${styles.tableContainer} ${styles.coursesTableContainer}`}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Escuela</th>
                  <th>Profesor Principal</th>
                  <th>Visibilidad</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((course) => (
                    <tr key={course._id}>
                      <td>
                        <div className={styles.courseNameCell}>
                          {course.imageUrl && (
                            <img
                              src={getImageUrl(course.imageUrl)}
                              alt={course.title}
                              className={styles.courseThumbnail}
                            />
                          )}
                          <span className={styles.courseTitleText} title={course.title}>{course.title}</span>
                        </div>
                      </td>
                      <td>{course.school?.name ?? <span className={styles.noDataMuted}>Sin escuela</span>}</td>
                      <td>
                        {course.teacher ? (
                          <div className={styles.courseTeacherInfo}>
                            <span title={course.teacher.name}>{course.teacher.name}</span>
                            <small title={course.teacher.email}>{course.teacher.email}</small>
                          </div>
                        ) : (
                          <span className={styles.noDataMuted}>Sin asignar</span>
                        )}
                      </td>
                      <td className={styles.centeredCell}>
                        <span className={course.isPublic ? styles.visibilityPublicPill : styles.visibilityPrivatePill}>
                          {course.isPublic ? 'Público' : 'Privado'}
                        </span>
                      </td>
                      <td className={styles.centeredCell}>
                        <span className={`${styles.statusBadge} ${course.isActive ? styles.statusActivePill : styles.statusInactivePill}`}>
                          {course.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{new Date(course.createdAt).toLocaleDateString('es-CO')}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <Link href={`/course/${course._id}`} className={styles.viewButton}>
                            Ver
                          </Link>
                          {canCreate && (
                            <Link href={`/course/edit/${course._id}`} className={styles.editButton}>
                              Editar
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className={styles.noDataMessage}>
                      {courses.length === 0
                        ? 'No hay cursos disponibles.'
                        : 'No se encontraron cursos con los filtros aplicados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
