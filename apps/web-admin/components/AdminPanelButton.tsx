import React from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/AdminPanelButton.module.css';

const AdminPanelButton: React.FC = () => {
  const router = useRouter();

  const handleClick = () => {
    router.push('/admin/dashboard');
  };

  return (
    <button 
      className={styles.adminButton} 
      onClick={handleClick}
      id="admin-panel-button"
    >
      Panel de Control
    </button>
  );
};

export default AdminPanelButton; 