import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import AdminNavigation from '../../components/AdminNavigation';
import styles from '../../styles/AdminPlatform.module.css';

interface DecodedToken {
  sub?: string;
  id?: string;
  email: string;
  name: string;
  role: string;
}

interface UserSchoolRole {
  schoolId: string;
  role: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  schools?: string[];
  ownedSchools?: string[];
  administratedSchools?: string[];
  schoolRoles?: UserSchoolRole[];
}

interface School {
  _id: string;
  name: string;
  admin?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        email?: string;
      };
}

interface Course {
  _id: string;
  title: string;
  school?: string | { _id?: string; id?: string };
  schoolId?: string;
}

interface OwnerSeatQuota {
  ownerId: string;
  schoolId: string;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
}

const ROLE_OPTIONS = [
  { value: 'school_owner', label: 'Propietario' },
  { value: 'admin', label: 'Admin Escuela' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'student', label: 'Estudiante' },
];

const getEntityId = (value: any): string => {
  if (!value) return '';
  const raw = value?._id ?? value?.id ?? value;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
    const normalized = String(raw.toString());
    return normalized === '[object Object]' ? '' : normalized;
  }
  return '';
};

const getCourseSchoolId = (course: Course): string => {
  if (course.schoolId) return String(course.schoolId);
  if (typeof course.school === 'string') return course.school;
  return getEntityId(course.school);
};

const getErrorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message || error?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return fallback;
};

