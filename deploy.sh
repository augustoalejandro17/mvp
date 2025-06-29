#!/bin/bash

# Parse command line arguments
VERBOSE=false
if [[ "$1" == "--verbose" || "$1" == "-v" ]]; then
    VERBOSE=true
fi

echo "🚀 Iniciando proceso de despliegue..."

# Comprobar si Docker está en ejecución
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está en ejecución. Por favor, inicia Docker Desktop y vuelve a intentarlo."
  exit 1
fi

# Variables
AWS_PROFILE="augusto"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="347161580021"
FRONTEND_IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/inti-frontend"
BACKEND_IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/inti-backend"
VIDEO_WORKER_IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/inti-worker"

# Variables de entorno para producción
BACKEND_URL="https://api.intihubs.com"
FRONTEND_URL="https://intihubs.com"

# Generar archivo .env.production para frontend
echo "📝 Generando variables de entorno para producción..."
cat > ./frontend/.env.production << EOL
NEXT_PUBLIC_API_URL=${BACKEND_URL}
EOL
echo "✅ Archivo .env.production creado para frontend."

# Login to ECR
echo "🔐 Iniciando sesión en ECR..."
if ! aws ecr get-login-password --region $AWS_REGION --profile augusto | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com; then
    echo "❌ Error conectando a ECR. Verifica:"
    echo "   - Perfil AWS 'augusto' configurado"
    echo "   - Permisos de ECR"
    echo "   - Docker ejecutándose"
    exit 1
fi

# Crear repositorio de video worker si no existe
echo "📦 Verificando repositorio ECR para video worker..."
if ! aws ecr describe-repositories --repository-names inti-worker --region $AWS_REGION --profile augusto >/dev/null 2>&1; then
    echo "📦 Creando repositorio ECR para video worker..."
    aws ecr create-repository --repository-name inti-worker --region $AWS_REGION --profile augusto
    echo "✅ Repositorio inti-worker creado"
fi

# Build Docker images in parallel with caching (MUCH FASTER!)
echo "🔨 Construyendo imágenes Docker en paralelo (con cache)..."
echo "⚡ Nota: Usando cache de Docker para acelerar builds. Use --no-cache solo si hay problemas."

# Build all images in parallel (background processes)
echo "🔄 Construyendo backend..."
if [ "$VERBOSE" = true ]; then
    docker buildx build --platform linux/amd64 -t mvp-backend:latest ./backend --load &
else
    docker buildx build --platform linux/amd64 -t mvp-backend:latest ./backend --load --quiet > /tmp/backend_build.log 2>&1 &
fi
BACKEND_PID=$!

echo "🔄 Construyendo frontend con NEXT_PUBLIC_API_URL=${BACKEND_URL}..."
if [ "$VERBOSE" = true ]; then
    docker buildx build --platform linux/amd64 --build-arg NEXT_PUBLIC_API_URL="${BACKEND_URL}" -t mvp-frontend:latest ./frontend --load &
else
    docker buildx build --platform linux/amd64 --build-arg NEXT_PUBLIC_API_URL="${BACKEND_URL}" -t mvp-frontend:latest ./frontend --load --quiet > /tmp/frontend_build.log 2>&1 &
fi
FRONTEND_PID=$!

echo "🔄 Construyendo video worker..."
if [ "$VERBOSE" = true ]; then
    docker buildx build --platform linux/amd64 -t mvp-video-worker:latest ./workers/video-processor --load &
else
    docker buildx build --platform linux/amd64 -t mvp-video-worker:latest ./workers/video-processor --load --quiet > /tmp/worker_build.log 2>&1 &
fi
WORKER_PID=$!

# Wait for all builds to complete with error checking
echo "⏳ Esperando que terminen todos los builds..."

# Check backend build
wait $BACKEND_PID
BACKEND_STATUS=$?
if [ $BACKEND_STATUS -ne 0 ]; then
    echo "❌ Error construyendo backend (exit code: $BACKEND_STATUS)"
    if [ "$VERBOSE" = false ] && [ -f /tmp/backend_build.log ]; then
        echo "📋 Últimas líneas del error:"
        tail -10 /tmp/backend_build.log
        echo ""
        echo "💡 Para ver el log completo: cat /tmp/backend_build.log"
    fi
    echo "💡 Ejecuta con --verbose para ver detalles: ./deploy.sh --verbose"
    exit 1
fi
echo "✅ Backend build completado"

# Check frontend build  
wait $FRONTEND_PID
FRONTEND_STATUS=$?
if [ $FRONTEND_STATUS -ne 0 ]; then
    echo "❌ Error construyendo frontend (exit code: $FRONTEND_STATUS)"
    if [ "$VERBOSE" = false ] && [ -f /tmp/frontend_build.log ]; then
        echo "📋 Últimas líneas del error:"
        tail -10 /tmp/frontend_build.log
        echo ""
        echo "💡 Para ver el log completo: cat /tmp/frontend_build.log"
    fi
    echo "💡 Ejecuta con --verbose para ver detalles: ./deploy.sh --verbose"
    exit 1
