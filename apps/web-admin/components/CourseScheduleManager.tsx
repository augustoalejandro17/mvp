import React, { useState, useEffect } from 'react';
import styles from '../styles/CourseScheduleManager.module.css';

interface ScheduleTime {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface CourseScheduleManagerProps {
  courseId?: string;
  // Controlled mode props
  scheduleTimes?: ScheduleTime[];
  enableNotifications?: boolean;
  notificationMinutes?: number;
  onScheduleTimesChange?: (times: ScheduleTime[]) => void;
  onEnableNotificationsChange?: (enabled: boolean) => void;
  onNotificationMinutesChange?: (minutes: number) => void;
  onScheduleUpdate?: (schedule: any) => void;
}

const CourseScheduleManager: React.FC<CourseScheduleManagerProps> = ({
  courseId,
  scheduleTimes: externalScheduleTimes,
  enableNotifications: externalEnableNotifications,
  notificationMinutes: externalNotificationMinutes,
  onScheduleTimesChange,
  onEnableNotificationsChange,
  onNotificationMinutesChange,
  onScheduleUpdate
}) => {
  // Determine if we're in controlled mode
  const isControlledMode = externalScheduleTimes !== undefined;

  // Internal state (used only in uncontrolled mode)
  const [internalScheduleTimes, setInternalScheduleTimes] = useState<ScheduleTime[]>([]);
  const [internalEnableNotifications, setInternalEnableNotifications] = useState(true);
  const [internalNotificationMinutes, setInternalNotificationMinutes] = useState(10);

  // Use external state if available, otherwise use internal state
  const scheduleTimes = isControlledMode ? externalScheduleTimes : internalScheduleTimes;
  const enableNotifications = isControlledMode 
    ? (externalEnableNotifications ?? true) 
    : internalEnableNotifications;
  const notificationMinutes = isControlledMode 
    ? (externalNotificationMinutes ?? 10) 
    : internalNotificationMinutes;

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const daysOfWeek = [
    { value: 'monday', label: 'Lunes' },
    { value: 'tuesday', label: 'Martes' },
    { value: 'wednesday', label: 'Miércoles' },
    { value: 'thursday', label: 'Jueves' },
    { value: 'friday', label: 'Viernes' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' }
  ];

  useEffect(() => {
    if (!isControlledMode && courseId) {
      loadSchedule();
    }
  }, [courseId, isControlledMode]);

  const loadSchedule = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/courses/${courseId}/schedule`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setInternalScheduleTimes(data.scheduleTimes || []);
          setInternalEnableNotifications(data.enableNotifications ?? true);
          setInternalNotificationMinutes(data.notificationMinutes || 10);
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      setMessage('Error al cargar el horario');
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleTimes = (newTimes: ScheduleTime[]) => {
    if (isControlledMode) {
      onScheduleTimesChange?.(newTimes);
    } else {
      setInternalScheduleTimes(newTimes);
    }
  };

  const updateEnableNotifications = (enabled: boolean) => {
    if (isControlledMode) {
      onEnableNotificationsChange?.(enabled);
    } else {
      setInternalEnableNotifications(enabled);
    }
  };

  const updateNotificationMinutes = (minutes: number) => {
    if (isControlledMode) {
      onNotificationMinutesChange?.(minutes);
    } else {
      setInternalNotificationMinutes(minutes);
    }
  };

  const addScheduleTime = () => {
    const newTime: ScheduleTime = {
      dayOfWeek: 'monday',
      startTime: '09:00',
      endTime: '10:00',
      isActive: true
    };
    updateScheduleTimes([...scheduleTimes, newTime]);
  };

  const removeScheduleTime = (index: number) => {
    const newTimes = scheduleTimes.filter((_, i) => i !== index);
    updateScheduleTimes(newTimes);
  };

  const updateScheduleTime = (index: number, field: keyof ScheduleTime, value: any) => {
    const newTimes = [...scheduleTimes];
    newTimes[index] = { ...newTimes[index], [field]: value };
    updateScheduleTimes(newTimes);
  };

  const saveSchedule = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Clean the schedule times data
      const cleanedScheduleTimes = scheduleTimes.map(time => ({
        dayOfWeek: time.dayOfWeek,
        startTime: time.startTime,
        endTime: time.endTime,
        isActive: time.isActive
      }));

      const scheduleData = {
        scheduleTimes: cleanedScheduleTimes,
        enableNotifications,
        notificationMinutes
      };

      const response = await fetch(`/api/courses/${courseId}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(scheduleData)
      });

