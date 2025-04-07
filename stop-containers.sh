#!/bin/bash

echo "🛑 Deteniendo los contenedores del proyecto Dance Marketplace..."

# Comprobar si Docker está en ejecución
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está en ejecución. Por favor, inicia Docker Desktop y vuelve a intentarlo."
  exit 1
fi

# Detener los contenedores
echo "🔽 Deteniendo contenedores..."
docker compose down

# Comprobar si los contenedores se detuvieron correctamente
if [ -z "$(docker ps -q -f name=backend)" ] && [ -z "$(docker ps -q -f name=frontend)" ] && [ -z "$(docker ps -q -f name=mongo)" ]; then
  echo "✅ ¡Todos los contenedores se han detenido correctamente!"
else
  echo "⚠️ Algunos contenedores no se detuvieron correctamente."
  echo "📊 Estado actual de los contenedores:"
  docker compose ps
fi

echo "🚀 Para iniciar los contenedores de nuevo, ejecuta: ./start-containers.sh" 