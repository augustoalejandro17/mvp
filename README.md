# Inti - Plataforma Educativa

Monorepo con Backend (NestJS), Web Admin (Next.js), Mobile (Expo) y tipos compartidos.

## Estructura

```
apps/
├── api/          Backend NestJS (puerto 4000)
├── web-admin/    Panel Next.js (puerto 3000)
└── mobile-app/   App React Native/Expo
packages/
└── shared-types/ Tipos TypeScript compartidos
```

## Inicio Rápido

```bash
# 1. Setup (primera vez)
./setup-monorepo.sh

# 2. Desarrollo
./dev.sh              # API + Web
./dev.sh api          # Solo backend
./dev.sh web          # Solo web
./dev.sh mobile       # Solo mobile

# 3. Build
./build.sh            # Todo
./build.sh api        # Solo backend
```

## Scripts

| Script | Uso |
|--------|-----|
| `./start.sh` | Menú interactivo |
| `./dev.sh [api\|web\|mobile]` | Desarrollo |
| `./build.sh [--clean]` | Build producción |
| `./rebuild.sh` | Docker local |
| `./deploy.sh` | Deploy AWS |
| `./scripts-help.sh` | Referencia rápida |

## Documentación

- **[docs/SCRIPTS.md](docs/SCRIPTS.md)** - Guía detallada de scripts
- **[GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)** - Configuración OAuth
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment y AWS
- **[ONBOARDING.md](ONBOARDING.md)** - Flujo de onboarding
- **apps/mobile-app/README.md** - Setup mobile
- **packages/shared-types/README.md** - Tipos compartidos

## URLs Desarrollo

- Backend: http://localhost:4000
- Web: http://localhost:3000

## Tipos Compartidos

```typescript
import { IUser, ICourse, UserRole } from '@inti/shared-types';
```

Ejecutar tras cambios: `npm run types:build`

## Troubleshooting

```bash
# Módulo no encontrado
npm install && npm run types:build

# Puerto en uso
lsof -ti:4000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```
