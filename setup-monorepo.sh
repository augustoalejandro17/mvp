#!/bin/bash

echo "🚀 Configurando Monorepo Inti..."
echo ""

# Verificar que estamos en la raíz
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Limpiar node_modules viejos
echo "🧹 Limpiando instalaciones anteriores..."
rm -rf node_modules
rm -rf apps/api/node_modules
rm -rf apps/web-admin/node_modules
rm -rf apps/mobile-app/node_modules
rm -rf packages/shared-types/node_modules
rm -rf packages/shared-types/dist

echo ""
echo "📦 Instalando dependencias del monorepo..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error instalando dependencias"
    exit 1
fi

echo ""
echo "🔨 Compilando tipos compartidos..."
npm run types:build

if [ $? -ne 0 ]; then
    echo "❌ Error compilando tipos compartidos"
    exit 1
fi

echo ""
echo "✅ ¡Monorepo configurado exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Ejecutar el backend: npm run api:dev"
echo "  2. Ejecutar el frontend: npm run web:dev"
echo "  3. O ambos en paralelo: npm run dev"
echo ""
echo "📖 Ver README.md para más información"

