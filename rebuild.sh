#!/bin/bash

echo "🔄 Reconstruyendo y reiniciando los contenedores..."

# Comprobar si Docker está en ejecución
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está en ejecución. Por favor, inicia Docker Desktop y vuelve a intentarlo."
  exit 1
fi

echo "🛑 Deteniendo contenedores actuales..."
docker compose down

echo "🔨 Reconstruyendo imágenes..."
docker compose build --no-cache

echo "🚀 Iniciando contenedores reconstruidos..."
docker compose up -d

echo "⏳ Esperando a que los servicios estén disponibles..."
sleep 5

# Comprobar si los contenedores están en funcionamiento
if [ "$(docker ps -q -f name=backend)" ] && [ "$(docker ps -q -f name=frontend)" ] && [ "$(docker ps -q -f name=mongo)" ]; then
  echo "✅ ¡Todos los contenedores se han reiniciado correctamente!"
  echo "🌐 Frontend: http://localhost:3000"
  echo "🔌 Backend: http://localhost:4000"
  echo "🗄️ MongoDB: mongodb://localhost:27018"
else
  echo "❌ Algunos contenedores no se iniciaron correctamente."
  echo "📊 Estado de los contenedores:"
  docker compose ps
fi

echo "📝 Para ver los logs, ejecuta: ./view-logs.sh" 