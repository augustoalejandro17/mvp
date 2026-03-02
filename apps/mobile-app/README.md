# 📱 Inti Mobile App - Expo + React Native

Aplicación móvil para estudiantes y profesores de la plataforma educativa Inti.

## ✅ Stack Tecnológico

- **Framework**: Expo SDK 50 + React Native
- **TypeScript**: Tipado estricto
- **Estilos**: NativeWind (TailwindCSS para React Native)
- **Navegación**: Expo Router (file-based routing)
- **Video**: Expo AV
- **HTTP**: Axios
- **Storage**: Expo SecureStore
- **Tipos Compartidos**: `@inti/shared-types`

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

Desde la raíz del monorepo:
```bash
npm install
```

### 2. Configurar API URL

El cliente API se configura automáticamente:
- **iOS Simulator**: usa `localhost:4000`
- **Android Emulator**: usa `10.0.2.2:4000`
- **Dispositivo Físico**: detecta tu IP local automáticamente

Si necesitas configurar manualmente, edita `services/apiClient.ts`.

### 3. Iniciar Expo

```bash
cd apps/mobile-app
npm start
```

Esto abrirá Expo DevTools. Puedes:
- Presionar `i` para iOS Simulator
- Presionar `a` para Android Emulator
- Escanear QR con Expo Go (dispositivo físico)

## 📁 Estructura de Carpetas

```
apps/mobile-app/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout
│   ├── index.tsx                 # Redirect inicial
│   ├── (auth)/                   # Auth screens (no tabs)
│   │   └── login.tsx             # Pantalla de login
│   ├── (tabs)/                   # Pantallas con tabs
│   │   ├── home.tsx              # Listado de cursos
│   │   └── profile.tsx           # Perfil de usuario
│   └── player/
│       └── [id].tsx              # Reproductor de video (modal)
│
├── components/                   # Componentes reutilizables
│   └── VideoCard.tsx             # Card de video/clase
│
├── contexts/                     # React Context
│   └── AuthContext.tsx           # Estado de autenticación
│
├── services/                     # Servicios
│   └── apiClient.ts              # Cliente HTTP configurado
│
├── assets/                       # Imágenes, iconos, etc.
├── app.json                      # Configuración de Expo
├── tailwind.config.js            # Configuración de TailwindCSS
└── package.json
```

## 🎨 Estilos con NativeWind

Usa clases de Tailwind directamente:

```tsx
<View className="flex-1 bg-gray-50 p-4">
  <Text className="text-2xl font-bold text-primary-600">
    Título
  </Text>
  <TouchableOpacity className="bg-primary-600 rounded-lg py-3 px-4">
    <Text className="text-white text-center font-semibold">
      Botón
    </Text>
  </TouchableOpacity>
</View>
```

Colores personalizados en `tailwind.config.js`:
- `primary-*`: Azul (brand color)
- `secondary-*`: Púrpura

## 🔐 Autenticación

### Login
```tsx
import { useAuth } from '@/contexts/AuthContext';

function LoginScreen() {
  const { login } = useAuth();
  
  const handleLogin = async () => {
    await login({ email, password });
    // Automáticamente redirige a home
  };
}
```

### Verificar Estado
```tsx
const { user, isAuthenticated, isLoading } = useAuth();

if (isAuthenticated) {
  console.log('Usuario:', user?.name);
}
```

### Logout
```tsx
const { logout } = useAuth();

await logout();
// Se limpia SecureStore automáticamente
```

## 📡 Consumir API

### Usar Cliente HTTP
```tsx
import { apiClient } from '@/services/apiClient';
import { ICourse, IClass } from '@inti/shared-types';

// Get courses
const courses: ICourse[] = await apiClient.getCourses();

// Get classes
const classes: IClass[] = await apiClient.getClassesByCourse(courseId);

// Get class detail
const classDetail: IClass = await apiClient.getClassById(id);
```

### Tipos Compartidos
Todos los tipos vienen de `@inti/shared-types`:
```tsx
import {
  IUser, UserRole,
  ICourse,
  IClass, VideoStatus,
  LoginDto,
} from '@inti/shared-types';
```

## 🧭 Navegación

Expo Router usa file-based routing (como Next.js):

### Navegar entre pantallas
```tsx
import { useRouter } from 'expo-router';

const router = useRouter();

// Push
router.push('/player/123');

// Replace (no back)
router.replace('/(auth)/login');

// Back
router.back();
```

### Parámetros de ruta
```tsx
// En player/[id].tsx
import { useLocalSearchParams } from 'expo-router';

const { id } = useLocalSearchParams<{ id: string }>();
```

## 🎥 Reproductor de Video

Usa Expo AV:

```tsx
import { Video, ResizeMode } from 'expo-av';

<Video
  source={{ uri: videoUrl }}
  style={{ width: '100%', height: 300 }}
  useNativeControls
  resizeMode={ResizeMode.CONTAIN}
  shouldPlay={false}
/>
```

## 📦 Componentes Disponibles

### VideoCard
```tsx
import VideoCard from '@/components/VideoCard';
import { IClass } from '@inti/shared-types';

<VideoCard 
  classItem={classData}
  onPress={() => handleVideoPress(classData._id!)}
/>
```

## 🔧 Desarrollo

### Hot Reload
Expo tiene hot reload automático. Simplemente guarda los archivos y la app se actualiza.

### Debug
- Shake device/simulator para abrir developer menu
- Presiona `j` en terminal para abrir debugger
- Usa `console.log()` - se muestra en terminal

### Linting
```bash
npm run lint
```

### Clear Cache
```bash
npm start -- --clear
```

## 📱 Dispositivos de Prueba

### iOS Simulator (Mac only)
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

### Dispositivo Físico
1. Instala Expo Go desde App Store/Play Store
2. `npm start`
3. Escanea el QR code

## 🚢 Build para Producción

### EAS Build (Recomendado)
```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar
eas build:configure

# Build
eas build --platform ios
eas build --platform android
```

### Local Build
```bash
# Android APK
eas build -p android --profile preview --local

# iOS (requiere Mac)
eas build -p ios --profile preview --local
```

## 🐛 Troubleshooting

### "Cannot find module '@inti/shared-types'"
```bash
# Desde la raíz del monorepo
npm install
npm run types:build
```

### "Network request failed"
- Verifica que el backend esté corriendo (`npm run api:dev`)
- En dispositivo físico, usa tu IP local en lugar de `localhost`
- Verifica que firewall no esté bloqueando

### "Metro bundler issues"
```bash
# Clear cache
expo start --clear
# O
npm start -- --clear
```

### Android Emulator no conecta
Usa `10.0.2.2` en lugar de `localhost` en `apiClient.ts`

## 📚 Próximas Funcionalidades

- [ ] Subida de videos (profesores)
- [ ] Modo offline (download videos)
- [ ] Push notifications
- [ ] Progreso de cursos
- [ ] Gamificación (badges, leaderboard)
- [ ] Asistencia QR
- [ ] Chat en vivo

## 🔗 Enlaces Útiles

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [NativeWind](https://www.nativewind.dev/)
- [React Native](https://reactnative.dev/)

## 💡 Tips

1. **TypeScript estricto**: Todos los componentes están tipados
2. **Shared types**: Siempre importa de `@inti/shared-types`
3. **Tailwind**: Usa className en lugar de StyleSheet
4. **Navigation**: Usa Expo Router, no React Navigation directamente
5. **State**: AuthContext maneja autenticación global
