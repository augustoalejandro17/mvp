# Guía de Scripts - INTI Monorepo

## Desarrollo

```bash
./start.sh              # Menú interactivo
./dev.sh [api|web|mobile|all]   # Inicio directo
```

**Plataformas:** `api`, `web`, `mobile`, `all` (default)

**Puertos:** Backend 4000 | Web 3000

## Build

```bash
./build.sh [api|web|mobile|all] [--clean]
```

## Docker & Deploy

```bash
./rebuild.sh            # Docker local
./deploy.sh [--verbose] # Deploy AWS
./view-logs.sh          # Ver logs
```

## NPM Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | API + Web |
| `npm run api:dev` | Solo backend |
| `npm run web:dev` | Solo web |
| `npm run mobile:dev` | Solo mobile |
| `npm run build` | Build todo |
| `npm run types:build` | Tipos compartidos |
| `npm run clean` | Limpiar builds |

## Setup Inicial

```bash
./setup-monorepo.sh
```

## Mobile

```bash
./dev.sh mobile         # Desarrollo (o npm run mobile:dev)
cd apps/mobile-app && npm start   # Expo dev server
eas build --platform ios|android  # Build nativo
```

**Expo Go en dispositivo físico:** El proyecto usa SDK 54. Asegúrate de tener la versión más reciente de Expo Go en tu iPhone/Android (desde App Store / Play Store). Si ves "Project is incompatible", ejecuta `npx expo install --fix` en `apps/mobile-app`.

**Node.js:** SDK 54 recomienda Node >= 20.19.4. Si tienes problemas, actualiza: `nvm install 20 && nvm use 20`

**CocoaPods (iOS):** Se requiere CocoaPods 1.13+ (visionos). Si `pod install` falla con "undefined method visionos", instala: `brew install cocoapods`. Para `pod install` con UTF-8: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && pod install`

### Xcode 26 + iOS Simulator

**Problema:** Xcode 26.2 solo reconoce simuladores iOS 26.2. Los simuladores iOS 18.6 no son destinos válidos para `xcodebuild`, por eso falla con "Unable to find a destination".

**Solución:** Instalar el runtime iOS 26.2 Simulator (descarga ~8.4 GB). Usa **sin** `-exportPath` para instalar directamente:

```bash
xcodebuild -downloadPlatform iOS
```

Cuando termine, los simuladores iOS 26.2 (iPhone 17 Pro, etc.) estarán disponibles. Luego:

```bash
cd apps/mobile-app && npx expo run:ios --device "iPhone 17 Pro"
```

**Alternativa:** Si tienes Xcode 16 instalado, puedes usarlo para simuladores iOS 18.x:
```bash
sudo xcode-select -s /Applications/Xcode-16.app/Contents/Developer
```

**PlatformConstants (New Arch en iOS 26.2):** Si la app crashea con "PlatformConstants could not be found", se deshabilitó la New Architecture (`newArchEnabled: false` en app.config.js). Esto requiere Reanimated v3 (override en package.json raíz) y un patch de Folly en ios/Podfile (post_install). Nota: con Legacy Arch pueden aparecer errores de React 19; si ocurren, prueba en dispositivo físico o con Xcode 16 + simulador iOS 18.

## Troubleshooting

- **@inti/shared-types no encontrado:** `npm install && npm run types:build`
- **Puerto en uso:** `lsof -ti:4000 | xargs kill -9`
- **Docker:** `docker compose down && ./rebuild.sh`

### MongoDB: querySrv ENOTFOUND

La API usa `MONGODB_URI` de tu `.env` (Atlas). Si ves `querySrv ENOTFOUND _mongodb._tcp.cluster0....mongodb.net`:

1. **Red / DNS** – Verifica conexión a internet. Prueba cambiar DNS a 8.8.8.8 o 1.1.1.1.
2. **Cluster en Atlas** – Los clústers free se pausan tras 60 días; reactívalo en [MongoDB Atlas](https://cloud.mongodb.com).
3. **Connection string estándar** – En Atlas: Connect → Drivers → usa el formato "standard" (sin `+srv`) si tu red no resuelve SRV. Actualiza `MONGODB_URI` en `.env` con esa URI.
