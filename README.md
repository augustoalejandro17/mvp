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