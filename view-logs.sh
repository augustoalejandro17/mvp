#!/bin/bash

if [ "$1" == "" ]; then
  echo "📝 Mostrando logs de todos los contenedores..."
  docker compose logs -f
elif [ "$1" == "backend" ] || [ "$1" == "frontend" ] || [ "$1" == "mongo" ]; then
  echo "📝 Mostrando logs del contenedor $1..."
  docker compose logs -f $1
else
  echo "❌ Contenedor no válido. Opciones disponibles: backend, frontend, mongo"
  exit 1
fi 