fi
echo "✅ Frontend build completado"

# Check worker build
wait $WORKER_PID
WORKER_STATUS=$?
if [ $WORKER_STATUS -ne 0 ]; then
    echo "❌ Error construyendo video worker (exit code: $WORKER_STATUS)"
    if [ "$VERBOSE" = false ] && [ -f /tmp/worker_build.log ]; then
        echo "📋 Últimas líneas del error:"
        tail -10 /tmp/worker_build.log
        echo ""
        echo "💡 Para ver el log completo: cat /tmp/worker_build.log"
    fi
    echo "💡 Ejecuta con --verbose para ver detalles: ./deploy.sh --verbose"
    exit 1
fi
echo "✅ Video worker build completado"

# Tag Docker images
echo "🏷️ Etiquetando imágenes..."
docker tag mvp-frontend:latest $FRONTEND_IMAGE
docker tag mvp-backend:latest $BACKEND_IMAGE
docker tag mvp-video-worker:latest $VIDEO_WORKER_IMAGE

# Push Docker images in parallel
echo "📤 Subiendo imágenes a ECR en paralelo..."
if [ "$VERBOSE" = true ]; then
    docker push $FRONTEND_IMAGE &
    docker push $BACKEND_IMAGE &
    docker push $VIDEO_WORKER_IMAGE &
else
    docker push $FRONTEND_IMAGE > /dev/null 2>&1 &
    docker push $BACKEND_IMAGE > /dev/null 2>&1 &
    docker push $VIDEO_WORKER_IMAGE > /dev/null 2>&1 &
fi
FRONTEND_PUSH_PID=$!
BACKEND_PUSH_PID=$!
WORKER_PUSH_PID=$!

# Wait for all pushes to complete with error checking
echo "⏳ Esperando que terminen todas las subidas..."

# Check frontend push
wait $FRONTEND_PUSH_PID
FRONTEND_PUSH_STATUS=$?
if [ $FRONTEND_PUSH_STATUS -ne 0 ]; then
    echo "❌ Error subiendo frontend a ECR (exit code: $FRONTEND_PUSH_STATUS)"
    echo "💡 Verifica tu conexión y permisos de ECR"
    exit 1
fi
echo "✅ Frontend subido a ECR"

# Check backend push
wait $BACKEND_PUSH_PID
BACKEND_PUSH_STATUS=$?
if [ $BACKEND_PUSH_STATUS -ne 0 ]; then
    echo "❌ Error subiendo backend a ECR (exit code: $BACKEND_PUSH_STATUS)"
    echo "💡 Verifica tu conexión y permisos de ECR"
    exit 1
fi
echo "✅ Backend subido a ECR"

# Check worker push
wait $WORKER_PUSH_PID
WORKER_PUSH_STATUS=$?
if [ $WORKER_PUSH_STATUS -ne 0 ]; then
    echo "❌ Error subiendo video worker a ECR (exit code: $WORKER_PUSH_STATUS)"
    echo "💡 Verifica tu conexión y permisos de ECR"
    exit 1
fi
echo "✅ Video worker subido a ECR"

echo "✅ Todas las imágenes subidas exitosamente a ECR."

# Actualizar servicios ECS en paralelo
echo "🔄 Actualizando servicios en ECS en paralelo..."
aws ecs update-service --cluster inti-cluster --service inti-frontend --force-new-deployment --profile augusto > /dev/null 2>&1 &
aws ecs update-service --cluster inti-cluster --service inti-backend-service --force-new-deployment --profile augusto > /dev/null 2>&1 &

# Actualizar o crear servicio de video worker
echo "🎬 Actualizando video worker service..."
if aws ecs describe-services --cluster inti-cluster --services inti-worker --profile augusto >/dev/null 2>&1; then
    aws ecs update-service --cluster inti-cluster --service inti-worker --force-new-deployment --profile augusto > /dev/null 2>&1 &
    echo "✅ Video worker service actualizado"
else
    echo "⚠️ Video worker service no existe. Necesitas crear la task definition y service primero."
    echo "💡 Revisa el archivo aws/README.md para instrucciones de configuración del video worker."
fi

# Wait for ECS updates to complete
wait

# Cleanup temporary log files
rm -f /tmp/backend_build.log /tmp/frontend_build.log /tmp/worker_build.log

echo "✅ ¡Despliegue completado exitosamente!"
echo "🌐 Frontend: ${FRONTEND_URL}"
echo "🔌 Backend: ${BACKEND_URL}"
echo ""
echo "💡 Uso: ./deploy.sh [--verbose|-v] para ver output detallado"
echo ""
echo "📝 Para ver los logs de los servicios, usa el comando:"
echo "aws logs get-log-events --log-group-name /ecs/inti-frontend --log-stream-name [STREAM_NAME] --profile augusto"
echo "aws logs get-log-events --log-group-name /ecs/inti-backend-service --log-stream-name [STREAM_NAME] --profile augusto"
echo "aws logs get-log-events --log-group-name /ecs/inti-worker --log-stream-name [STREAM_NAME] --profile augusto"
