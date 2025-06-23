import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/PaymentRegistrationModal.module.css';

interface PaymentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterPayment?: (amount: number, notes: string, courseId?: string, month?: string) => void;
  onSave?: (userId: string, amount: number, notes: string, courseId?: string, month?: string) => void;
  userId?: string;
  userName?: string;
  user?: { _id: string; name: string; };
  userCourses?: Array<{ _id: string, title: string }>;
  courses?: Array<any>;
  onSelectCourse?: (courseId: string) => void;
}

interface Payment {
  _id: string;
  amount: number;
  date: string;
  notes: string;
  month: string;
}

interface PaymentHistory {
  payments: Payment[];
  totalPaid: number;
  studentName: string;
  studentEmail: string;
  month: string;
  courseTitle: string;
}

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const PaymentRegistrationModal: React.FC<PaymentRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onRegisterPayment,
  userId,
  userName,
  user,
  userCourses = [],
  courses = [],
  onSelectCourse
}) => {
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [mouseDownTarget, setMouseDownTarget] = useState<EventTarget | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Fetch payment history when course or month changes
  const fetchPaymentHistory = useCallback(async () => {
    if (!selectedCourse || !selectedMonth || !userId) {
      setPaymentHistory(null);
      return;
    }

    setLoadingHistory(true);
    try {
      const token = Cookies.get('token');
      const url = `/api/courses/${selectedCourse}/enrollment/${userId}/payments/${selectedMonth}?t=${Date.now()}`;
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setPaymentHistory(response.data);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No payment history found, set empty state
        setPaymentHistory({
          payments: [],
          totalPaid: 0,
          studentName: userName || 'Unknown',
          studentEmail: '',
          month: selectedMonth,
          courseTitle: 'Unknown Course'
        });
      } else {
        setPaymentHistory(null);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedCourse, selectedMonth, userId, userName]);

  // Effect to fetch payment history when dependencies change
  useEffect(() => {
    fetchPaymentHistory();
  }, [fetchPaymentHistory]);

  // Effect to prevent wheel events on number inputs
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLInputElement;
      if (target && target.type === 'number') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Add event listener to the document
    document.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Early return after all hooks
  if (!isOpen) return null;
  
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle edit payment
  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setAmount(payment.amount.toString());
    setNotes(payment.notes || '');
    
    // Auto-scroll to the form
    setTimeout(() => {
      const amountInput = document.getElementById('payment-amount');
      if (amountInput) {
        amountInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        amountInput.focus();
      }
    }, 100);
  };

  // Handle delete payment
  const handleDeletePayment = async (paymentId: string, paymentAmount: number) => {
    if (!paymentId) {
      alert('Error: ID de pago no válido');
      return;
    }
    
    if (!confirm(`¿Estás seguro de que quieres eliminar este pago de $${paymentAmount.toFixed(2)}?`)) {
      return;
    }

    try {
      const token = Cookies.get('token');
      await axios.delete(`/api/courses/${selectedCourse}/enrollment/${userId}/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Refresh payment history
      fetchPaymentHistory();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error al eliminar el pago. Por favor intenta de nuevo.');
    }
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditingPayment(null);
    setAmount('');
    setNotes('');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // More precise parsing to handle edge cases
    const parsedAmount = parseFloat(amount);
    const numericAmount = isNaN(parsedAmount) ? 0 : parsedAmount;
    

    
    if (editingPayment) {
      // Update existing payment
      try {
        const token = Cookies.get('token');
        

        
        await axios.put(`/api/courses/${selectedCourse}/enrollment/${userId}/payments/${editingPayment._id}`, {
          amount: numericAmount,
          notes: notes
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Reset form and refresh payment history
        setEditingPayment(null);
        setAmount('');
        setNotes('');
        fetchPaymentHistory();
      } catch (error) {
        console.error('Error updating payment:', error);
        alert('Error al actualizar el pago. Por favor intenta de nuevo.');
      }
    } else {
      // Create new payment
    if (onSave && userId) {
      onSave(userId, numericAmount, notes, selectedCourse, selectedMonth);
    } else if (onRegisterPayment) {
      onRegisterPayment(numericAmount, notes, selectedCourse, selectedMonth);
    }
    
    // Update selected course for the parent component if needed
    if (onSelectCourse) {
      onSelectCourse(selectedCourse);
      }
    }
  };
  
  // Track where mouse down started
  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownTarget(e.target);
  };

  // Close modal only if both mousedown and click happened on backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTarget === e.currentTarget) {
      onClose();
    }
    setMouseDownTarget(null);
  };

  // Handle course selection
  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCourse(e.target.value);
    if (onSelectCourse) {
      onSelectCourse(e.target.value);
    }
  };

  // Handle month selection
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
  };
  
  // Determine which courses to display
  const displayCourses = userCourses?.length > 0 ? userCourses : courses;
  const actualUserName = userName || (user?.name ?? 'Usuario');
  
  return (
    <div className={styles.backdrop} onClick={handleBackdropClick} onMouseDown={handleMouseDown}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Registrar Pago - {actualUserName}</h2>
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
            {displayCourses && displayCourses.length > 0 && (
              <div className={styles.formGroup}>
                <label htmlFor="course-select" className={styles.label}>
                  Curso
                </label>
                <select
                  id="course-select"
                  className={styles.select}
                  value={selectedCourse}
                  onChange={handleCourseChange}
                >
                  <option value="">-- Seleccionar curso --</option>
                  {displayCourses.map(course => (
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
                onChange={handleMonthChange}
              >
                {getMonthOptions().map(month => (
                  <option key={month} value={month}>
                    {formatMonthDisplay(month)}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment History Section */}
            {selectedCourse && selectedMonth && (
              <div className={styles.paymentHistorySection}>
                <h3 className={styles.sectionTitle}>
                  Pagos Existentes para {formatMonthDisplay(selectedMonth)}
                </h3>
                
                {loadingHistory ? (
                  <div className={styles.loading}>Cargando historial...</div>
                ) : paymentHistory ? (
                  <div className={styles.paymentHistory}>
                    {paymentHistory.payments.length > 0 ? (
                      <>
                        <div className={styles.totalPaid}>
                          <strong>Total Pagado: {formatCurrency(paymentHistory.totalPaid)}</strong>
                        </div>
                        <div className={styles.paymentsList}>
                          {paymentHistory.payments.map((payment, index) => (
                            <div key={payment._id || index} className={styles.paymentItem}>
                              <div className={styles.paymentContent}>
                                <div className={styles.paymentAmount}>
                                  {formatCurrency(payment.amount)}
                                </div>
                                <div className={styles.paymentDate}>
                                  {formatDate(payment.date)}
                                </div>
                                {payment.notes && (
                                  <div className={styles.paymentNotes}>
                                    {payment.notes}
                                  </div>
                                )}
                              </div>
                              <div className={styles.paymentActions}>
                                <button
                                  type="button"
                                  onClick={() => handleEditPayment(payment)}
                                  className={styles.editButton}
                                  title="Editar pago"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(payment._id, payment.amount)}
                                  className={styles.deleteButton}
                                  title="Eliminar pago"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className={styles.noPayments}>
                        No hay pagos registrados para este mes
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label htmlFor="payment-amount" className={styles.label}>
                {editingPayment ? 'Editar Monto del Pago' : `Monto del Pago ${paymentHistory && paymentHistory.totalPaid > 0 ? '(Adicional)' : ''}`}
              </label>
              <input
                id="payment-amount"
                type="number"
                className={styles.input}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                required
                min="0"
                step="any"
                placeholder="0"
                lang="en"
              />
              {paymentHistory && paymentHistory.totalPaid > 0 && amount && (
                <div className={styles.totalCalculation}>
                  <strong>
                    Total después de este pago: {formatCurrency(paymentHistory.totalPaid + parseFloat(amount))}
                  </strong>
                </div>
              )}
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
              onClick={editingPayment ? cancelEdit : onClose}
            >
              Cancelar
            </button>
            {editingPayment && (
              <button 
                type="button" 
                className={styles.cancelButton}
                onClick={onClose}
                style={{ marginLeft: '8px' }}
              >
                Cerrar
              </button>
            )}
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {editingPayment ? 'Actualizar Pago' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentRegistrationModal; 