import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { leerPoliticaSesion } from './utils/sesion-config.util';

@Module({
  imports: [
    UsuariosModule,
    CloudinaryModule,
    // registerAsync deja leer el secret del .env sin hardcodearlo. getOrThrow
    // es a propósito: si falta la variable, la app no arranca (mejor enterarse
    // acá que devolver tokens firmados con "undefined").
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Mismo cálculo que expone GET /auth/sesion y que usa el modal de
          // aviso del front: una sola fuente (auth/utils/sesion-config.util).
          expiresIn: leerPoliticaSesion(configService).expiracionSegundos,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // JwtModule se reexporta para que otros módulos (publicaciones) puedan
  // inyectar JwtService al usar el guard con @UseGuards(JwtAuthGuard).
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
