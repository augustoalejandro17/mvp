#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 INTI Development Server - Monorepo"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del monorepo${NC}"
    exit 1
fi

# Parse arguments
PLATFORM="all"
if [ "$1" != "" ]; then
    PLATFORM=$1
fi

case $PLATFORM in
    "api"|"backend")
        echo -e "${BLUE}🔧 Iniciando solo Backend API...${NC}"
        npm run api:dev
        ;;
    
    "web"|"frontend"|"admin")
        echo -e "${BLUE}🌐 Iniciando solo Web Admin...${NC}"
        npm run web:dev
        ;;
    
    "mobile"|"app"|"expo")
        echo -e "${BLUE}📱 Iniciando Mobile App...${NC}"
        cd apps/mobile-app
        npm start
        ;;
    
    "all"|"full")
        echo -e "${BLUE}🔥 Iniciando Backend + Frontend en paralelo...${NC}"
        echo ""
        echo -e "${YELLOW}💡 Para mobile, ejecuta en otra terminal: ./dev.sh mobile${NC}"
        echo ""
        npm run dev
        ;;
    
    *)
        echo -e "${RED}❌ Plataforma no reconocida: $PLATFORM${NC}"
        echo ""
        echo "Uso: ./dev.sh [plataforma]"
        echo ""
        echo "Plataformas disponibles:"
        echo "  api, backend       - Solo backend API (puerto 4000)"
        echo "  web, admin         - Solo web admin (puerto 3000)"
        echo "  mobile, expo       - Solo mobile app (Expo)"
        echo "  all, full          - Backend + Web en paralelo (default)"
        echo ""
        echo "Ejemplos:"
        echo "  ./dev.sh           # Todo (backend + web)"
        echo "  ./dev.sh api       # Solo backend"
        echo "  ./dev.sh web       # Solo frontend web"
        echo "  ./dev.sh mobile    # Solo mobile app"
        exit 1
        ;;
esac