      if (response.ok) {
        setMessage('Horario guardado exitosamente');
        setTimeout(() => setMessage(''), 3000);
        
        // Call the callback if provided
        if (onScheduleUpdate) {
          onScheduleUpdate({
            scheduleTimes: cleanedScheduleTimes,
            enableNotifications,
            notificationMinutes
          });
        }
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.message || 'No se pudo guardar el horario'}`);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage('Error al guardar el horario');
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async () => {
    if (!courseId || !confirm('¿Estás seguro de que deseas eliminar este horario?')) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/courses/${courseId}/schedule`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setInternalScheduleTimes([]);
        setInternalEnableNotifications(true);
        setInternalNotificationMinutes(10);
        setMessage('Horario eliminado exitosamente');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error al eliminar el horario');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setMessage('Error al eliminar el horario');
    } finally {
      setLoading(false);
    }
  };

  const validateTimes = () => {
    for (const time of scheduleTimes) {
      if (time.startTime >= time.endTime) {
        setMessage('La hora de inicio debe ser anterior a la hora de fin');
        return false;
      }
    }

    // Check for overlaps on the same day
    const groupedByDay = scheduleTimes.reduce((acc, time, index) => {
      if (!acc[time.dayOfWeek]) acc[time.dayOfWeek] = [];
      acc[time.dayOfWeek].push({ ...time, originalIndex: index });
      return acc;
    }, {} as Record<string, any[]>);

    for (const [day, times] of Object.entries(groupedByDay)) {
      if (times.length > 1) {
        for (let i = 0; i < times.length; i++) {
          for (let j = i + 1; j < times.length; j++) {
            const time1 = times[i];
            const time2 = times[j];
            
            if (time1.isActive && time2.isActive) {
              if (time1.startTime < time2.endTime && time2.startTime < time1.endTime) {
                setMessage(`Horarios superpuestos detectados para ${daysOfWeek.find(d => d.value === day)?.label}`);
                return false;
              }
            }
          }
        }
      }
    }

    return true;
  };

  if (loading) {
    return <div className={styles.loading}>Cargando horario...</div>;
  }

  return (
    <div className={styles.container}>
      <h3>Horario de Clases</h3>
      <p>Configure los días y horarios en que se dictan las clases de este curso.</p>

      {message && (
        <div className={`${styles.message} ${message.includes('Error') ? styles.error : styles.success}`}>
          {message}
        </div>
      )}

      <div className={styles.notificationSettings}>
        <div className={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="enableNotifications"
            checked={enableNotifications}
            onChange={(e) => updateEnableNotifications(e.target.checked)}
          />
          <label htmlFor="enableNotifications">
            Habilitar notificaciones de recordatorio
          </label>
        </div>

        {enableNotifications && (
          <div className={styles.inputGroup}>
            <label htmlFor="notificationMinutes">Enviar notificación:</label>
            <select
              id="notificationMinutes"
              value={notificationMinutes}
              onChange={(e) => updateNotificationMinutes(parseInt(e.target.value))}
              className={styles.select}
            >
              <option value={5}>5 minutos antes</option>
              <option value={10}>10 minutos antes</option>
              <option value={15}>15 minutos antes</option>
              <option value={20}>20 minutos antes</option>
              <option value={30}>30 minutos antes</option>
            </select>
          </div>
        )}
      </div>

      <div className={styles.scheduleSection}>
        <h4>Horarios de Clase</h4>
        
        {scheduleTimes.length === 0 ? (
          <p>No hay horarios configurados. Haga clic en "Agregar Horario" para comenzar.</p>
        ) : (
          <div className={styles.scheduleList}>
            {scheduleTimes.map((time, index) => (
              <div key={index} className={styles.scheduleItem}>
                <div className={styles.scheduleRow}>
                  <div className={styles.inputGroup}>
                    <label>Día:</label>
                    <select
                      value={time.dayOfWeek}
                      onChange={(e) => updateScheduleTime(index, 'dayOfWeek', e.target.value)}
                      className={styles.select}
                    >
                      {daysOfWeek.map(day => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Hora inicio:</label>
                    <input
                      type="time"
                      value={time.startTime}
                      onChange={(e) => updateScheduleTime(index, 'startTime', e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Hora fin:</label>
                    <input
                      type="time"
                      value={time.endTime}
                      onChange={(e) => updateScheduleTime(index, 'endTime', e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.checkboxGroup}>
                    <input
                      type="checkbox"
                      id={`active-${index}`}
                      checked={time.isActive}
                      onChange={(e) => updateScheduleTime(index, 'isActive', e.target.checked)}
                    />
                    <label htmlFor={`active-${index}`}>Activo</label>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeScheduleTime(index)}
                    className={styles.removeButton}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addScheduleTime}
          className={styles.addButton}
        >
          + Agregar Horario
        </button>
      </div>

      {/* Only show save/delete buttons in uncontrolled mode */}
      {!isControlledMode && courseId && (
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => {
              if (validateTimes()) {
                saveSchedule();
              }
            }}
            disabled={loading}
            className={styles.saveButton}
          >
            {loading ? 'Guardando...' : 'Guardar Horario'}
          </button>

          {scheduleTimes.length > 0 && (
            <button
              type="button"
              onClick={deleteSchedule}
              disabled={loading}
              className={styles.deleteButton}
            >
              Eliminar Horario
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseScheduleManager; 