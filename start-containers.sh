#!/bin/bash

echo "🚀 Iniciando los contenedores del proyecto Dance Marketplace..."

# Comprobar si Docker está en ejecución
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está en ejecución. Por favor, inicia Docker Desktop y vuelve a intentarlo."
  exit 1
fi

# Construir los contenedores si no existen o han cambiado
echo "🔨 Construyendo contenedores..."
docker compose build

# Iniciar los contenedores
echo "🔼 Levantando contenedores..."
docker compose up -d

# Esperar a que estén disponibles
echo "⏳ Esperando a que los servicios estén disponibles..."
sleep 5

# Comprobar si los contenedores están en funcionamiento
if [ "$(docker ps -q -f name=backend)" ] && [ "$(docker ps -q -f name=frontend)" ] && [ "$(docker ps -q -f name=mongo)" ]; then
  echo "✅ ¡Todos los contenedores están en funcionamiento!"
  echo "🌐 Frontend: http://localhost:3000"
  echo "🔌 Backend: http://localhost:4000"
  echo "🗄️ MongoDB: mongodb://localhost:27018"
else
  echo "❌ Algunos contenedores no se iniciaron correctamente."
  echo "📊 Estado de los contenedores:"
  docker compose ps
fi

echo "📝 Para ver los logs en tiempo real, ejecuta: docker compose logs -f"
echo "🛑 Para detener los contenedores, ejecuta: ./stop-containers.sh" 