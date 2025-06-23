# Dance Marketplace MVP

## Descripción

Marketplace de clases de baile desarrollado con:
- **Frontend**: Next.js
- **Backend**: NestJS
- **Base de datos**: MongoDB
- **Video Processing**: Worker con FFmpeg
- **Storage**: AWS S3 + CloudFront

## Video Processing System

The application now includes a sophisticated video processing system that provides:

### Architecture

```
Frontend → Temp S3 Bucket → Video Worker → Final S3 Bucket → CloudFront → Users
```

### Features

1. **Direct Upload to Temp Bucket**: Frontend uploads videos directly to a temporary S3 bucket using presigned URLs
2. **Asynchronous Processing**: A dedicated worker processes videos in the background
3. **Optimized Output**: Videos are processed with FFmpeg (720p, H.264, web-optimized)
4. **Secure Delivery**: Final videos are served via CloudFront with signed URLs
5. **Status Tracking**: Real-time video processing status updates

### Video Processing Flow

1. **Upload**: Frontend gets presigned URL and uploads directly to temp bucket
2. **Detection**: Worker detects new video (via SQS notifications or polling)
3. **Processing**: Worker downloads, processes with FFmpeg, and uploads to final bucket
4. **Delivery**: Videos are served via CloudFront with proper caching and security
5. **Cleanup**: Temporary files are automatically removed

### Video Status States

- `UPLOADING`: Video is being uploaded to temp bucket
- `PROCESSING`: Worker is processing the video with FFmpeg
- `READY`: Video is processed and available for viewing
- `ERROR`: Processing failed (with error details)

### Environment Variables

Add these new environment variables for video processing:

```bash
# S3 Bucket Configuration
AWS_S3_BUCKET_NAME=your-final-videos-bucket
AWS_S3_TEMP_BUCKET_NAME=your-temp-videos-bucket

# Optional: SQS for real-time notifications
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/queue-name
```

### Video Worker Deployment

The video worker can be deployed in multiple ways:

#### Docker (Recommended)
```bash
cd workers/video-processor
docker build -t video-processor .
docker run --env-file .env video-processor
```

#### AWS Fargate
```bash
# Build and push to ECR
aws ecr create-repository --repository-name video-processor
docker build -t video-processor .
docker tag video-processor:latest account.dkr.ecr.region.amazonaws.com/video-processor:latest
docker push account.dkr.ecr.region.amazonaws.com/video-processor:latest

# Deploy with Fargate service
```

#### Local Development
```bash
cd workers/video-processor
npm install
npm start
```

### S3 Bucket Setup

You'll need two S3 buckets:

1. **Temp Bucket** (private):
   - Receives direct uploads from frontend
   - Lifecycle rule: delete files after 7 days
   - No public access

2. **Final Bucket** (private):
   - Stores processed videos
   - Served via CloudFront
   - Block all public access (CloudFront handles access)

### Lifecycle Rules

Add lifecycle rules to automatically clean up:

```json
{
  "Rules": [
    {
      "ID": "TempVideoCleanup",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp-videos/"
      },
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
```

### Monitoring

The worker provides comprehensive monitoring:
- Health checks for container orchestration
- Detailed logging with processing progress
- Error reporting with automatic status updates
- Metrics for processing time and success rates

For more details, see [Video Worker Documentation](workers/video-processor/README.md).

## Estructura del Proyecto

El proyecto está dividido en tres partes principales:
- `backend/`: Código del backend en NestJS
- `frontend/`: Código del frontend en Next.js
- `workers/`: Workers para procesamiento de video

## Requisitos

- Docker Desktop
- Node.js 18+ (para desarrollo local)

## Scripts de Gestión de Contenedores

Para facilitar la gestión de los contenedores, se han creado los siguientes scripts:

### Iniciar Contenedores

```bash
./start-containers.sh
```

Este script:
1. Verifica que Docker esté en funcionamiento
2. Construye las imágenes (si es necesario)
3. Inicia los contenedores en modo detached
4. Verifica que los contenedores estén funcionando correctamente

### Detener Contenedores

```bash
./stop-containers.sh
```

Este script:
1. Detiene y elimina los contenedores
2. Verifica que los contenedores se hayan detenido correctamente

