import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/** 15 minutos, en segundos (jsonwebtoken también acepta el texto '15m'). */
const VENCIMIENTO_POR_DEFECTO = 15 * 60;

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
      useFactory: (configService: ConfigService) => {
        const segundos = Number(configService.get<string>('JWT_EXPIRES_IN'));

        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn:
              Number.isFinite(segundos) && segundos > 0
                ? segundos
                : VENCIMIENTO_POR_DEFECTO,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // JwtModule se reexporta para que otros módulos (publicaciones) puedan
  // inyectar JwtService al usar el guard con @UseGuards(JwtAuthGuard).
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
