import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import styles from '../styles/Login.module.css';
import { useApiErrorHandler } from '../utils/api-error-handler';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { handleApiError } = useApiErrorHandler();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const requestData: any = { name, email, password };
      if (age && !isNaN(Number(age)) && Number(age) > 0) {
        requestData.age = Number(age);
      }
      
      const response = await axios.post(
        `${apiUrl}/api/auth/register`, 
        requestData,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      setSuccess(true);
      
      // Redirect to login after 2 seconds using window.location for full page reload
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Register</h1>
        
        {success ? (
          <div className={styles.successMessage}>
            <p>Registration successful! Redirecting to login...</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <p className={styles.error}>{error}</p>}
            
            <div className={styles.formGroup}>
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={styles.input}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.input}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="age">Age (Optional)</label>
              <input
                type="number"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="1"
                max="120"
                className={styles.input}
                placeholder="Enter your age"
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.input}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={styles.input}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <button type="submit" className={styles.button} disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#3182ce',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '1.5rem'
              }}
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
            
            <div className={styles.links}>
              <span>Already have an account?</span>
              <Link href="/login">
                Log in
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
} 