### Reiniciar Contenedores

```bash
./restart-containers.sh              # Reinicia todos los contenedores
./restart-containers.sh backend      # Reinicia solo el backend
./restart-containers.sh frontend     # Reinicia solo el frontend
./restart-containers.sh mongo        # Reinicia solo la base de datos
```

### Ver Logs

```bash
./view-logs.sh                # Muestra logs de todos los contenedores
./view-logs.sh backend        # Muestra logs del backend
./view-logs.sh frontend       # Muestra logs del frontend
./view-logs.sh mongo          # Muestra logs de MongoDB
```

## Acceso a los Servicios

Una vez que los contenedores están en funcionamiento:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **MongoDB**: mongodb://localhost:27018

## Variables de Entorno

Las variables de entorno están configuradas en el archivo `.env`:

```
# Backend
MONGO_URI=mongodb://mongo:27017/dance-marketplace
JWT_SECRET=your-secret-key-here

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Desarrollo Local

Para desarrollo local sin Docker:

### Backend

```bash
cd backend
npm install
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Scripts útiles

### Creación de usuarios de prueba

Para facilitar las pruebas del sistema, especialmente para la funcionalidad de asistencias,
puedes crear rápidamente 10 alumnos de prueba con el siguiente script:

```bash
# Instalar dependencias necesarias
npm install

# Ejecutar el script de creación de alumnos
node scripts/create-test-students.js
```

Esto creará 10 alumnos con los siguientes datos:
- Email: test-student-1@example.com, test-student-2@example.com, etc.
- Contraseña: Test123!
- Nombres aleatorios generados con Faker

### Visualización de estadísticas de asistencia

Para facilitar el seguimiento de la asistencia de los estudiantes, se incluye un script que permite ver rápidamente estadísticas detalladas:

```bash
# Ver estadísticas de asistencia (interactivo)
node scripts/attendance-stats.js

# Ver estadísticas de una clase específica
node scripts/attendance-stats.js <class-id>
```

Este script proporciona:
- Tasa de asistencia por fecha
- Listado detallado de estudiantes presentes y ausentes
- Notas asociadas a cada registro de asistencia

### Características de seguridad para videos

El sistema incluye las siguientes características de seguridad para los videos:

1. **URLs firmadas**: Todos los videos se sirven mediante URLs firmadas de AWS S3/CloudFront con tiempo limitado de expiración.
2. **Reproducción segura**: Los videos solo pueden reproducirse en el reproductor de la plataforma.
3. **Protección de contenido**: No se permite la descarga de videos para proteger los derechos de autor del contenido.
4. **Limpieza automática**: El sistema incluye funcionalidad para identificar y limpiar videos huérfanos.

## Image Handling Implementation

The application has been updated to handle image loading more robustly:

1. **ImageFallback Component**: A custom component that provides multiple fallback strategies:
   - First attempts to load the image normally
   - If that fails, adds a cache-busting parameter
   - If that fails, tries to load directly from S3 if it's a CloudFront URL
   - Finally shows a placeholder with the first letter of the alt text

2. **CloudFront Integration**: Images are now served through CloudFront for better performance and security

3. **Error Handling**: Improved logging and error handling for image loading failures

4. **Cache Busting**: Automatic cache-busting parameters to prevent stale image caching

### Usage:
```jsx
// Instead of regular img tags:
<img src={imageUrl} alt="Image description" />

// Use the ImageFallback component:
<ImageFallback 
  src={imageUrl} 
  alt="Image description" 
  className="optional-class"
  placeholderClassName="optional-placeholder-class"
/>
```

Image placeholders will automatically show the first letter of the alt text when an image fails to load. 

## S3 Permissions for Images

To ensure images are displayed correctly, the following updates have been made:

1. **ACL Settings**: All uploads now include `ACL: 'public-read'` for proper access
2. **Permission Fix Script**: A script has been added to fix permissions on existing images

If you're experiencing "Access Denied" errors when loading images, run:

```bash
# Navigate to backend directory
cd backend

# Install dependencies if needed
npm install aws-sdk dotenv

# Run the permissions fix script
node scripts/fix-image-permissions.js
```

This script will update all images in the S3 bucket to have public-read permissions. 