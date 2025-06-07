import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Admin.module.css';
import Layout from '../../components/Layout';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import { FaUpload, FaDownload, FaEye, FaCheck, FaTimes, FaSpinner, FaExclamationTriangle, FaSchool, FaUsers, FaChalkboardTeacher } from 'react-icons/fa';

interface School {
  _id: string;
  name: string;
}

interface BulkUploadData {
  curso: string;
  profe: string;
  estudiante: string;
  edad?: number;
  email?: string;
  celular?: string;
  estado?: string;
}

interface BulkUploadResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  createdUsers: number;
  createdCourses: number;
  createdTeachers: number;
  enrollments: number;
}

interface BulkUploadConfig {
  schoolId: string;
  createMissingCourses: boolean;
  createMissingTeachers: boolean;
  studentType: 'assistant' | 'registered';
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const { handleApiError } = useApiErrorHandler();
  
  // State
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<BulkUploadData[]>([]);
  const [config, setConfig] = useState<BulkUploadConfig>({
    schoolId: '',
    createMissingCourses: true,
    createMissingTeachers: true,
    studentType: 'assistant'
  });
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');

  // Auth check
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setUser(decoded);
      
      if (!['admin', 'super_admin', 'school_owner'].includes(decoded.role)) {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error al decodificar token:', error);
      router.push('/login');
      return;
    }
  }, [router]);

  // Load schools
  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.get(`${apiUrl}/api/schools`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSchools(response.data);
      
      // Auto-select first school if only one
      if (response.data.length === 1) {
        setConfig(prev => ({ ...prev, schoolId: response.data[0]._id }));
      }
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (user) {
      fetchSchools();
    }
  }, [user, fetchSchools]);

  // File upload handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData([]);
      setResult(null);
      setStep('upload');
      setError('');
      setSuccess('');
    }
  };

  // Preview Excel data
  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Por favor selecciona un archivo Excel');
      return;
    }

    if (!config.schoolId) {
      setError('Por favor selecciona una escuela');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.post(`${apiUrl}/api/bulk-upload/parse-excel`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setPreviewData(response.data.data);
      setStep('preview');
      setSuccess(`Archivo analizado correctamente: ${response.data.totalRows} filas encontradas`);
      
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  // Process bulk upload
  const handleProcess = async () => {
    if (!selectedFile || !config.schoolId) {
      setError('Faltan datos requeridos');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('schoolId', config.schoolId);
      formData.append('createMissingCourses', config.createMissingCourses.toString());
      formData.append('createMissingTeachers', config.createMissingTeachers.toString());
      formData.append('studentType', config.studentType);
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.post(`${apiUrl}/api/bulk-upload/process`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setResult(response.data.result);
      setStep('result');
      setSuccess(response.data.message);
      
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setProcessing(false);
    }
  };

  // Reset to start
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setResult(null);
    setStep('upload');
    setError('');
    setSuccess('');
  };

  if (!user) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <Layout>
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>
              <FaUpload style={{ marginRight: '10px' }} />
              Carga Masiva de Asistentes
            </h1>
            <p className={styles.subtitle}>
              Importa estudiantes y cursos desde un archivo Excel
            </p>
          </div>

          {error && (
            <div className={styles.error}>
              <FaExclamationTriangle style={{ marginRight: '8px' }} />
              {error}
            </div>
          )}

          {success && (
            <div className={styles.success}>
              <FaCheck style={{ marginRight: '8px' }} />
              {success}
            </div>
          )}

          {/* Step 1: Upload Configuration */}
          {step === 'upload' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <FaSchool style={{ marginRight: '8px' }} />
                Configuración de Carga
              </h2>

              <div className={styles.formGroup}>
                <label htmlFor="school">Escuela de Destino:</label>
                <select
                  id="school"
                  value={config.schoolId}
                  onChange={(e) => setConfig(prev => ({ ...prev, schoolId: e.target.value }))}
                  className={styles.select}
                  required
                >
                  <option value="">Seleccionar escuela...</option>
                  {schools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="studentType">Tipo de Estudiante:</label>
                <select
                  id="studentType"
                  value={config.studentType}
                  onChange={(e) => setConfig(prev => ({ ...prev, studentType: e.target.value as 'assistant' | 'registered' }))}
                  className={styles.select}
                >
                  <option value="assistant">Asistentes (No registrados)</option>
                  <option value="registered">Usuarios Registrados</option>
                </select>
                <small className={styles.helpText}>
                  Los asistentes solo aparecen en asistencia. Los registrados pueden acceder a la plataforma.
                </small>
              </div>

              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.createMissingCourses}
                    onChange={(e) => setConfig(prev => ({ ...prev, createMissingCourses: e.target.checked }))}
                  />
                  Crear cursos si no existen
                </label>
                
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.createMissingTeachers}
                    onChange={(e) => setConfig(prev => ({ ...prev, createMissingTeachers: e.target.checked }))}
                  />
                  Crear profesores si no existen
                </label>
              </div>

              <div className={styles.uploadArea}>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                  id="excel-file"
                />
                <label htmlFor="excel-file" className={styles.uploadLabel}>
                  <FaUpload size={24} />
                  <span>
                    {selectedFile ? selectedFile.name : 'Seleccionar archivo Excel'}
                  </span>
                </label>
                <small className={styles.helpText}>
                  Formatos soportados: .xlsx, .xls (máximo 10MB)
                </small>
              </div>

              <div className={styles.formActions}>
                <button
                  onClick={handlePreview}
                  disabled={!selectedFile || !config.schoolId || loading}
                  className={styles.primaryButton}
                >
                  {loading ? (
                    <>
                      <FaSpinner className={styles.spinner} />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <FaEye style={{ marginRight: '8px' }} />
                      Vista Previa
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview Data */}
          {step === 'preview' && previewData.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <FaEye style={{ marginRight: '8px' }} />
                Vista Previa de Datos
              </h2>
              
              <div className={styles.previewSummary}>
                <p><strong>Total de filas:</strong> {previewData.length}</p>
                <p><strong>Escuela:</strong> {schools.find(s => s._id === config.schoolId)?.name}</p>
                <p><strong>Tipo:</strong> {config.studentType === 'assistant' ? 'Asistentes' : 'Usuarios Registrados'}</p>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Profesor</th>
                      <th>Estudiante</th>
                      <th>Edad</th>
                      <th>Email</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        <td>{row.curso}</td>
                        <td>{row.profe}</td>
                        <td>{row.estudiante}</td>
                        <td>{row.edad || '-'}</td>
                        <td>{row.email || '-'}</td>
                        <td>{row.estado || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 10 && (
                  <p className={styles.moreRows}>
                    Y {previewData.length - 10} filas más...
                  </p>
                )}
              </div>

              <div className={styles.formActions}>
                <button
                  onClick={() => setStep('upload')}
                  className={styles.secondaryButton}
                >
                  <FaTimes style={{ marginRight: '8px' }} />
                  Volver
                </button>
                
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className={styles.primaryButton}
                >
                  {processing ? (
                    <>
                      <FaSpinner className={styles.spinner} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FaCheck style={{ marginRight: '8px' }} />
                      Procesar Carga
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'result' && result && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <FaCheck style={{ marginRight: '8px' }} />
                Resultados de la Carga
              </h2>

              <div className={styles.resultSummary}>
                <div className={styles.resultCard}>
                  <FaUsers className={styles.resultIcon} />
                  <div>
                    <h3>{result.successCount}</h3>
                    <p>Procesados exitosamente</p>
                  </div>
                </div>
                
                <div className={styles.resultCard}>
                  <FaUsers className={styles.resultIcon} />
                  <div>
                    <h3>{result.createdUsers}</h3>
                    <p>Estudiantes creados</p>
                  </div>
                </div>
                
                <div className={styles.resultCard}>
                  <FaChalkboardTeacher className={styles.resultIcon} />
                  <div>
                    <h3>{result.createdTeachers}</h3>
                    <p>Profesores creados</p>
                  </div>
                </div>
                
                <div className={styles.resultCard}>
                  <FaSchool className={styles.resultIcon} />
                  <div>
                    <h3>{result.createdCourses}</h3>
                    <p>Cursos creados</p>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className={styles.errorSection}>
                  <h3>Errores Encontrados ({result.errors.length})</h3>
                  <div className={styles.errorList}>
                    {result.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className={styles.errorItem}>
                        <strong>Fila {error.row}:</strong> {error.error}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <p>Y {result.errors.length - 10} errores más...</p>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.formActions}>
                <button
                  onClick={handleReset}
                  className={styles.primaryButton}
                >
                  <FaUpload style={{ marginRight: '8px' }} />
                  Nueva Carga
                </button>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className={styles.helpSection}>
            <h3>Formato del Archivo Excel</h3>
            <p>El archivo debe contener las siguientes columnas:</p>
            <ul>
              <li><strong>CURSO:</strong> Nombre del curso (requerido)</li>
              <li><strong>PROFE:</strong> Nombre del profesor (requerido)</li>
              <li><strong>ESTUDIANTE:</strong> Nombre del estudiante (requerido)</li>
              <li><strong>EDAD:</strong> Edad del estudiante (opcional)</li>
              <li><strong>CORREO:</strong> Email del estudiante (opcional)</li>
              <li><strong>CELULAR:</strong> Teléfono del estudiante (opcional)</li>
              <li><strong>ESTADO:</strong> Estado del estudiante (opcional)</li>
            </ul>
          </div>
        </main>
      </div>
    </Layout>
  );
} 