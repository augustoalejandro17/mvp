import { View, Text, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@inti/shared-types';
import Constants from 'expo-constants';
import { apiClient } from '@/services/apiClient';

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [UserRole.STUDENT]: 'Estudiante',
  [UserRole.TEACHER]: 'Profesor',
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.SCHOOL_OWNER]: 'Director',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
};

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-4 py-4 border-b border-gray-50 active:bg-gray-50"
    >
      <View
        className={`w-9 h-9 rounded-full justify-center items-center mr-3 ${
          danger ? 'bg-red-50' : 'bg-amber-50'
        }`}
      >
        <Ionicons name={icon as any} size={18} color={danger ? '#dc2626' : '#d97706'} />
      </View>
      <View className="flex-1">
        <Text className={`font-medium ${danger ? 'text-red-600' : 'text-gray-800'}`}>
          {label}
        </Text>
        {subtitle ? <Text className="text-gray-400 text-xs mt-0.5">{subtitle}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const appExtra = Constants.expoConfig?.extra as Record<string, string> | undefined;

  const supportUrl = appExtra?.supportUrl;
  const supportEmail = appExtra?.supportEmail;
  const accountDeletionUrl = appExtra?.accountDeletionUrl;
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const openLink = async (url?: string) => {
    if (!url) {
      Alert.alert('No disponible', 'Este enlace no está configurado todavía.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('No disponible', 'No fue posible abrir este enlace.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el enlace.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar Cuenta',
      'Esta acción eliminará tu cuenta y no se puede deshacer. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmación final',
              '¿Seguro que deseas eliminar tu cuenta permanentemente?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar Cuenta',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiClient.deleteMyAccount();
                      await logout();
                      router.replace('/(auth)/login');
                    } catch (error: any) {
                      const msg = error?.response?.data?.message;
                      Alert.alert(
                        'No se pudo eliminar',
                        Array.isArray(msg)
                          ? msg.join('\n')
                          : msg || 'Intenta nuevamente en unos minutos.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const initials = user?.name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : 'Usuario';

  return (
    <ScrollView className="flex-1 bg-amber-50" showsVerticalScrollIndicator={false}>
      {/* Hero Header */}
      <View className="bg-amber-500 px-5 pt-8 pb-6">
        <View className="items-center">
          <View className="w-20 h-20 bg-white rounded-full justify-center items-center shadow-sm mb-3">
            <Text className="text-3xl font-bold text-amber-500">{initials}</Text>
          </View>
          <Text className="text-white text-xl font-bold">{user?.name || 'Usuario'}</Text>
          <Text className="text-amber-100 text-sm mt-0.5">{user?.email}</Text>
          <View className="mt-2 bg-white/20 px-4 py-1 rounded-full">
            <Text className="text-white text-sm font-medium">{roleLabel}</Text>
          </View>
        </View>
      </View>

      <View className="px-4 pt-4 pb-8">
        {/* Account Section */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Cuenta
        </Text>
        <View className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-100">
          <MenuItem
            icon="person-outline"
            label="Editar Perfil"
            subtitle="Actualiza tu información"
            onPress={() => router.push('/edit-profile' as any)}
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Cambiar Contraseña"
            subtitle="Actualiza tu contraseña"
            onPress={() => router.push('/change-password' as any)}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notificaciones"
            subtitle="Gestiona tus preferencias"
            onPress={() => router.push('/(tabs)/notifications')}
          />
          <MenuItem
            icon="trash-outline"
            label="Eliminar Cuenta"
            subtitle="Borrar tu cuenta y datos"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        {/* App Section */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Aplicación
        </Text>
        <View className="bg-white rounded-xl mb-4 overflow-hidden border border-gray-100">
          <MenuItem
            icon="help-circle-outline"
            label="Centro de Ayuda"
            subtitle="FAQs y soporte"
            onPress={() => openLink(supportUrl || (supportEmail ? `mailto:${supportEmail}` : undefined))}
          />
          <MenuItem
            icon="information-circle-outline"
            label="Acerca de Inti"
            subtitle={`Versión ${appVersion}`}
            onPress={() => router.push('/about' as any)}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Política de Privacidad"
            subtitle="Cómo protegemos tus datos"
            onPress={() => router.push('/privacy-policy')}
          />
          <MenuItem
            icon="document-outline"
            label="Términos y Condiciones"
            subtitle="Reglas de uso de la plataforma"
            onPress={() => router.push('/terms-and-conditions' as any)}
          />
          <MenuItem
            icon="document-text-outline"
            label="Normas de Contenido"
            subtitle="Reglas de contenido permitido"
            onPress={() => router.push('/community-guidelines')}
          />
          <MenuItem
            icon="flag-outline"
            label="Mis denuncias"
            subtitle="Revisa el estado de tus reportes"
            onPress={() => router.push('/my-reports' as any)}
          />
          <MenuItem
            icon="trash-bin-outline"
            label="Página de eliminación de cuenta"
            subtitle="Información pública para baja de cuenta"
            onPress={() => openLink(accountDeletionUrl)}
          />
        </View>

        {/* Logout */}
        <View className="bg-white rounded-xl overflow-hidden border border-red-100">
          <MenuItem icon="log-out-outline" label="Cerrar Sesión" onPress={handleLogout} danger />
        </View>
      </View>
    </ScrollView>
  );
}
