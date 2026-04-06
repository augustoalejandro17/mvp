// Import comprehensive crypto polyfill for Docker/Alpine environments
import './crypto-polyfill';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';

const logger = new Logger('Bootstrap');

const normalizeOrigin = (value?: string) =>
  String(value || '')
    .trim()
    .replace(/\/$/, '');

const expandDomainVariants = (value?: string) => {
  const normalized = normalizeOrigin(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set([normalized]);

  if (normalized === 'https://intihubs.com') {
    variants.add('https://www.intihubs.com');
  }

  if (normalized === 'https://www.intihubs.com') {
    variants.add('https://intihubs.com');
  }

  return Array.from(variants);
};

const collectAllowedOrigins = () => {
  const rawOrigins = [
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    'https://intihubs.com',
    'https://www.intihubs.com',
  ];

  const allowedOrigins = new Set<string>();

  for (const rawOrigin of rawOrigins) {
    const parts = String(rawOrigin || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const part of parts) {
      for (const variant of expandDomainVariants(part)) {
        allowedOrigins.add(variant);
      }
    }
  }

  return Array.from(allowedOrigins);
};

async function bootstrap() {
  try {
    // Configurar valores por defecto para variables de entorno si no están definidas
    process.env.PORT = process.env.PORT;
    process.env.FRONTEND_URL = process.env.FRONTEND_URL;
    process.env.MONGODB_URI = process.env.MONGODB_URI;
    process.env.JWT_SECRET = process.env.JWT_SECRET;

    const app = await NestFactory.create(AppModule);

    // Habilitar CORS
    const allowedOrigins = collectAllowedOrigins();

    app.enableCors({
      origin: function (origin, callback) {
        const normalizedOrigin = normalizeOrigin(origin);
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(normalizedOrigin) || !origin) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from origin: ${origin}`);
          callback(null, false);
        }
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    // Configurar prefijo global
    app.setGlobalPrefix('api');

    // Configurar validación de DTO
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Elimina propiedades que no están en el DTO
        forbidNonWhitelisted: true, // Arroja error si se envían propiedades no definidas
        transform: true, // Transforma los datos a las clases DTO
      }),
    );

    // Aumentar el límite de tamaño para subir archivos
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Log all registered routes
    const server = app.getHttpServer();
    const router = server._events.request._router;

    const availableRoutes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => {
        const route = layer.route;
        const path = route.path;
        const method = Object.keys(route.methods)[0].toUpperCase();
        return `${method} ${path}`;
      });

    logger.log('Registered routes:');
    availableRoutes.forEach((route) => logger.log(route));

    // Obtener el puerto desde las variables de entorno
    const port = process.env.PORT;

    logger.log(`Iniciando aplicación en modo de depuración completa`);
    logger.log(`Usando FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    logger.log(`Orígenes permitidos por CORS: ${allowedOrigins.join(', ')}`);
    logger.log(
      `Usando MONGODB_URI: ${process.env.MONGODB_URI.substring(0, 10)}...`,
    );

    await app.listen(port);
    logger.log(`Aplicación iniciada correctamente en puerto ${port}`);
  } catch (error) {
    logger.error(`Error al iniciar la aplicación: ${error.message}`);
    logger.error(error.stack);
    // En caso de error de puerto ocupado, intentar con otro
    if (error.code === 'EADDRINUSE') {
      logger.warn(
        `Puerto ${process.env.PORT} en uso, intentando con puerto alternativo 4004`,
      );
      const app = await NestFactory.create(AppModule);
      app.enableCors({
        origin: process.env.FRONTEND_URL,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      });
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ limit: '50mb', extended: true }));

      await app.listen(4004);
      logger.log(`Aplicación iniciada en puerto alternativo 4004`);
    }
  }
}

bootstrap();
