import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RemoveClassFieldMigration } from './attendance/migration/remove-class-field.migration';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Migration');
  logger.log('Starting migration process...');

  const app = await NestFactory.create(AppModule);
  const migration = app.get(RemoveClassFieldMigration);

  try {
    await migration.migrate();
    logger.log('Migration completed successfully');
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`, error.stack);
  } finally {
    await app.close();
  }
}

bootstrap();
