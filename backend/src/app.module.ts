import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { PublicacionesModule } from './publicaciones/publicaciones.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    // Carga el archivo .env y deja ConfigService disponible en toda la app.
    // Se declara ANTES que Mongoose: forRootAsync garantiza que las variables ya
    // estén cargadas cuando se lee MONGODB_URI.
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        // Si la URI no incluye el nombre de la base, Mongoose usaría "test".
        dbName: configService.get<string>('MONGODB_DB') ?? 'redsocial',
      }),
    }),

    AuthModule,
    UsuariosModule,
    PublicacionesModule,
  ],
})
export class AppModule {}
