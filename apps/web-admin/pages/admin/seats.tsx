import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import Layout from '../../components/Layout';
import AdminNavigation from '../../components/AdminNavigation';
import dashboardStyles from '../../styles/AdminDashboard.module.css';
import styles from '../../styles/AdminSeats.module.css';

interface DecodedToken {
  sub?: string;
  id?: string;
  name: string;
  email: string;
  role: string;
}

interface SchoolRole {
  schoolId: string;
  role: string;
}

interface School {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  schools?: string[];
  schoolRoles?: SchoolRole[];
  courseSeatGrants?: Array<{
    schoolId: string;
    courseId: string;
    assignedBy: string;
    quotaOwnerId?: string;
    isActive: boolean;
    isConsumed?: boolean;
  }>;
}

interface OwnerSeatQuota {
  ownerId: string;
  schoolId: string;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
}

interface OwnerSeatQuotaReportRow extends OwnerSeatQuota {
  ownerName: string;
  ownerEmail: string;
}

interface SeatPolicyCapabilities {
  canViewSeatManagementModule: boolean;
  canOpenEnrollFlow: boolean;
  canAssignCourseSeatPermit: boolean;
  canSetOwnerQuota: boolean;
  canReadOwnerQuota: boolean;
  canSetOwnerQuotaForTarget: boolean;
  canReadOwnerQuotaForTarget: boolean;
  canEnrollStudentInCourse: boolean;
  canUnenrollStudentFromCourse: boolean;
  canAddStudentToCourse: boolean;
  canRemoveStudentFromCourse: boolean;
}

const DEFAULT_SEAT_CAPABILITIES: SeatPolicyCapabilities = {
  canViewSeatManagementModule: false,
  canOpenEnrollFlow: false,
  canAssignCourseSeatPermit: false,
  canSetOwnerQuota: false,
  canReadOwnerQuota: false,
  canSetOwnerQuotaForTarget: false,
  canReadOwnerQuotaForTarget: false,
  canEnrollStudentInCourse: false,
  canUnenrollStudentFromCourse: false,
  canAddStudentToCourse: false,
  canRemoveStudentFromCourse: false,
};