export default function AdminPlatformPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [userSession, setUserSession] = useState<DecodedToken | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedOwnerTransferId, setSelectedOwnerTransferId] = useState('');
  const [selectedRoleUserId, setSelectedRoleUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('administrative');

  const [selectedQuotaOwnerId, setSelectedQuotaOwnerId] = useState('');
  const [quotaValue, setQuotaValue] = useState<number>(0);
  const [ownerQuota, setOwnerQuota] = useState<OwnerSeatQuota | null>(null);

  const [selectedSeatUserId, setSelectedSeatUserId] = useState('');
  const [selectedSeatCourseId, setSelectedSeatCourseId] = useState('');
  const [selectedSeatOwnerId, setSelectedSeatOwnerId] = useState('');

  const normalizedRole = String(userSession?.role || '').toLowerCase();
  const canManagePlatform =
    normalizedRole === 'super_admin' || normalizedRole === 'admin';

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const loadData = useCallback(async () => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setUserSession(decoded);

      const headers = { Authorization: `Bearer ${token}` };
      const [usersResponse, schoolsResponse, coursesResponse] = await Promise.all([
        axios.get(`${apiUrl}/api/users`, { headers }),
        axios.get(`${apiUrl}/api/schools`, { headers }),
        axios.get(`${apiUrl}/api/courses`, { headers }),
      ]);

      setUsers(usersResponse.data?.users || usersResponse.data || []);
      setSchools(schoolsResponse.data?.schools || schoolsResponse.data || []);
      setCourses(coursesResponse.data || []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/login');
        return;
      }
      setError(getErrorMessage(err, 'No se pudo cargar la configuración'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedSchoolId && schools.length > 0) {
      setSelectedSchoolId(getEntityId(schools[0]));
    }
  }, [schools, selectedSchoolId]);

  const selectedSchool = useMemo(
    () => schools.find((school) => getEntityId(school) === selectedSchoolId) || null,
    [schools, selectedSchoolId],
  );

  const currentOwnerId = useMemo(() => {
    if (!selectedSchool) return '';
    return getEntityId(selectedSchool.admin);
  }, [selectedSchool]);

  const schoolUsers = useMemo(() => {
    if (!selectedSchoolId) return [];
    return users.filter((row) => {
      const inSchools = row.schools?.some((id) => String(id) === selectedSchoolId);
      const inOwned = row.ownedSchools?.some((id) => String(id) === selectedSchoolId);
      const inAdmin = row.administratedSchools?.some(
        (id) => String(id) === selectedSchoolId,
      );
      const inRoles = row.schoolRoles?.some(
        (item) => String(item.schoolId) === selectedSchoolId,
      );
      return !!(inSchools || inOwned || inAdmin || inRoles);
    });
  }, [users, selectedSchoolId]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const source = schoolUsers.length > 0 ? schoolUsers : users;
    if (!term) return source;
    return source.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const role = String(row.role || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [users, schoolUsers, searchTerm]);

  const ownerCandidates = useMemo(
    () => filteredUsers.filter((row) => String(row.role || '') !== 'unregistered'),
    [filteredUsers],
  );

  const ownersInSchool = useMemo(
    () =>
      users.filter((row) => {
        if (String(row.role || '').toLowerCase() !== 'school_owner') return false;
        const inOwned = row.ownedSchools?.some((id) => String(id) === selectedSchoolId);
        const inRoles = row.schoolRoles?.some(
          (item) =>
            String(item.schoolId) === selectedSchoolId &&
            String(item.role || '').toLowerCase() === 'school_owner',
        );
        return !!(inOwned || inRoles);
      }),
    [users, selectedSchoolId],
  );

  const studentCandidates = useMemo(
    () =>
      filteredUsers.filter((row) => {
        const role = String(row.role || '').toLowerCase();
        return role === 'student' || role === 'unregistered';
      }),
    [filteredUsers],
  );

  const schoolCourses = useMemo(
    () => courses.filter((course) => getCourseSchoolId(course) === selectedSchoolId),
    [courses, selectedSchoolId],
  );

  useEffect(() => {
    if (!ownerCandidates.some((row) => row._id === selectedOwnerTransferId)) {
      setSelectedOwnerTransferId(ownerCandidates[0]?._id || '');
    }
  }, [ownerCandidates, selectedOwnerTransferId]);

  useEffect(() => {
    if (!filteredUsers.some((row) => row._id === selectedRoleUserId)) {
      setSelectedRoleUserId(filteredUsers[0]?._id || '');
    }
  }, [filteredUsers, selectedRoleUserId]);

  useEffect(() => {
    if (!ownersInSchool.some((row) => row._id === selectedQuotaOwnerId)) {
      setSelectedQuotaOwnerId(ownersInSchool[0]?._id || '');
    }
  }, [ownersInSchool, selectedQuotaOwnerId]);

  useEffect(() => {
    if (!studentCandidates.some((row) => row._id === selectedSeatUserId)) {
      setSelectedSeatUserId(studentCandidates[0]?._id || '');
    }
  }, [studentCandidates, selectedSeatUserId]);

  useEffect(() => {
    if (!schoolCourses.some((row) => row._id === selectedSeatCourseId)) {
      setSelectedSeatCourseId(schoolCourses[0]?._id || '');
    }
  }, [schoolCourses, selectedSeatCourseId]);

  useEffect(() => {
    const fetchOwnerQuota = async () => {
      if (!selectedQuotaOwnerId || !selectedSchoolId) {
        setOwnerQuota(null);
        setQuotaValue(0);
        return;
      }

      const token = Cookies.get('token');
      if (!token) return;

      try {
        const response = await axios.get(
          `${apiUrl}/api/users/${selectedQuotaOwnerId}/owner-seat-quota`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { schoolId: selectedSchoolId },
          },
        );
        const quota = response.data?.quota || null;
        setOwnerQuota(quota);
        setQuotaValue(Number(quota?.totalSeats || 0));
      } catch {
        setOwnerQuota(null);
        setQuotaValue(0);
      }
    };

    fetchOwnerQuota();
  }, [apiUrl, selectedQuotaOwnerId, selectedSchoolId]);

  const runAction = async (fn: () => Promise<void>) => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await fn();
      await loadData();
    } catch (err: any) {
      setError(getErrorMessage(err, 'No se pudo completar la acción'));
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwner = async () => {
    if (!selectedSchoolId || !selectedOwnerTransferId) return;
    await runAction(async () => {
      const token = Cookies.get('token');
      if (!token) throw new Error('Sesión no válida');

      await axios.post(
        `${apiUrl}/api/schools/${selectedSchoolId}/owner/${selectedOwnerTransferId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess('School owner transferido correctamente');
    });
  };

  const handleAssignRole = async () => {
    if (!selectedSchoolId || !selectedRoleUserId || !selectedRole) return;
    await runAction(async () => {
      const token = Cookies.get('token');
      if (!token) throw new Error('Sesión no válida');
      await axios.post(
        `${apiUrl}/api/users/${selectedRoleUserId}/assign-role-in-school`,
        { schoolId: selectedSchoolId, role: selectedRole },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess('Rol asignado correctamente');
    });
  };

  const handleRemoveRole = async () => {
    if (!selectedSchoolId || !selectedRoleUserId || !selectedRole) return;
    await runAction(async () => {
      const token = Cookies.get('token');
      if (!token) throw new Error('Sesión no válida');
      await axios.delete(`${apiUrl}/api/users/${selectedRoleUserId}/school-role`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchoolId, role: selectedRole },
      });
      setSuccess('Rol removido correctamente');
    });
  };

  const handleSaveQuota = async () => {
    if (!selectedSchoolId || !selectedQuotaOwnerId) return;
    await runAction(async () => {
      const token = Cookies.get('token');
      if (!token) throw new Error('Sesión no válida');
      await axios.patch(
        `${apiUrl}/api/users/${selectedQuotaOwnerId}/owner-seat-quota`,
        { schoolId: selectedSchoolId, totalSeats: Math.max(0, Number(quotaValue || 0)) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess('Cuota actualizada');
    });
  };

  const handleAssignSeat = async () => {
    if (!selectedSchoolId || !selectedSeatUserId || !selectedSeatCourseId) return;
    await runAction(async () => {
      const token = Cookies.get('token');
      if (!token) throw new Error('Sesión no válida');
      await axios.post(
        `${apiUrl}/api/users/${selectedSeatUserId}/course-seats`,
        {
          schoolId: selectedSchoolId,
          courseId: selectedSeatCourseId,
          ownerId: selectedSeatOwnerId || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess('Seat asignado');
    });
  };

  const handleRevokeSeat = async () => {
    if (!selectedSchoolId || !selectedSeatUserId || !selectedSeatCourseId) return;
    await runAction(async () => {
      const token = Cookies.get('token');
      if (!token) throw new Error('Sesión no válida');
      await axios.delete(`${apiUrl}/api/users/${selectedSeatUserId}/course-seats`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchoolId, courseId: selectedSeatCourseId },
      });
      setSuccess('Seat revocado');
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    );
  }

  if (!canManagePlatform) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Solo super admin o admin pueden acceder.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <AdminNavigation userRole={userSession?.role} />
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <h1>Control de Plataforma</h1>
          <Link href="/admin/users" className={styles.backLink}>
            Volver a usuarios
          </Link>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.card}>
          <h2>Escuela</h2>
          <div className={styles.chips}>
            {schools.map((school) => (
              <button
                key={school._id}
                type="button"
                className={`${styles.chip} ${
                  selectedSchoolId === school._id ? styles.chipActive : ''
                }`}
                onClick={() => setSelectedSchoolId(school._id)}
              >
                {school.name}
              </button>
            ))}
          </div>
          <input
            className={styles.search}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar usuario por nombre o email"
          />
        </section>

        <section className={styles.card}>
          <h2>Transferir School Owner</h2>
          <p className={styles.muted}>
            Owner actual:{' '}
            {users.find((row) => row._id === currentOwnerId)?.name || 'Sin asignar'}
          </p>
          <select
            className={styles.select}
            value={selectedOwnerTransferId}
            onChange={(event) => setSelectedOwnerTransferId(event.target.value)}
          >
            {ownerCandidates.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name} ({row.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleTransferOwner}
            disabled={saving || !selectedOwnerTransferId || !selectedSchoolId}
          >
            Transferir propietario
          </button>
        </section>

        <section className={styles.card}>
          <h2>Rol por Escuela</h2>
          <select
            className={styles.select}
            value={selectedRoleUserId}
            onChange={(event) => setSelectedRoleUserId(event.target.value)}
          >
            {filteredUsers.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name} ({row.email})
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleAssignRole}
              disabled={saving || !selectedRoleUserId || !selectedSchoolId}
            >
              Asignar rol
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleRemoveRole}
              disabled={saving || !selectedRoleUserId || !selectedSchoolId}
            >
              Quitar rol
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Cuotas por Owner</h2>
          <select
            className={styles.select}
            value={selectedQuotaOwnerId}
            onChange={(event) => setSelectedQuotaOwnerId(event.target.value)}
          >
            {ownersInSchool.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
          </select>
          <p className={styles.muted}>
            Total: {ownerQuota?.totalSeats || 0} | Usados: {ownerQuota?.usedSeats || 0} |
            Disponibles: {ownerQuota?.availableSeats || 0}
          </p>
          <input
            className={styles.input}
            type="number"
            min={0}
            value={quotaValue}
            onChange={(event) => setQuotaValue(Number(event.target.value || 0))}
          />
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSaveQuota}
            disabled={saving || !selectedQuotaOwnerId || !selectedSchoolId}
          >
            Guardar cuota
          </button>
        </section>

        <section className={styles.card}>
          <h2>Asignar / Revocar Seat</h2>
          <select
            className={styles.select}
            value={selectedSeatUserId}
            onChange={(event) => setSelectedSeatUserId(event.target.value)}
          >
            {studentCandidates.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name} ({row.email || row.role})
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={selectedSeatCourseId}
            onChange={(event) => setSelectedSeatCourseId(event.target.value)}
          >
            {schoolCourses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={selectedSeatOwnerId}
            onChange={(event) => setSelectedSeatOwnerId(event.target.value)}
          >
            <option value="">Owner automático</option>
            {ownersInSchool.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
          </select>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleAssignSeat}
              disabled={saving || !selectedSeatUserId || !selectedSeatCourseId}
            >
              Asignar seat
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleRevokeSeat}
              disabled={saving || !selectedSeatUserId || !selectedSeatCourseId}
            >
              Revocar seat
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
