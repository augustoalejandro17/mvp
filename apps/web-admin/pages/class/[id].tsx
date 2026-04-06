import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import Layout from '../../components/Layout';
import LazyVideoLoader from '../../components/LazyVideoLoader';
import VideoPlayerWithTracking from '../../components/VideoPlayerWithTracking';
import styles from '../../styles/ClassDetail.module.css';
import { UserRole } from '../../types/user';
import { canModifyClass, canManageVideos, canDownloadVideos } from '../../utils/permission-utils';
import api from '../../utils/api-client';
import VideoJSPlayer from '../../components/VideoJSPlayer';
import SimpleVideoPlayer from '../../components/SimpleVideoPlayer';

interface SubmissionAuthor {
  _id?: string;
  name?: string;
  email?: string;
}

interface SubmissionAnnotation {
  _id: string;
  timestampSeconds: number;
  text: string;
  author?: SubmissionAuthor;
  createdAt: string;
}

interface ClassSubmission {
  _id: string;
  student?: SubmissionAuthor;
  videoUrl?: string | null;
  videoStatus: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';
  reviewStatus: 'SUBMITTED' | 'REVIEWED' | 'NEEDS_RESUBMISSION';
  videoProcessingError?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

// Interfaces
interface Class {
  _id: string;
  title: string;
  description: string;
  courseId: string;
  order: number;
  videoUrl: string;
  createdBy: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  isPublic: boolean;
  course?: {
    _id: string;
    title: string;
    school: {
      _id: string;
      name: string;
    };
  };
}

interface DecodedToken {
  userId: string;
  email: string;
  role: UserRole | string;
  iat: number;
  exp: number;
}

const ClassDetail: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [useSimplePlayer, setUseSimplePlayer] = useState(false);
  const [submissions, setSubmissions] = useState<ClassSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionAnnotations, setSubmissionAnnotations] = useState<SubmissionAnnotation[]>([]);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(0);
  const [annotationText, setAnnotationText] = useState('');
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [submissionTime, setSubmissionTime] = useState(0);
  const [submissionDuration, setSubmissionDuration] = useState(0);

  const selectedSubmission = submissions.find(
    (submission) => submission._id === selectedSubmissionId,
  ) ?? null;

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return false;
      }

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setUserRole(decoded.role);
        setUserId(decoded.userId);
        
        return true;
      } catch (err) {
        Cookies.remove('token');
        router.push('/login');
        return false;
      }
    };

    const fetchClassData = async () => {
      if (!id || !checkAuth()) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/classes/${id}`, {
          headers: {
            'Authorization': `Bearer ${Cookies.get('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch class data');
        }
        
        const data = await response.json();
        
        // If we have courseId, fetch course information for gamification
        if (data.courseId) {
          try {
            const courseResponse = await fetch(`/api/courses/${data.courseId}`, {
              headers: {
                'Authorization': `Bearer ${Cookies.get('token')}`
              }
            });
            
            if (courseResponse.ok) {
              const courseData = await courseResponse.json();
              data.course = {
                _id: courseData._id,
                title: courseData.title,
                school: courseData.school
              };
            }
          } catch (courseErr) {
            console.warn('Could not fetch course information:', courseErr);
          }
        }
        
        setClassData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClassData();
    }
  }, [id, router]);

  const handleDeleteClass = async () => {
    if (!classData) return;
    
    const confirmDelete = confirm('Are you sure you want to delete this class?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/classes/${classData._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Cookies.get('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete class');
      }
      
      router.push(`/course/${classData.courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleTogglePublic = async () => {
    if (!classData) return;

    try {
      const response = await fetch(`/api/classes/${classData._id}/toggle-public`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${Cookies.get('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isPublic: !classData.isPublic
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update class visibility');
      }
      
      const updatedClass = await response.json();
      setClassData(updatedClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const isClassTeacher = useCallback((): boolean => {
    if (!classData || !userId) {
      return false;
    }
    
    // Check if createdBy exists and has an _id
    if (!classData.createdBy || !classData.createdBy._id) {
      return false;
    }
    
    const result = classData.createdBy._id === userId;
    return result;
  }, [classData, userId]);

  const canModify = useCallback((): boolean => {
    if (!userRole) return false;
    const result = canModifyClass(userRole, isClassTeacher());
    
    return result;
  }, [userRole, isClassTeacher]);

  const canManageVideo = useCallback((): boolean => {
    if (!userRole) return false;
    const result = canDownloadVideos(userRole); // Use more restrictive download permission
    
    return result;
  }, [userRole]);

  const canReviewSubmissions = useCallback((): boolean => {
    if (!userRole) return false;
    return canManageVideos(userRole) || canModifyClass(userRole, isClassTeacher());
  }, [userRole, isClassTeacher]);

  const formatSeconds = (value: number): string => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const minutes = Math.floor(safeValue / 60);
    const seconds = safeValue % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const loadSubmissions = useCallback(async () => {
    if (!id || !canReviewSubmissions()) {
      setSubmissions([]);
      setSelectedSubmissionId(null);
      return;
    }

    try {
      setSubmissionLoading(true);
      const response = await api.get(`/class-submissions/class/${id}`);
      const items = Array.isArray(response.data) ? response.data : [];
      setSubmissions(items);
      setSelectedSubmissionId((current) => {
        if (current && items.some((item) => item._id === current)) {
          return current;
        }
        return items[0]?._id ?? null;
      });
    } catch (submissionError) {
      console.error('Could not fetch class submissions:', submissionError);
      setSubmissions([]);
      setSelectedSubmissionId(null);
    } finally {
      setSubmissionLoading(false);
    }
  }, [id, canReviewSubmissions]);

  const loadSubmissionAnnotations = useCallback(async (submissionId: string) => {
    try {
      setAnnotationsLoading(true);
      const response = await api.get(`/class-submissions/${submissionId}/annotations`);
      setSubmissionAnnotations(Array.isArray(response.data) ? response.data : []);
    } catch (annotationError) {
      console.error('Could not fetch submission annotations:', annotationError);
      setSubmissionAnnotations([]);
    } finally {
      setAnnotationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!classData || !canReviewSubmissions()) {
      return;
    }

    loadSubmissions();
  }, [classData, canReviewSubmissions, loadSubmissions]);

  useEffect(() => {
    if (!selectedSubmissionId) {
      setSubmissionAnnotations([]);
      setSelectedTimestamp(0);
      setSubmissionTime(0);
      setSubmissionDuration(0);
      setAnnotationText('');
      setEditingAnnotationId(null);
      return;
    }

    setAnnotationText('');
    setEditingAnnotationId(null);
    loadSubmissionAnnotations(selectedSubmissionId);
  }, [selectedSubmissionId, loadSubmissionAnnotations]);

  const handleCreateAnnotation = async () => {
    if (!selectedSubmissionId || !annotationText.trim()) {
      return;
    }

    try {
      if (editingAnnotationId) {
        await api.patch(
          `/class-submissions/${selectedSubmissionId}/annotations/${editingAnnotationId}`,
          {
            timestampSeconds: selectedTimestamp,
            text: annotationText.trim(),
          },
        );
      } else {
        await api.post(`/class-submissions/${selectedSubmissionId}/annotations`, {
          timestampSeconds: selectedTimestamp,
          text: annotationText.trim(),
        });
      }
      setAnnotationText('');
      setEditingAnnotationId(null);
      await loadSubmissionAnnotations(selectedSubmissionId);
      await loadSubmissions();
    } catch (annotationError) {
      console.error('Could not create annotation:', annotationError);
      alert('No se pudo guardar la anotación.');
    }
  };

  const handleUpdateReviewStatus = async (
    reviewStatus: 'REVIEWED' | 'NEEDS_RESUBMISSION' | 'SUBMITTED',
  ) => {
    if (!selectedSubmissionId) {
      return;
    }

    try {
      await api.patch(`/class-submissions/${selectedSubmissionId}/review-status`, {
        reviewStatus,
      });
      await loadSubmissions();
    } catch (reviewError) {
      console.error('Could not update review status:', reviewError);
      alert('No se pudo actualizar el estado de revisión.');
    }
  };

  const jumpToTimestamp = (timestampSeconds: number) => {
    const video = document.getElementById(
      'submission-review-video',
    ) as HTMLVideoElement | null;
    if (!video) {
      return;
    }

    video.currentTime = timestampSeconds;
    void video.play().catch(() => undefined);
  };

  const startEditingAnnotation = (annotation: SubmissionAnnotation) => {
    setEditingAnnotationId(annotation._id);
    setSelectedTimestamp(annotation.timestampSeconds);
    setAnnotationText(annotation.text);
  };

  const cancelEditingAnnotation = () => {
    setEditingAnnotationId(null);
    setAnnotationText('');
  };

  const deleteAnnotation = async (annotationId: string) => {
    if (!selectedSubmissionId) {
      return;
    }

    const confirmed = confirm('¿Eliminar esta anotación?');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/class-submissions/${selectedSubmissionId}/annotations/${annotationId}`,
      );
      if (editingAnnotationId === annotationId) {
        cancelEditingAnnotation();
      }
      await loadSubmissionAnnotations(selectedSubmissionId);
    } catch (annotationError) {
      console.error('Could not delete annotation:', annotationError);
      alert('No se pudo eliminar la anotación.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>Loading class information...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className={styles.error}>{error}</div>
      </Layout>
    );
  }

  if (!classData) {
    return (
      <Layout>
        <div className={styles.error}>Class not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.classDetail}>
        <h1 className={styles.title}>{classData.title}</h1>
        
        {classData.videoUrl && (
          <div className={styles.videoContainer}>
            {videoLoadError ? (
              <div style={{
                padding: "20px", 
                textAlign: "center",
                background: "#000",
                borderRadius: "8px",
                minHeight: "300px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center"
              }}>
                <div style={{color: "#e53e3e", fontSize: "48px", marginBottom: "20px"}}>⚠️</div>
                <p style={{color: "white", marginBottom: "20px", fontSize: "18px", fontWeight: "bold"}}>Error cargando video</p>
                <p style={{color: "#a0aec0", fontSize: "14px", marginBottom: "20px"}}>El reproductor no pudo cargar el video</p>
                
                <div style={{display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center"}}>
                  <button 
                    onClick={() => {
                      console.log('Trying simple player fallback');
                      setUseSimplePlayer(true);
                      setVideoLoadError(false);
                    }}
                    style={{
                      background: "#10b981", 
                      color: "white", 
                      padding: "10px 15px", 
                      borderRadius: "4px", 
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    Usar reproductor simple
                  </button>
                  
                  <button 
                    onClick={() => {
                      console.log('Retrying advanced player');
                      setVideoLoadError(false);
                      setUseSimplePlayer(false);
                    }}
                    style={{
                      background: "#3182ce", 
                      color: "white", 
                      padding: "10px 15px", 
                      borderRadius: "4px", 
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    Reintentar
                  </button>
                  
                  <a 
                    href={classData.videoUrl} 
                    target="_blank"
                    style={{
                      background: "#6b7280", 
                      color: "white", 
                      padding: "10px 15px", 
                      borderRadius: "4px", 
                      textDecoration: "none", 
                      fontWeight: "bold"
                    }}
                  >
                    Abrir en nueva pestaña
                  </a>
                </div>
              </div>
            ) : useSimplePlayer ? (
              <div style={{position: "relative"}}>
                <SimpleVideoPlayer
                  src={classData.videoUrl}
                  title={classData.title}
                  preload="metadata"
                  crossOrigin="anonymous"
                  onPlay={() => {
                    console.log('Simple player: Video started playing:', classData.title);
                  }}
                  onError={(error) => {
                    console.error('Simple player: Video playback error:', error);
                    setVideoLoadError(true);
                  }}
                />
                <div style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px"
                }}>
                  Reproductor Simple
                </div>
                <button
                  onClick={() => {
                    console.log('Switching back to advanced player');
                    setUseSimplePlayer(false);
                    setVideoLoadError(false);
                  }}
                  style={{
                    position: "absolute",
                    bottom: "8px",
                    right: "8px",
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Usar reproductor avanzado
                </button>
              </div>
            ) : (
              <VideoPlayerWithTracking
                url={classData.videoUrl}
                title={classData.title}
                classId={classData._id}
                courseId={classData.course?._id}
                schoolId={classData.course?.school?._id}
                allowDownload={false}
              />
            )}
          </div>
        )}
        
        <div className={styles.description}>
          <h2>Description</h2>
          <p>{classData.description}</p>
        </div>
        
        <div className={styles.teacherInfo}>
          <h3>Teacher</h3>
          {classData.createdBy ? (
            <>
              <p>{classData.createdBy.firstName} {classData.createdBy.lastName}</p>
              <p>{classData.createdBy.email}</p>
            </>
          ) : (
            <p>Teacher information not available</p>
          )}
        </div>

        {canReviewSubmissions() && (
          <div className={styles.reviewPanel}>
            <div className={styles.reviewHeader}>
              <div>
                <h2>Prácticas de alumnos</h2>
                <p>Revisa las entregas, salta a un segundo específico y deja feedback puntual.</p>
              </div>
              <div className={styles.reviewCount}>
                {submissionLoading ? 'Cargando...' : `${submissions.length} entrega(s)`}
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className={styles.emptyState}>
                {submissionLoading
                  ? 'Cargando entregas...'
                  : 'Todavía no hay prácticas enviadas para esta clase.'}
              </div>
            ) : (
              <div className={styles.reviewLayout}>
                <div className={styles.submissionList}>
                  {submissions.map((submission) => (
                    <button
                      key={submission._id}
                      type="button"
                      className={`${styles.submissionCard} ${selectedSubmissionId === submission._id ? styles.submissionCardActive : ''}`}
                      onClick={() => setSelectedSubmissionId(submission._id)}
                    >
                      <div className={styles.submissionCardTop}>
                        <strong>{submission.student?.name || submission.student?.email || 'Alumno'}</strong>
                        <span className={styles.submissionBadge}>{submission.reviewStatus}</span>
                      </div>
                      <p>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'Sin fecha'}</p>
                      <small>{submission.videoStatus === 'READY' ? 'Video listo' : submission.videoStatus}</small>
                    </button>
                  ))}
                </div>

                <div className={styles.submissionDetail}>
                  {selectedSubmission ? (
                    <>
                      <div className={styles.submissionVideoWrap}>
                        {selectedSubmission.videoUrl ? (
                          <video
                            id="submission-review-video"
                            className={styles.submissionVideo}
                            controls
                            preload="metadata"
                            src={selectedSubmission.videoUrl}
                            onTimeUpdate={(event) => {
                              const target = event.currentTarget;
                              setSubmissionTime(target.currentTime || 0);
                            }}
                            onLoadedMetadata={(event) => {
                              const target = event.currentTarget;
                              setSubmissionDuration(target.duration || 0);
                            }}
                          />
                        ) : (
                          <div className={styles.emptyVideo}>
                            {selectedSubmission.videoStatus === 'PROCESSING'
                              ? 'El video sigue procesándose.'
                              : selectedSubmission.videoProcessingError || 'Video no disponible.'}
                          </div>
                        )}
                      </div>

                      <div className={styles.reviewActions}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setSelectedTimestamp(Math.floor(submissionTime))}
                        >
                          Usar tiempo actual ({formatSeconds(submissionTime)})
                        </button>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleUpdateReviewStatus('REVIEWED')}
                        >
                          Marcar revisada
                        </button>
                        <button
                          type="button"
                          className={styles.warningButton}
                          onClick={() => handleUpdateReviewStatus('NEEDS_RESUBMISSION')}
                        >
                          Pedir reenvío
                        </button>
                      </div>

                      <div className={styles.annotationComposer}>
                        <label htmlFor="annotationTimestamp">Timestamp</label>
                        <input
                          id="annotationTimestamp"
                          type="number"
                          min={0}
                          max={Math.max(0, Math.floor(submissionDuration))}
                          value={selectedTimestamp}
                          onChange={(event) => setSelectedTimestamp(Number(event.target.value) || 0)}
                        />
                        <span>{formatSeconds(selectedTimestamp)}</span>
                        <textarea
                          value={annotationText}
                          onChange={(event) => setAnnotationText(event.target.value)}
                          placeholder="Escribe la observación del profesor para este momento del video"
                        />
                        <div className={styles.annotationComposerActions}>
                          {editingAnnotationId && (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={cancelEditingAnnotation}
                            >
                              Cancelar edición
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleCreateAnnotation}
                            disabled={!annotationText.trim()}
                          >
                            {editingAnnotationId ? 'Guardar cambios' : 'Guardar anotación'}
                          </button>
                        </div>
                      </div>

                      <div className={styles.annotationList}>
                        <h3>Anotaciones</h3>
                        {annotationsLoading ? (
                          <p>Cargando anotaciones...</p>
                        ) : submissionAnnotations.length > 0 ? (
                          submissionAnnotations.map((annotation) => (
                            <div
                              key={annotation._id}
                              className={styles.annotationItem}
                            >
                              <div className={styles.annotationItemTop}>
                                <strong>{formatSeconds(annotation.timestampSeconds)}</strong>
                                <span>{annotation.author?.name || annotation.author?.email || 'Profesor'}</span>
                              </div>
                              <p>{annotation.text}</p>
                              <div className={styles.annotationItemActions}>
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  onClick={() => jumpToTimestamp(annotation.timestampSeconds)}
                                >
                                  Ir al momento
                                </button>
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  onClick={() => startEditingAnnotation(annotation)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className={styles.warningButton}
                                  onClick={() => void deleteAnnotation(annotation._id)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p>Todavía no hay anotaciones para esta práctica.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyState}>Selecciona una entrega para revisarla.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {canModify() && (
          <div className={styles.adminActions}>
            <button 
              className={styles.editButton}
              onClick={() => router.push(`/class/edit/${classData._id}`)}
            >
              Edit Class
            </button>
            <button 
              className={styles.deleteButton}
              onClick={handleDeleteClass}
            >
              Delete Class
            </button>
            <button 
              className={`${styles.publicButton} ${classData.isPublic ? styles.public : styles.private}`}
              onClick={handleTogglePublic}
            >
              {classData.isPublic ? 'Mark as Private' : 'Mark as Public'}
            </button>
            <button 
              className={styles.backButton}
              onClick={() => router.push(`/course/${classData.courseId}`)}
            >
              Back to Course
            </button>
          </div>
        )}
        
        {!canModify() && (
          <button 
            className={styles.backButton}
            onClick={() => router.push(`/course/${classData.courseId}`)}
          >
            Back to Course
          </button>
        )}
      </div>
    </Layout>
  );
};

export default ClassDetail;
