# Usamos una imagen oficial de Node.js
FROM node:18

# Instalar dependencias necesarias para la compilación
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copiar archivos de configuración primero (optimización de capas)
COPY package*.json ./

# Asegurarnos de limpiar cualquier instalación previa para evitar problemas de arquitectura
RUN rm -rf node_modules && npm cache clean --force

# Instalar todas las dependencias con compilación nativa
RUN npm install

# Copiar el resto del código
COPY . .

# Construir la aplicación
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start:prod"] 