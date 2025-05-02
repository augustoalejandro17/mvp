import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../styles/Profile.module.css';
import { useApiErrorHandler } from '../utils/api-error-handler';
import Layout from '../components/Layout';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<{id: string; name: string; email: string; role: string} | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const { handleApiError } = useApiErrorHandler();

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setUser({
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      });
      setName(decoded.name);
      setLoading(false);
    } catch (error) {
      console.error('Error decoding token:', error);
      setError('Authentication error. Please login again.');
      Cookies.remove('token');
      router.push('/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const token = Cookies.get('token');
      if (!token || !user) {
        throw new Error('Not authenticated');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await axios.patch(
        `${apiUrl}/api/users/${user.id}`, 
        { name },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Update cookie with new name
      const decoded: DecodedToken = jwtDecode(token);
      const updatedUser = {
        ...user,
        name
      };
      setUser(updatedUser);
      
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    setPasswordError('');
    
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d|[^\w\s])/.test(newPassword)) {
      setPasswordError('Password must contain at least one uppercase letter, one lowercase letter, and one number or special character');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    setChangingPassword(true);
    
    try {
      const token = Cookies.get('token');
      if (!token || !user) {
        throw new Error('Not authenticated');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await axios.patch(
        `${apiUrl}/api/users/${user.id}/password`, 
        { 
          currentPassword,
          newPassword
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setPasswordSuccess('Password changed successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(handleApiError(error));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <Layout title="My Profile">
        <div className={styles.container}>
          <div className={styles.loading}>Loading profile information...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Profile">
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>My Profile</h1>
          
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
          {passwordSuccess && <div className={styles.success}>{passwordSuccess}</div>}
          
          <div className={styles.profileCard}>
            {isEditing ? (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className={styles.disabledInput}
                  />
                  <small className={styles.helperText}>Email cannot be changed</small>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="role">Role</label>
                  <input
                    type="text"
                    id="role"
                    value={user?.role || ''}
                    disabled
                    className={styles.disabledInput}
                  />
                  <small className={styles.helperText}>Contact an administrator to change your role</small>
                </div>
                
                <div className={styles.buttonGroup}>
                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => {
                      setIsEditing(false);
                      setName(user?.name || '');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : isChangingPassword ? (
              <form onSubmit={handlePasswordChange} className={styles.form}>
                <h2>Change Password</h2>
                
                {passwordError && <div className={styles.error}>{passwordError}</div>}
                
                <div className={styles.formGroup}>
                  <label htmlFor="currentPassword">Current Password</label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <small className={styles.helperText}>
                    Password must be at least 8 characters long and include at least one uppercase letter, 
                    one lowercase letter, and one number or special character
                  </small>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className={styles.buttonGroup}>
                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={changingPassword}
                  >
                    {changingPassword ? 'Changing Password...' : 'Change Password'}
                  </button>
                  
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.profileInfo}>
                <div className={styles.profileSection}>
                  <h2>Name</h2>
                  <p>{user?.name}</p>
                </div>
                
                <div className={styles.profileSection}>
                  <h2>Email</h2>
                  <p>{user?.email}</p>
                </div>
                
                <div className={styles.profileSection}>
                  <h2>Role</h2>
                  <p>{user?.role}</p>
                </div>
                
                <div className={styles.actionButtons}>
                  <button
                    className={styles.editButton}
                    onClick={() => {
                      setIsEditing(true);
                      setIsChangingPassword(false);
                    }}
                  >
                    Edit Profile
                  </button>
                  
                  <button
                    className={styles.passwordButton}
                    onClick={() => {
                      setIsChangingPassword(true);
                      setIsEditing(false);
                    }}
                  >
                    Change Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
} 