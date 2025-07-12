import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../styles/Profile.module.css';
import { useApiErrorHandler } from '../utils/api-error-handler';
import Layout from '../components/Layout';
import { pointsApi, badgeApi, leaderboardApi } from '../utils/gamification-api';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface GamificationData {
  points: number;
  level: string;
  streak: number;
  rank: number;
  badges: any[];
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
  const [gamificationData, setGamificationData] = useState<GamificationData | null>(null);
  const [loadingGamification, setLoadingGamification] = useState(false);
  const { handleApiError } = useApiErrorHandler();

  const fetchGamificationData = async (userId: string) => {
    if (!userId) return;
    
    setLoadingGamification(true);
    try {
      // Use the new public endpoint that auto-detects school ID
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const fullUrl = `${apiUrl}/api/gamification/points/public/user/${userId}`;
      console.log('Calling API URL:', fullUrl);
      
      const pointsResponse = await fetch(fullUrl);
      
      if (pointsResponse.ok) {
        const pointsData = await pointsResponse.json();
        console.log('Received points data:', pointsData);
        setGamificationData({
          points: pointsData.points || 0,
          level: pointsData.levelName || 'Beginner',
          streak: pointsData.streak || 0,
          rank: pointsData.rank || 0,
          badges: [], // We'll add badges later when needed
        });
        console.log('Set gamification data:', {
          points: pointsData.points || 0,
          level: pointsData.levelName || 'Beginner',
          streak: pointsData.streak || 0,
          rank: pointsData.rank || 0,
        });
      } else {
        console.error('API call failed with status:', pointsResponse.status);
        const errorText = await pointsResponse.text();
        console.error('Error response:', errorText);
        // Fallback to empty data if API fails
        setGamificationData({
          points: 0,
          level: 'Beginner',
          streak: 0,
          rank: 0,
          badges: [],
        });
      }
    } catch (error) {
      console.error('Error fetching gamification data:', error);
      // Set empty data on error instead of demo data
      setGamificationData({
        points: 0,
        level: 'Beginner',
        streak: 0,
        rank: 0,
        badges: [],
      });
    } finally {
      setLoadingGamification(false);
    }
  };

  const navigateToLeaderboard = () => {
    router.push('/gamification-demo');
  };

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      console.log('Decoded token:', decoded);
      const userData = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      };
      console.log('User data:', userData);
      setUser(userData);
      setName(decoded.name);
      setLoading(false);
      
      // Fetch gamification data
      console.log('Fetching gamification data for user ID:', userData.id);
      fetchGamificationData(userData.id);
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
              <div className={styles.profileDisplay}>
                {/* Profile Header */}
                <div className={styles.profileHeader}>
                  <div className={styles.avatar}>
                    <span className={styles.avatarText}>
                      {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </span>
                  </div>
                  <h1 className={styles.userName}>{user?.name}</h1>
                  
                  {/* Points Badge */}
                  {gamificationData && (
                    <div className={styles.pointsBadge} onClick={navigateToLeaderboard}>
                      <span className={styles.pointsIcon}>🏆</span>
                                          <span className={styles.pointsText}>
                      {gamificationData ? gamificationData.points.toLocaleString() : 0} Points
                    </span>
                    </div>
                  )}
                  
                  {/* Edit Profile Button */}
                  <button
                    className={styles.editProfileButton}
                    onClick={() => router.push('/profile/edit')}
                  >
                    Edit Profile
                  </button>
                </div>
                
                {/* Additional Info */}
                {gamificationData && (
                  <div className={styles.additionalInfo}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Streak:</span>
                      <span className={styles.infoValue}>{gamificationData ? gamificationData.streak : 0} days</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Rank:</span>
                      <span className={styles.infoValue}>#{gamificationData ? gamificationData.rank : 0}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
} 