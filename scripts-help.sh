#!/bin/bash

# Quick reference for INTI development scripts

cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                  INTI - Scripts Rápidos                       ║
╚═══════════════════════════════════════════════════════════════╝

🚀 DESARROLLO
─────────────────────────────────────────────────────────────────
  ./start.sh                    Menú interactivo
  ./dev.sh [plataforma]         Inicio rápido
  
  Plataformas:
    • api, backend              Solo backend (puerto 4000)
    • web, admin, frontend      Solo web (puerto 3000)
    • mobile, expo, app         Solo mobile (Expo)
    • all, full                 Backend + Web ✅ (default)

🔨 BUILD
─────────────────────────────────────────────────────────────────
  ./build.sh [plataforma]       Build para producción
  ./build.sh --clean            Build con limpieza
  
  Plataformas: api, web, mobile, all

🐳 DOCKER
─────────────────────────────────────────────────────────────────
  ./rebuild.sh                  Rebuild contenedores (dev local)
  ./deploy.sh                   Deploy a AWS (producción)
  ./deploy.sh --verbose         Deploy con logs detallados
  ./view-logs.sh                Ver logs de Docker

📦 NPM SCRIPTS
─────────────────────────────────────────────────────────────────
  npm run dev                   Backend + Web (turbo)
  npm run api:dev               Solo backend
  npm run web:dev               Solo web
  npm run mobile:dev            Solo mobile
  
  npm run build                 Build todo (turbo)
  npm run build:api             Build backend
  npm run build:web             Build web
  npm run build:mobile          Build mobile
  
  npm run types:build           Compilar tipos compartidos
  npm run types:watch           Watch tipos compartidos
  
  npm run clean                 Limpiar builds
  npm run lint                  Linter
  npm run format                Prettier

⚙️ SETUP
─────────────────────────────────────────────────────────────────
  ./setup-monorepo.sh           Setup inicial completo
  cd apps/mobile-app && ./init-expo.sh    Setup mobile

📖 AYUDA
─────────────────────────────────────────────────────────────────
  cat README.md                 Documentación principal
  cat docs/SCRIPTS.md           Guía detallada de scripts

🎯 EJEMPLOS RÁPIDOS
─────────────────────────────────────────────────────────────────
  # Desarrollo normal (recomendado)
  ./dev.sh                      # Backend + Web
  
  # Solo una plataforma
  ./dev.sh api                  # Backend
  ./dev.sh web                  # Web
  ./dev.sh mobile               # Mobile
  
  # Build antes de deploy
  ./build.sh                    # Todo
  ./build.sh api                # Solo backend
  
  # Deploy a producción
  ./deploy.sh                   # Deploy con cache
  ./deploy.sh --verbose         # Deploy con logs

💡 TIPS
─────────────────────────────────────────────────────────────────
  • Primera vez:     ./setup-monorepo.sh
  • Desarrollo:      ./dev.sh (o ./start.sh para menú)
  • Testing build:   ./build.sh
  • Producción:      ./deploy.sh
  • Tipos:           npm run types:watch (en otra terminal)
  
  URLs:
    Backend:  http://localhost:4000
    Web:      http://localhost:3000
    Mobile:   Expo DevTools

EOF
