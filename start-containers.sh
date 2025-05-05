#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create a .env file with your environment variables."
  echo "See DEPLOYMENT.md for required variables."
  exit 1
fi

# Backup the .env file if it doesn't exist already
if [ ! -f .env.backup ]; then
  echo "Creating backup of .env file to .env.backup"
  cp .env .env.backup
fi

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

# Check if containers started successfully
if [ $? -eq 0 ]; then
  echo "Containers started successfully!"
  echo "Frontend: http://localhost:3000"
  echo "Backend API: http://localhost:4000"
  echo ""
  echo "To view logs: ./view-logs.sh"
  echo "To stop containers: ./stop-containers.sh"
else
  echo "Error starting containers. Check docker-compose.yml and .env files."
fi 