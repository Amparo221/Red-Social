import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { leerPoliticaSesion } from './utils/sesion-config.util';

@Module({
  imports: [
    // El JwtAuthGuard consulta la base en cada request (baja lógica inmediata),
    // así que necesita `UsuarioModel`. `@UseGuards(JwtAuthGuard)` instancia el
    // guard en el contexto del módulo que usa la ruta, por eso el modelo se
    // registra acá y se reexporta más abajo: publicaciones y comentarios lo
    // reciben al importar AuthModule.
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
    // forwardRef por el ciclo Auth ↔ Usuarios (ver usuarios.module.ts): acá se
    // usa `UsuariosService` (alta de usuarios); allá se usan los guards que
    // exporta este módulo.
    forwardRef(() => UsuariosModule),
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
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  // JwtModule se reexporta para que otros módulos (publicaciones, comentarios y
  // usuarios) puedan inyectar JwtService al usar @UseGuards(JwtAuthGuard).
  // También se reexporta MongooseModule con el modelo de Usuario: es la otra
  // dependencia del guard. RolesGuard se exporta por el mismo motivo: el
  // dashboard de usuarios lo suma después del guard de sesión.
  exports: [JwtAuthGuard, RolesGuard, JwtModule, MongooseModule],
})
export class AuthModule {}

