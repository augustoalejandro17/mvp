#!/bin/bash

echo "🔄 Reconstruyendo y reiniciando los contenedores..."

# Comprobar si Docker está en ejecución
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está en ejecución. Por favor, inicia Docker Desktop y vuelve a intentarlo."
  exit 1
fi

# Generar archivo .env.local para frontend con valores de desarrollo
echo "📝 Generando variables de entorno para desarrollo local..."
cat > ./frontend/.env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:4000
EOL
echo "✅ Archivo .env.local creado para frontend."

echo "🛑 Deteniendo contenedores actuales..."
docker compose down
cd workers && docker compose down && cd ..

echo "🔨 Reconstruyendo imágenes..."
docker compose build --no-cache --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000

echo "🎬 Construyendo video worker..."
cd workers && docker compose build --no-cache && cd ..

echo "🚀 Iniciando contenedores reconstruidos..."
docker compose up -d

echo "🎬 Iniciando video worker..."
cd workers && docker compose up -d && cd ..

echo "⏳ Esperando a que los servicios estén disponibles..."
sleep 5

# Comprobar si los contenedores están en funcionamiento
if [ "$(docker ps -q -f name=backend)" ] && [ "$(docker ps -q -f name=frontend)" ] && [ "$(docker ps -q -f name=mongo)" ] && [ "$(docker ps -q -f name=video-processor-worker)" ]; then
  echo "✅ ¡Todos los contenedores se han reiniciado correctamente!"
  echo "🌐 Frontend: http://localhost:3000"
  echo "🔌 Backend: http://localhost:4000"
  echo "🗄️ MongoDB: mongodb://localhost:27018"
  echo "🎬 Video Worker: Running"
else
  echo "❌ Algunos contenedores no se iniciaron correctamente."
  echo "📊 Estado de los contenedores principales:"
  docker compose ps
  echo "📊 Estado del video worker:"
  cd workers && docker compose ps && cd ..
fi

echo "📝 Para ver los logs, ejecuta: ./view-logs.sh" 