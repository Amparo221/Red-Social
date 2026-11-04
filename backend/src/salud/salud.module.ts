import { Module } from '@nestjs/common';
import { SaludController } from './salud.controller';

/**
 * No importa `MongooseModule`: `MongooseCoreModule` es `@Global()`, así que
 * `@InjectConnection()` resuelve la conexión que abre `AppModule`.
 */
@Module({
  controllers: [SaludController],
})
export class SaludModule {}