export default function SeatsManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaInput, setQuotaInput] = useState<number>(0);
  const [ownerQuota, setOwnerQuota] = useState<OwnerSeatQuota | null>(null);
  const [ownerQuotaReportRows, setOwnerQuotaReportRows] = useState<
    OwnerSeatQuotaReportRow[]
  >([]);
  const [ownerQuotaReportTotals, setOwnerQuotaReportTotals] = useState({
    totalSeats: 0,
    usedSeats: 0,
    availableSeats: 0,
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState('');
  const [seatCapabilities, setSeatCapabilities] =
    useState<SeatPolicyCapabilities>(DEFAULT_SEAT_CAPABILITIES);

  const getCurrentUserId = useCallback(() => {
    return user?.id || user?.sub || '';
  }, [user]);

  const sessionRole = (user?.role || '').toLowerCase();
  const selectedSchoolIsValid =
    !!selectedSchool &&
    selectedSchool !== 'all' &&
    selectedSchool !== 'unregistered';
  const effectiveOwnerId =
    sessionRole === 'school_owner' ? getCurrentUserId() : selectedOwnerId;

  const fetchOwnerQuota = useCallback(
    async (ownerId: string, schoolId: string) => {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!token || !ownerId || !schoolId) return null;

      try {
        const response = await axios.get(
          `${apiUrl}/api/users/${ownerId}/owner-seat-quota`,
          {
            params: { schoolId },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        return response.data?.quota || null;
      } catch {
        return null;
      }
    },
    []
  );

  const fetchSeatPolicy = useCallback(async (schoolId?: string) => {
    const token = Cookies.get('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!token) return DEFAULT_SEAT_CAPABILITIES;

    try {
      const response = await axios.get(`${apiUrl}/api/courses/seats/policy`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId },
      });
      return response.data?.capabilities || DEFAULT_SEAT_CAPABILITIES;
    } catch {
      return DEFAULT_SEAT_CAPABILITIES;
    }
  }, []);

  const userBelongsToSchool = useCallback((target: User, schoolId: string) => {
    const inSchools = target.schools?.includes(schoolId) || false;
    const inSchoolRoles =
      target.schoolRoles?.some((role) => role.schoolId === schoolId) || false;
    return inSchools || inSchoolRoles;
  }, []);

  const schoolOwnersForSelectedSchool = useMemo(() => {
    if (!selectedSchoolIsValid) return [];
    return users.filter(
      (candidate) =>
        candidate.role === 'school_owner' &&
        userBelongsToSchool(candidate, selectedSchool)
    );
  }, [users, selectedSchool, selectedSchoolIsValid, userBelongsToSchool]);

  const seatDistributionRows = useMemo(() => {
    if (!selectedSchoolIsValid || !effectiveOwnerId) return [];

    const rows: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      permits: number;
      consumedSeats: number;
      courseIds: string[];
    }> = [];

    users.forEach((row) => {
      const grants = (row.courseSeatGrants || []).filter(
        (grant) =>
          grant.isActive &&
          grant.schoolId === selectedSchool &&
          (grant.quotaOwnerId || grant.assignedBy) === effectiveOwnerId
      );

      if (grants.length > 0) {
        const courseIds = Array.from(
          new Set(grants.map((grant) => grant.courseId))
        );
        rows.push({
          userId: row._id,
          userName: row.name,
          userEmail: row.email,
          permits: grants.length,
          consumedSeats: grants.filter((grant) => grant.isConsumed).length,
          courseIds,
        });
      }
    });

    rows.sort((a, b) => b.permits - a.permits);
    return rows;
  }, [users, selectedSchool, selectedSchoolIsValid, effectiveOwnerId]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        const token = Cookies.get('token');
        if (!token) {
          setError('Sesion no valida');
          setLoading(false);
          return;
        }

        const decoded = jwtDecode<DecodedToken>(token);
        setUser(decoded);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const currentRole = (decoded.role || '').toLowerCase();
        const currentUserId = decoded.id || decoded.sub || '';

        const [allUsersResponse, allSchoolsResponse] = await Promise.all([
          axios.get(`${apiUrl}/api/users`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          currentRole === 'super_admin'
            ? axios.get(`${apiUrl}/api/schools`, {
                headers: { Authorization: `Bearer ${token}` },
              })
            : currentRole === 'school_owner'
              ? axios.get(
                  `${apiUrl}/api/users/${currentUserId}/owned-schools`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                )
              : axios.get(
                  `${apiUrl}/api/users/${currentUserId}/administered-schools`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                ),
        ]);

        const loadedUsers =
          allUsersResponse.data?.users || allUsersResponse.data || [];
        const loadedSchools = allSchoolsResponse.data || [];
        setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
        setSchools(Array.isArray(loadedSchools) ? loadedSchools : []);

        if (loadedSchools.length > 0) {
          setSelectedSchool(loadedSchools[0]._id);
        }
      } catch {
        setError('No se pudieron cargar los datos del modulo de cupos');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const loadPolicy = async () => {
      const policy = await fetchSeatPolicy(
        selectedSchoolIsValid ? selectedSchool : undefined
      );
      setSeatCapabilities(policy);
    };

    loadPolicy();
  }, [fetchSeatPolicy, selectedSchool, selectedSchoolIsValid]);

  useEffect(() => {
    if (sessionRole === 'school_owner') {
      setSelectedOwnerId(getCurrentUserId());
      return;
    }

    if (!selectedSchoolIsValid) {
      setSelectedOwnerId('');
      return;
    }

    if (!selectedOwnerId && schoolOwnersForSelectedSchool.length > 0) {
      setSelectedOwnerId(schoolOwnersForSelectedSchool[0]._id);
    }
  }, [
    sessionRole,
    getCurrentUserId,
    selectedSchoolIsValid,
    selectedOwnerId,
    schoolOwnersForSelectedSchool,
  ]);

  useEffect(() => {
    const loadQuota = async () => {
      if (!selectedSchoolIsValid || !effectiveOwnerId) {
        setOwnerQuota(null);
        setQuotaInput(0);
        return;
      }
      const quota = await fetchOwnerQuota(effectiveOwnerId, selectedSchool);
      setOwnerQuota(quota);
      setQuotaInput(Number(quota?.totalSeats || 0));
    };

    loadQuota();
  }, [
    selectedSchoolIsValid,
    effectiveOwnerId,
    selectedSchool,
    fetchOwnerQuota,
  ]);

  useEffect(() => {
    const loadQuotaReport = async () => {
      if (!selectedSchoolIsValid) {
        setOwnerQuotaReportRows([]);
        setOwnerQuotaReportTotals({
          totalSeats: 0,
          usedSeats: 0,
          availableSeats: 0,
        });
        return;
      }

      try {
        setReportLoading(true);
        const token = Cookies.get('token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.get(
          `${apiUrl}/api/users/owner-seat-quotas/report`,
          {
            params: { schoolId: selectedSchool },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setOwnerQuotaReportRows(response.data?.owners || []);
        setOwnerQuotaReportTotals(
          response.data?.totals || {
            totalSeats: 0,
            usedSeats: 0,
            availableSeats: 0,
          }
        );
      } catch {
        setOwnerQuotaReportRows([]);
        setOwnerQuotaReportTotals({
          totalSeats: 0,
          usedSeats: 0,
          availableSeats: 0,
        });
      } finally {
        setReportLoading(false);
      }
    };

    loadQuotaReport();
  }, [selectedSchoolIsValid, selectedSchool]);

  const saveOwnerQuota = async () => {
    if (
      !selectedSchoolIsValid ||
      !effectiveOwnerId ||
      !seatCapabilities.canSetOwnerQuota
    )
      return;
    try {
      setQuotaLoading(true);
      setError('');
      setSuccess('');
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await axios.patch(
        `${apiUrl}/api/users/${effectiveOwnerId}/owner-seat-quota`,
        {
          schoolId: selectedSchool,
          totalSeats: Math.max(0, Number(quotaInput || 0)),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedQuota = response.data?.quota || null;
      setOwnerQuota(updatedQuota);
      setQuotaInput(Number(updatedQuota?.totalSeats || quotaInput));
      setSuccess('Cupos actualizados correctamente');
    } catch {
      setError('No se pudieron actualizar los cupos');
    } finally {
      setQuotaLoading(false);
    }
  };

  const handleRevokeUserPermits = async (row: {
    userId: string;
    userName: string;
    courseIds: string[];
  }) => {
    if (!selectedSchoolIsValid || !row.courseIds.length) return;
    const confirmed = window.confirm(
      `Se revocaran ${row.courseIds.length} permisos de cupo para ${row.userName}. Continuar?`
    );
    if (!confirmed) return;

    try {
      setRevokingUserId(row.userId);
      setError('');
      setSuccess('');
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      await Promise.all(
        row.courseIds.map((courseId) =>
          axios.delete(`${apiUrl}/api/users/${row.userId}/course-seats`, {
            params: { schoolId: selectedSchool, courseId },
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );

      const usersResponse = await axios.get(`${apiUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshedUsers =
        usersResponse.data?.users || usersResponse.data || [];
      setUsers(Array.isArray(refreshedUsers) ? refreshedUsers : []);

      if (effectiveOwnerId) {
        const refreshedQuota = await fetchOwnerQuota(
          effectiveOwnerId,
          selectedSchool
        );
        setOwnerQuota(refreshedQuota);
        setQuotaInput(Number(refreshedQuota?.totalSeats || 0));
      }

      const reportResponse = await axios.get(
        `${apiUrl}/api/users/owner-seat-quotas/report`,
        {
          params: { schoolId: selectedSchool },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setOwnerQuotaReportRows(reportResponse.data?.owners || []);
      setOwnerQuotaReportTotals(
        reportResponse.data?.totals || {
          totalSeats: 0,
          usedSeats: 0,
          availableSeats: 0,
        }
      );

      setSuccess(
        `Permisos de cupo revocados para ${row.userName}. Los seats quedaron disponibles nuevamente.`
      );
    } catch {
      setError('No se pudieron revocar los permisos de cupo');
    } finally {
      setRevokingUserId('');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={dashboardStyles.loading}>
          Cargando gestion de cupos...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={dashboardStyles.container}>
        <div className={dashboardStyles.dashboardHeader}>
          <h1>Gestion de Cupos</h1>
          <p>
            Asigna cupos a school owners y visualiza como se estan repartiendo
            por usuario.
          </p>
        </div>

        <div className={dashboardStyles.content}>
          <AdminNavigation userRole={user?.role} />

          <div className={dashboardStyles.mainContent}>
            {!seatCapabilities.canViewSeatManagementModule ? (
              <div className={styles.noticeCard}>
                No tienes permisos para ver este modulo.
              </div>
            ) : (
              <>
                <div className={styles.controlCard}>
                  <div className={styles.controlRow}>
                    <div className={styles.controlField}>
                      <label>Escuela</label>
                      <select
                        className={styles.select}
                        value={selectedSchool}
                        onChange={(event) =>
                          setSelectedSchool(event.target.value)
                        }
                      >
                        <option value="">Selecciona una escuela</option>
                        {schools.map((school) => (
                          <option key={school._id} value={school._id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {sessionRole !== 'school_owner' && (
                      <div className={styles.controlField}>
                        <label>School Owner</label>
                        <select
                          className={styles.select}
                          value={selectedOwnerId}
                          onChange={(event) =>
                            setSelectedOwnerId(event.target.value)
                          }
                          disabled={!selectedSchoolIsValid}
                        >
                          <option value="">Selecciona un owner</option>
                          {schoolOwnersForSelectedSchool.map((owner) => (
                            <option key={owner._id} value={owner._id}>
                              {owner.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {seatCapabilities.canReadOwnerQuota && (
                  <div className={styles.statsCard}>
                    <span>
                      Total: <strong>{ownerQuota?.totalSeats ?? 0}</strong>
                    </span>
                    <span>
                      Usados: <strong>{ownerQuota?.usedSeats ?? 0}</strong>
                    </span>
                    <span>
                      Disponibles:{' '}
                      <strong>{ownerQuota?.availableSeats ?? 0}</strong>
                    </span>
                  </div>
                )}

                {seatCapabilities.canSetOwnerQuota && (
                  <div className={styles.controlCard}>
                    <div className={styles.controlRow}>
                      <div className={styles.controlField}>
                        <label>Cupos asignados al owner</label>
                        <input
                          className={styles.input}
                          type="number"
                          min={0}
                          value={quotaInput}
                          disabled={!effectiveOwnerId || !selectedSchoolIsValid}
                          onChange={(event) =>
                            setQuotaInput(
                              Math.max(0, Number(event.target.value || 0))
                            )
                          }
                        />
                      </div>
                      <button
                        className={styles.primaryButton}
                        disabled={
                          !effectiveOwnerId ||
                          !selectedSchoolIsValid ||
                          quotaLoading
                        }
                        onClick={saveOwnerQuota}
                      >
                        {quotaLoading ? 'Guardando...' : 'Guardar Cupos'}
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.tableCard}>
                  <h3>Distribucion de cupos</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Permisos</th>
                        <th>Cupos consumidos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seatDistributionRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={styles.emptyCell}>
                            No hay cupos repartidos para el owner/escuela
                            seleccionados.
                          </td>
                        </tr>
                      ) : (
                        seatDistributionRows.map((row) => (
                          <tr key={row.userId}>
                            <td>{row.userName}</td>
                            <td>{row.userEmail}</td>
                            <td>{row.permits}</td>
                            <td>{row.consumedSeats}</td>
                            <td>
                              <button
                                className={styles.dangerButton}
                                disabled={revokingUserId === row.userId}
                                onClick={() => handleRevokeUserPermits(row)}
                              >
                                {revokingUserId === row.userId
                                  ? 'Revocando...'
                                  : 'Quitar asignaciones'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.tableCard}>
                  <h3>Reporte de cupos por school owner</h3>
                  <div className={styles.statsCard}>
                    <span>
                      Total:{' '}
                      <strong>{ownerQuotaReportTotals.totalSeats}</strong>
                    </span>
                    <span>
                      Usados:{' '}
                      <strong>{ownerQuotaReportTotals.usedSeats}</strong>
                    </span>
                    <span>
                      Disponibles:{' '}
                      <strong>{ownerQuotaReportTotals.availableSeats}</strong>
                    </span>
                  </div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Owner</th>
                        <th>Email</th>
                        <th>Total</th>
                        <th>Usados</th>
                        <th>Disponibles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLoading ? (
                        <tr>
                          <td colSpan={5} className={styles.emptyCell}>
                            Cargando reporte...
                          </td>
                        </tr>
                      ) : ownerQuotaReportRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={styles.emptyCell}>
                            No hay school owners con cupos en esta escuela.
                          </td>
                        </tr>
                      ) : (
                        ownerQuotaReportRows.map((row) => (
                          <tr key={row.ownerId}>
                            <td>{row.ownerName}</td>
                            <td>{row.ownerEmail}</td>
                            <td>{row.totalSeats}</td>
                            <td>{row.usedSeats}</td>
                            <td>{row.availableSeats}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {error && <div className={styles.error}>{error}</div>}
                {success && <div className={styles.success}>{success}</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
