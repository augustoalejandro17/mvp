#!/bin/bash

echo "🔄 Reiniciando los contenedores del proyecto Dance Marketplace..."

# Comprobar si Docker está en ejecución
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está en ejecución. Por favor, inicia Docker Desktop y vuelve a intentarlo."
  exit 1
fi

# Reiniciar los contenedores
if [ "$1" == "" ]; then
  echo "🔄 Reiniciando todos los contenedores..."
  docker compose restart
elif [ "$1" == "backend" ] || [ "$1" == "frontend" ] || [ "$1" == "mongo" ]; then
  echo "🔄 Reiniciando contenedor $1..."
  docker compose restart $1
else
  echo "❌ Contenedor no válido. Opciones disponibles: backend, frontend, mongo"
  exit 1
fi

# Verificar estado
echo "📊 Estado de los contenedores:"
docker compose ps

echo "📝 Para ver los logs, ejecuta: ./view-logs.sh" 