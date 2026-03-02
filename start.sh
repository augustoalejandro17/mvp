#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

clear
echo -e "${MAGENTA}"
cat << "EOF"
  _____ _   _ _______ _____ 
 |_   _| \ | |__   __|_   _|
   | | |  \| |  | |    | |  
   | | | . ` |  | |    | |  
  _| |_| |\  |  | |   _| |_ 
 |_____|_| \_|  |_|  |_____|
                            
  Plataforma Educativa
EOF
echo -e "${NC}"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del monorepo${NC}"
    exit 1
fi

# Interactive menu
echo -e "${BLUE}Selecciona la plataforma a ejecutar:${NC}"
echo ""
echo "  1) 🌐 Web Admin (Frontend)"
echo "  2) 🔧 API Backend"
echo "  3) 📱 Mobile App (Expo)"
echo "  4) 🔥 Backend + Web (paralelo)"
echo "  5) 🚀 Todo (Backend + Web + Mobile en 3 terminales)"
echo ""
read -p "Opción [1-5]: " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}🌐 Iniciando Web Admin...${NC}"
        echo -e "${YELLOW}URL: http://localhost:3000${NC}"
        echo ""
        npm run web:dev
        ;;
    
    2)
        echo ""
        echo -e "${GREEN}🔧 Iniciando Backend API...${NC}"
        echo -e "${YELLOW}URL: http://localhost:4000${NC}"
        echo ""
        npm run api:dev
        ;;
    
    3)
        echo ""
        echo -e "${GREEN}📱 Iniciando Mobile App...${NC}"
        echo ""
        cd apps/mobile-app
        npm start
        ;;
    
    4)
        echo ""
        echo -e "${GREEN}🔥 Iniciando Backend + Web en paralelo...${NC}"
        echo ""
        echo -e "${YELLOW}URLs:${NC}"
        echo -e "  Backend: ${YELLOW}http://localhost:4000${NC}"
        echo -e "  Web:     ${YELLOW}http://localhost:3000${NC}"
        echo ""
        npm run dev
        ;;
    
    5)
        echo ""
        echo -e "${GREEN}🚀 Modo completo: Backend + Web + Mobile${NC}"
        echo ""
        echo -e "${YELLOW}Se abrirán 3 ventanas de terminal:${NC}"
        echo "  1. Backend API (puerto 4000)"
        echo "  2. Web Admin (puerto 3000)"
        echo "  3. Mobile App (Expo)"
        echo ""
        read -p "¿Continuar? [y/N]: " confirm
        
        if [[ $confirm =~ ^[Yy]$ ]]; then
            # Detect OS
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS - usar iTerm2 o Terminal
                if command -v osascript &> /dev/null; then
                    # Backend
                    osascript -e 'tell app "Terminal" to do script "cd \"'"$PWD"'\" && npm run api:dev"'
                    sleep 1
                    # Web
                    osascript -e 'tell app "Terminal" to do script "cd \"'"$PWD"'\" && npm run web:dev"'
                    sleep 1
                    # Mobile
                    osascript -e 'tell app "Terminal" to do script "cd \"'"$PWD"'/apps/mobile-app\" && npm start"'
                    
                    echo -e "${GREEN}✅ 3 terminales abiertas${NC}"
                else
                    echo -e "${RED}❌ osascript no disponible${NC}"
                fi
            else
                echo -e "${YELLOW}⚠️ Modo automático solo en macOS${NC}"
                echo ""
                echo "Ejecuta manualmente en 3 terminales:"
                echo ""
                echo "  Terminal 1: npm run api:dev"
                echo "  Terminal 2: npm run web:dev"
                echo "  Terminal 3: cd apps/mobile-app && npm start"
            fi
        fi
        ;;
    
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac
