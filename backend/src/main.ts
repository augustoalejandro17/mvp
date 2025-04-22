import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    // Habilitar CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Configurar prefijo global
    app.setGlobalPrefix('api');

    // Configurar validación de DTO
    app.useGlobalPipes(new ValidationPipe());

    // Aumentar el límite de tamaño para subir archivos
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Obtener el puerto desde las variables de entorno o usar 3000 por defecto
    const port = process.env.PORT || 3000;
    
    logger.log(`Iniciando aplicación en modo de depuración completa`);
    
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
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      });
      app.setGlobalPrefix('api');
      app.useGlobalPipes(new ValidationPipe());
      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ limit: '50mb', extended: true }));
      
      await app.listen(4004);
      logger.log(`Aplicación iniciada en puerto alternativo 4004`);
    }
  }
}

bootstrap(); 