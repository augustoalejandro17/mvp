import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Layout from '../../components/Layout';
import AdminNavigation from '../../components/AdminNavigation';
import styles from '../../styles/AdminInsights.module.css';
import dashboardStyles from '../../styles/AdminDashboard.module.css';

interface DecodedToken {
  sub: string;
  id?: string;
  email: string;
  name: string;
  role: string;
}

interface FunnelResponse {
  periodDays: number;
  since: string;
  steps: {
    authLoginSuccess: number;
    onboardingStarted: number;
    onboardingCompleted: number;
  };
  conversion: {
    loginToOnboardingStartPct: number;
    onboardingStartToCompletedPct: number;
  };
}

interface AuditLogItem {
  _id: string;
  action: string;
  actorId: string;
  actorEmail?: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AuditLogsResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ADMIN_ROLES = ['super_admin', 'school_owner', 'administrative', 'admin'];

export default function AdminInsightsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState(30);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogsResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditTargetType, setAuditTargetType] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/');
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      const role = decoded.role?.toLowerCase();
      if (!ADMIN_ROLES.some((adminRole) => role.includes(adminRole))) {
        router.push('/admin/dashboard');
        return;
      }

      setUser(decoded);
    } catch (authError) {
      console.error('Error decoding token:', authError);
      setError('No se pudo validar la sesión.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const authHeaders = useMemo(() => {
    const token = Cookies.get('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadFunnel = async () => {
    if (!apiUrl) return;
    try {
      setFunnelLoading(true);
      const response = await axios.get<FunnelResponse>(
        `${apiUrl}/api/product-analytics/funnel`,
        {
          params: { days },
          headers: authHeaders,
        },
      );
      setFunnel(response.data);
    } catch (funnelError) {
      console.error('Error loading funnel:', funnelError);
      setError('No se pudo cargar el embudo de producto.');
    } finally {
      setFunnelLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!apiUrl) return;
    try {
      setAuditLoading(true);
      const response = await axios.get<AuditLogsResponse>(
        `${apiUrl}/api/audit-logs`,
        {
          params: {
            page: auditPage,
            limit: 15,
            action: auditAction || undefined,
            targetType: auditTargetType || undefined,
          },
          headers: authHeaders,
        },
      );
      setAuditLogs(response.data);
    } catch (auditError) {
      console.error('Error loading audit logs:', auditError);
      setError('No se pudo cargar la auditoría.');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadFunnel();
  }, [user, days]);

  useEffect(() => {
    if (!user) return;
    loadAuditLogs();
  }, [user, auditPage, auditAction, auditTargetType]);

  if (loading) {
    return (
      <Layout>
        <div className={styles.container}>
          <p>Cargando insights...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={`${dashboardStyles.dashboardHeader} ${dashboardStyles.dashboardHeaderCompact}`}>
          <h1>Insights</h1>
          <p>Auditoría operativa y embudo de onboarding.</p>
        </div>

        <div className={styles.content}>
          <AdminNavigation userRole={user?.role || 'admin'} />
          <main className={styles.main}>
            {error && <p className={styles.error}>{error}</p>}

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Embudo de Producto</h2>
                <div className={styles.controls}>
                  <select
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10))}
                    className={styles.select}
                  >
                    <option value={7}>Últimos 7 días</option>
                    <option value={30}>Últimos 30 días</option>
                    <option value={90}>Últimos 90 días</option>
                  </select>
                  <button onClick={loadFunnel} className={styles.button}>
                    Recargar
                  </button>
                </div>
              </div>

              {funnelLoading ? (
                <p>Cargando embudo...</p>
              ) : funnel ? (
                <div className={styles.funnelGrid}>
                  <article className={styles.metric}>
                    <span>Logins</span>
                    <strong>{funnel.steps.authLoginSuccess}</strong>
                  </article>
                  <article className={styles.metric}>
                    <span>Onboarding iniciado</span>
                    <strong>{funnel.steps.onboardingStarted}</strong>
                  </article>
                  <article className={styles.metric}>
                    <span>Onboarding completado</span>
                    <strong>{funnel.steps.onboardingCompleted}</strong>
                  </article>
                  <article className={styles.metric}>
                    <span>Login → Inicio</span>
                    <strong>{funnel.conversion.loginToOnboardingStartPct}%</strong>
                  </article>
                  <article className={styles.metric}>
                    <span>Inicio → Completado</span>
                    <strong>
                      {funnel.conversion.onboardingStartToCompletedPct}%
                    </strong>
                  </article>
                </div>
              ) : (
                <p>Sin datos de embudo.</p>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Auditoría</h2>
                <div className={styles.controls}>
                  <input
                    value={auditAction}
                    onChange={(e) => {
                      setAuditPage(1);
                      setAuditAction(e.target.value);
                    }}
                    placeholder="Filtrar por acción"
                    className={styles.input}
                  />
                  <input
                    value={auditTargetType}
                    onChange={(e) => {
                      setAuditPage(1);
                      setAuditTargetType(e.target.value);
                    }}
                    placeholder="Filtrar por targetType"
                    className={styles.input}
                  />
                  <button onClick={loadAuditLogs} className={styles.button}>
                    Recargar
                  </button>
                </div>
              </div>

              {auditLoading ? (
                <p>Cargando auditoría...</p>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Acción</th>
                          <th>Actor</th>
                          <th>Target</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs?.items?.length ? (
                          auditLogs.items.map((item) => (
                            <tr key={item._id}>
                              <td>{new Date(item.createdAt).toLocaleString()}</td>
                              <td>{item.action}</td>
                              <td>{item.actorEmail || item.actorId}</td>
                              <td>
                                {item.targetType}
                                {item.targetId ? `:${item.targetId}` : ''}
                              </td>
                              <td className={styles.metadata}>
                                {item.metadata
                                  ? JSON.stringify(item.metadata)
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5}>Sin eventos para los filtros actuales.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.pagination}>
                    <button
                      className={styles.button}
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={!auditLogs || auditLogs.page <= 1}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {auditLogs?.page || 1} de {auditLogs?.totalPages || 1}
                    </span>
                    <button
                      className={styles.button}
                      onClick={() =>
                        setAuditPage((p) =>
                          auditLogs ? Math.min(auditLogs.totalPages, p + 1) : p + 1,
                        )
                      }
                      disabled={
                        !auditLogs || auditLogs.page >= auditLogs.totalPages
                      }
                    >
                      Siguiente
                    </button>
                  </div>
                </>
              )}
            </section>
          </main>
        </div>
      </div>
    </Layout>
  );
}
