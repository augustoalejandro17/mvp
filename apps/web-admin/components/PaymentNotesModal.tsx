import React, { useState } from 'react';
import styles from '../styles/PaymentNotesModal.module.css';

interface PaymentNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (studentId: string, isPaid: boolean, notes: string) => void;
  initialNotes?: string;
  isPaid: boolean;
  studentId?: string;
}

const PaymentNotesModal: React.FC<PaymentNotesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialNotes = '',
  isPaid,
  studentId = ''
}) => {
  const [notes, setNotes] = useState(initialNotes);
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(studentId, isPaid, notes);
  };
  
  const modalTitle = isPaid ? 'Mark as Paid' : 'Mark as Unpaid';
  const actionLabel = isPaid ? 'Mark as Paid' : 'Mark as Unpaid';
  
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
          <h2>{modalTitle}</h2>
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
            <label htmlFor="payment-notes" className={styles.label}>
              Payment Notes (optional)
            </label>
            <textarea
              id="payment-notes"
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this payment status"
            />
          </div>
          <div className={styles.modalFooter}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={isPaid ? styles.paidButton : styles.unpaidButton}
            >
              {actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentNotesModal; 