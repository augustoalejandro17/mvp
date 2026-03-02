#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔨 INTI Build System - Monorepo"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del monorepo${NC}"
    exit 1
fi

# Parse arguments
PLATFORM="all"
CLEAN=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --clean|-c) CLEAN=true ;;
        api|backend|web|admin|mobile|expo|all|full) PLATFORM="$1" ;;
        *) echo -e "${RED}❌ Argumento desconocido: $1${NC}"; exit 1 ;;
    esac
    shift
done

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}🧹 Limpiando builds anteriores...${NC}"
    npm run clean
    echo ""
fi

# Build types first (always needed)
echo -e "${BLUE}📦 Compilando tipos compartidos (@inti/shared-types)...${NC}"
npm run types:build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error compilando tipos compartidos${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Tipos compartidos compilados${NC}"
echo ""

case $PLATFORM in
    "api"|"backend")
        echo -e "${BLUE}🔧 Compilando Backend API...${NC}"
        cd apps/api
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error compilando backend${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Backend compilado${NC}"
        echo ""
        echo -e "${YELLOW}Para ejecutar: cd apps/api && npm start${NC}"
        ;;
    
    "web"|"admin"|"frontend")
        echo -e "${BLUE}🌐 Compilando Web Admin...${NC}"
        cd apps/web-admin
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error compilando web admin${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Web Admin compilado${NC}"
        echo ""
        echo -e "${YELLOW}Para ejecutar: cd apps/web-admin && npm start${NC}"
        ;;
    
    "mobile"|"expo"|"app")
        echo -e "${BLUE}📱 Compilando Mobile App...${NC}"
        cd apps/mobile-app
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error compilando mobile app${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Mobile App compilado${NC}"
        echo ""
        echo -e "${YELLOW}💡 Para build nativo, usa:${NC}"
        echo "   iOS:     cd apps/mobile-app && eas build --platform ios"
        echo "   Android: cd apps/mobile-app && eas build --platform android"
        ;;
    
    "all"|"full")
        echo -e "${BLUE}🔥 Compilando todas las plataformas...${NC}"
        echo ""
        
        # Build backend
        echo -e "${BLUE}[1/3] 🔧 Compilando Backend API...${NC}"
        cd apps/api
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error compilando backend${NC}"
            exit 1
        fi
        cd ../..
        echo -e "${GREEN}✅ Backend compilado${NC}"
        echo ""
        
        # Build web admin
        echo -e "${BLUE}[2/3] 🌐 Compilando Web Admin...${NC}"
        cd apps/web-admin
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error compilando web admin${NC}"
            exit 1
        fi
        cd ../..
        echo -e "${GREEN}✅ Web Admin compilado${NC}"
        echo ""
        
        # Build mobile
        echo -e "${BLUE}[3/3] 📱 Exportando Mobile App...${NC}"
        cd apps/mobile-app
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Error exportando mobile app${NC}"
            exit 1
        fi
        cd ../..
        echo -e "${GREEN}✅ Mobile App exportado${NC}"
        echo ""
        
        echo -e "${GREEN}🎉 ¡Todas las plataformas compiladas exitosamente!${NC}"
        ;;
    
    *)
        echo -e "${RED}❌ Plataforma no reconocida: $PLATFORM${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Build completado${NC}"
