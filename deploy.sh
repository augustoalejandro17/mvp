#!/bin/bash

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

# Variables de entorno para producción
BACKEND_URL="http://inti-back-543150373.us-east-1.elb.amazonaws.com"
FRONTEND_URL="http://inti-front-431558574.us-east-1.elb.amazonaws.com"

# Generar archivo .env.production para frontend
echo "📝 Generando variables de entorno para producción..."
cat > ./frontend/.env.production << EOL
NEXT_PUBLIC_API_URL=${BACKEND_URL}
EOL
echo "✅ Archivo .env.production creado para frontend."

# Login to ECR
echo "🔐 Iniciando sesión en ECR..."
aws ecr get-login-password --region $AWS_REGION --profile augusto | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker images for linux/amd64
echo "🔨 Construyendo imágenes Docker para linux/amd64..."
echo "🔄 Nota: El backend ahora reconstruye bcrypt durante la etapa de producción para asegurar compatibilidad entre arquitecturas."
docker buildx build --platform linux/amd64 -t mvp-backend:latest ./backend --load --no-cache

# Construir el frontend con la variable de entorno correcta
echo "🔨 Construyendo frontend con NEXT_PUBLIC_API_URL=${BACKEND_URL}"
docker buildx build --platform linux/amd64 --build-arg NEXT_PUBLIC_API_URL="${BACKEND_URL}" -t mvp-frontend:latest ./frontend --load --no-cache

# Tag Docker images
echo "🏷️ Etiquetando imágenes..."
docker tag mvp-frontend:latest $FRONTEND_IMAGE
docker tag mvp-backend:latest $BACKEND_IMAGE

# Push Docker images
echo "📤 Subiendo imágenes a ECR..."
echo "📤 Subiendo frontend..."
docker push $FRONTEND_IMAGE

echo "📤 Subiendo backend..."
docker push $BACKEND_IMAGE

echo "✅ Imágenes subidas exitosamente a ECR."

# Actualizar servicios ECS
echo "🔄 Actualizando servicios en ECS..."
aws ecs update-service --cluster inti-cluster --service inti-frontend-service --force-new-deployment --profile augusto
aws ecs update-service --cluster inti-cluster --service inti-backend-service --force-new-deployment --profile augusto

echo "✅ ¡Despliegue completado exitosamente!"
echo "🌐 Frontend: ${FRONTEND_URL}"
echo "🔌 Backend: ${BACKEND_URL}"
echo ""
echo "📝 Para ver los logs de los servicios, usa el comando:"
echo "aws logs get-log-events --log-group-name /ecs/inti-frontend-service --log-stream-name [STREAM_NAME] --profile augusto"
echo "aws logs get-log-events --log-group-name /ecs/inti-backend-service --log-stream-name [STREAM_NAME] --profile augusto"
