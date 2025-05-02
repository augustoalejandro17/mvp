# Dance Marketplace MVP

## Descripción

Marketplace de clases de baile desarrollado con:
- **Frontend**: Next.js
- **Backend**: NestJS
- **Base de datos**: MongoDB

## Estructura del Proyecto

El proyecto está dividido en dos repositorios principales:
- `backend/`: Código del backend en NestJS
- `frontend/`: Código del frontend en Next.js

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