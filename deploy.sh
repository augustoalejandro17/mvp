#!/bin/bash

# Variables
AWS_PROFILE="augusto"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="347161580021"
FRONTEND_IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/inti-frontend"
BACKEND_IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/inti-backend"

# Variables de entorno para producción
BACKEND_URL="http://inti-back-543150373.us-east-1.elb.amazonaws.com"
FRONTEND_URL="http://inti-front-431558574.us-east-1.elb.amazonaws.com"
CLOUDFRONT_DOMAIN="diqqgv7d0nfl3.cloudfront.net"
CLOUDFRONT_KEY_PAIR_ID="KILXAWX92V8CB"

# Solicitar la clave privada de CloudFront en Base64 si no existe en el entorno
if [ -z "$CLOUDFRONT_PRIVATE_KEY_BASE64" ]; then
  if [ -f "private_key.pem" ]; then
    echo "📄 Convirtiendo private_key.pem a Base64..."
    CLOUDFRONT_PRIVATE_KEY_BASE64=$(base64 -i private_key.pem | tr -d '\n')
    echo "✅ Clave privada convertida a Base64"
  else
    echo "⚠️ No se encontró private_key.pem. Por favor, ingresa la clave privada en Base64:"
    read -p "CLOUDFRONT_PRIVATE_KEY_BASE64: " CLOUDFRONT_PRIVATE_KEY_BASE64
  fi
fi

# Verificar que tenemos las variables esenciales
if [ -z "$CLOUDFRONT_DOMAIN" ] || [ -z "$CLOUDFRONT_KEY_PAIR_ID" ] || [ -z "$CLOUDFRONT_PRIVATE_KEY_BASE64" ]; then
  echo "❌ ERROR: Faltan variables de CloudFront necesarias."
  echo "CloudFront Domain: ${CLOUDFRONT_DOMAIN:-NO CONFIGURADO}"
  echo "CloudFront Key Pair ID: ${CLOUDFRONT_KEY_PAIR_ID:-NO CONFIGURADO}"
  echo "CloudFront Private Key: ${CLOUDFRONT_PRIVATE_KEY_BASE64:+CONFIGURADO}"
  exit 1
fi

# Generar archivo .env.production para frontend
echo "Generando archivo .env.production para frontend..."
cat > ./frontend/.env.production << EOL
# VARIABLES DE ENTORNO PARA PRODUCCIÓN
# NO EDITAR MANUALMENTE - Gestionado por deploy.sh
NEXT_PUBLIC_API_URL=${BACKEND_URL}
EOL
echo "✅ Archivo .env.production creado."

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker images for linux/amd64 using buildx
echo "🔧 Building frontend for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=${BACKEND_URL} \
  -t mvp-frontend ./frontend --load

echo "🔧 Building backend for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg PORT=4000 \
  --build-arg NODE_ENV=production \
  --build-arg FRONTEND_URL=${FRONTEND_URL} \
  --build-arg AWS_REGION=${AWS_REGION} \
  --build-arg AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME:-inti-storage} \
  --build-arg AWS_CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN} \
  --build-arg AWS_CLOUDFRONT_KEY_PAIR_ID=${CLOUDFRONT_KEY_PAIR_ID} \
  --build-arg AWS_CLOUDFRONT_PRIVATE_KEY_BASE64="${CLOUDFRONT_PRIVATE_KEY_BASE64}" \
  -t mvp-backend ./backend --load

# Tag Docker images
echo "🏷️ Tagging images..."
docker tag mvp-frontend:latest $FRONTEND_IMAGE
docker tag mvp-backend:latest $BACKEND_IMAGE

# Push Docker images
echo "🚀 Pushing frontend..."
docker push $FRONTEND_IMAGE

echo "🚀 Pushing backend..."
docker push $BACKEND_IMAGE

echo "✅ Images deployed to ECR successfully."

# Instrucciones para actualizar la definición de tarea en ECS
echo "📝 IMPORTANTE: Recuerda actualizar las variables de entorno en las definiciones de tarea de ECS:"
echo "Para el frontend:"
echo "  - NEXT_PUBLIC_API_URL=${BACKEND_URL}"
echo ""
echo "Para el backend:"
echo "  - PORT=4000"
echo "  - NODE_ENV=production"
echo "  - FRONTEND_URL=${FRONTEND_URL}"
echo "  - AWS_REGION=${AWS_REGION}"
echo "  - AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME:-inti-storage}"
echo "  - AWS_CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN}"
echo "  - AWS_CLOUDFRONT_KEY_PAIR_ID=${CLOUDFRONT_KEY_PAIR_ID}"
echo "  - AWS_CLOUDFRONT_PRIVATE_KEY_BASE64=[VALOR_SENSIBLE_NO_MOSTRADO]"
echo ""
echo "Ejecuta: aws ecs update-service --cluster inti-cluster --service inti-frontend-service --force-new-deployment"
echo "Ejecuta: aws ecs update-service --cluster inti-cluster --service inti-backend-service --force-new-deployment"
