import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';

const logger = new Logger('Bootstrap');

// Valores por defecto para variables de entorno críticas
const DEFAULT_PORT = 4000;
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/learnhub';
const DEFAULT_JWT_SECRET = 'insecure-jwt-secret-please-change-in-production';

async function bootstrap() {
  try {
    // Configurar valores por defecto para variables de entorno si no están definidas
    process.env.PORT = process.env.PORT || DEFAULT_PORT.toString();
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
    process.env.MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
    process.env.JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    
    const app = await NestFactory.create(AppModule);
    
    // Habilitar CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Configurar prefijo global
    app.setGlobalPrefix('api');

    // Configurar validación de DTO
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, // Elimina propiedades que no están en el DTO
      forbidNonWhitelisted: true, // Arroja error si se envían propiedades no definidas
      transform: true, // Transforma los datos a las clases DTO
    }));

    // Aumentar el límite de tamaño para subir archivos
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Log all registered routes
    const server = app.getHttpServer();
    const router = server._events.request._router;
    
    const availableRoutes = router.stack
      .filter(layer => layer.route)
      .map(layer => {
        const route = layer.route;
        const path = route.path;
        const method = Object.keys(route.methods)[0].toUpperCase();
        return `${method} ${path}`;
      });
    
    logger.log('Registered routes:');
    availableRoutes.forEach(route => logger.log(route));

    // Obtener el puerto desde las variables de entorno
    const port = process.env.PORT;
    
    logger.log(`Iniciando aplicación en modo de depuración completa`);
    logger.log(`Usando FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    logger.log(`Usando MONGODB_URI: ${process.env.MONGODB_URI.substring(0, 10)}...`);
    
    await app.listen(port);
    logger.log(`Aplicación iniciada correctamente en puerto ${port}`);
  } catch (error) {
    logger.error(`Error al iniciar la aplicación: ${error.message}`);
    logger.error(error.stack);
    // En caso de error de puerto ocupado, intentar con otro
    if (error.code === 'EADDRINUSE') {
      logger.warn(`Puerto ${process.env.PORT} en uso, intentando con puerto alternativo 4004`);
      const app = await NestFactory.create(AppModule);
      app.enableCors({
        origin: process.env.FRONTEND_URL,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      });
      app.setGlobalPrefix('api');
      app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }));
      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ limit: '50mb', extended: true }));
      
      await app.listen(4004);
      logger.log(`Aplicación iniciada en puerto alternativo 4004`);
    }
  }
}

bootstrap(); 