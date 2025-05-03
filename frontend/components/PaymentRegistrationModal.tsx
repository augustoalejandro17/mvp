import React, { useState } from 'react';
import styles from '../styles/PaymentRegistrationModal.module.css';

interface PaymentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, amount: number, notes: string, courseId?: string, month?: string) => void;
  userId: string;
  userName: string;
  userCourses?: Array<{ _id: string, title: string }>;
}

const PaymentRegistrationModal: React.FC<PaymentRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userId,
  userName,
  userCourses = []
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  
  if (!isOpen) return null;
  
  // Helper function to get current month in YYYY-MM format
  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  // Format month for display (YYYY-MM to Month YYYY)
  function formatMonthDisplay(monthStr: string) {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    } catch (e) {
      return monthStr;
    }
  }
  
  // Generate months options for the dropdown (6 months back, current month, and 6 months forward)
  function getMonthOptions() {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Generate options for 6 months back
    for (let i = 6; i > 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;
      
      if (month < 0) {
        month += 12;
        year -= 1;
      }
      
      const monthValue = `${year}-${String(month + 1).padStart(2, '0')}`;
      options.push(monthValue);
    }
    
    // Add current month
    const currentMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    options.push(currentMonthValue);
    
    // Generate options for 6 months forward
    for (let i = 1; i <= 6; i++) {
      let month = currentMonth + i;
      let year = currentYear;
      
      if (month > 11) {
        month -= 12;
        year += 1;
      }
      
      const monthValue = `${year}-${String(month + 1).padStart(2, '0')}`;
      options.push(monthValue);
    }
    
    return options;
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(userId, amount, notes, selectedCourse, selectedMonth);
  };
  
  // Close modal when clicking outside or pressing Escape
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2>Registrar Pago - {userName}</h2>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {userCourses && userCourses.length > 0 && (
              <div className={styles.formGroup}>
                <label htmlFor="course-select" className={styles.label}>
                  Curso
                </label>
                <select
                  id="course-select"
                  className={styles.select}
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  <option value="">-- Seleccionar curso --</option>
                  {userCourses.map(course => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label htmlFor="month-select" className={styles.label}>
                Mes de Pago
              </label>
              <select
                id="month-select"
                className={styles.select}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {getMonthOptions().map(month => (
                  <option key={month} value={month}>
                    {formatMonthDisplay(month)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="payment-amount" className={styles.label}>
                Monto del Pago
              </label>
              <input
                id="payment-amount"
                type="number"
                className={styles.input}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="payment-notes" className={styles.label}>
                Notas de Pago (opcional)
              </label>
              <textarea
                id="payment-notes"
                className={styles.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Añadir notas sobre este pago"
              />
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={amount <= 0}
            >
              Registrar Pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentRegistrationModal; 