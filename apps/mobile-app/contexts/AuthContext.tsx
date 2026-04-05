import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { IUser, LoginDto, LoginResponse, RegisterDto } from '@inti/shared-types';
import { apiClient, STORAGE_KEYS, API_BASE_URL } from '@/services/apiClient';

type AuthUser = LoginResponse['user'] | IUser;

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (payload: RegisterDto) => Promise<void>;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  const persistUser = async (userData: AuthUser) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  };

  const refreshUser = useCallback(async () => {
    try {
      const fullUser = await apiClient.getCurrentUser();
      setUser(fullUser);
      await persistUser(fullUser);
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error('Error refreshing user:', error);
      }
    }
  }, []);

  const restoreAndValidateSession = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

      if (!token || !userData) {
        clearSession();
        return;
      }

      try {
        setUser(JSON.parse(userData));
      } catch {
        await apiClient.clearAuth();
        clearSession();
        return;
      }

      await refreshUser();
    } catch (error) {
      console.error('Error loading stored auth:', error);
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, refreshUser]);

  useEffect(() => {
    apiClient.setOnUnauthorized(clearSession);
    void restoreAndValidateSession();
  }, [clearSession, restoreAndValidateSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackgrounded =
        appState.current === 'background' || appState.current === 'inactive';
      appState.current = nextAppState;

      if (wasBackgrounded && nextAppState === 'active') {
        void restoreAndValidateSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [restoreAndValidateSession]);

  const login = async (credentials: LoginDto) => {
    try {
      const response = await apiClient.login(credentials);
      setUser(response.user);
      await persistUser(response.user);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      const networkLike =
        !error?.response ||
        error?.code === 'ECONNABORTED' ||
        String(error?.message || '').toLowerCase().includes('network');

      if (networkLike) {
        throw new Error(
          `No se pudo conectar al servidor (${API_BASE_URL}). Verifica internet y que el backend esté activo.`,
        );
      }

      throw new Error(apiMessage || 'Error al iniciar sesión');
    }
  };

  const register = async (payload: RegisterDto) => {
    try {
      const response = await apiClient.register(payload);
      setUser(response.user);
      await persistUser(response.user);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      const networkLike =
        !error?.response ||
        error?.code === 'ECONNABORTED' ||
        String(error?.message || '').toLowerCase().includes('network');

      if (networkLike) {
        throw new Error(
          `No se pudo conectar al servidor (${API_BASE_URL}). Verifica internet y que el backend esté activo.`,
        );
      }

      throw new Error(apiMessage || 'Error al crear la cuenta');
    }
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const Provider = AuthContext.Provider as any;

  return (
    <Provider value={{ user, isAuthenticated: !!user, isLoading, register, login, logout, refreshUser }}>
      {children}
    </Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
