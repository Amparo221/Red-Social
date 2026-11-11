import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { Usuario, UsuarioSchema } from './schemas/usuario.schema';

/**
 * Sprint 4: además de prestar el modelo de usuario, este módulo expone el
 * dashboard de administración (listado, alta y baja/alta lógica).
 *
 * El `forwardRef` es por el ciclo Auth ↔ Usuarios:
 *  - Usuarios necesita el `JwtAuthGuard` y el `RolesGuard` que exporta Auth.
 *  - Auth necesita `UsuariosService` (el alta de usuarios) y el modelo que
 *    exporta este módulo.
 * El ciclo es sólo de módulos, no de providers, y Nest lo resuelve así.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Usuario.name, schema: UsuarioSchema }]),
    CloudinaryModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  // MongooseModule: para que Auth (y el JwtAuthGuard) puedan inyectar el modelo.
  // UsuariosService: lo usa AuthService al registrar.
  exports: [MongooseModule, UsuariosService],
})
export class UsuariosModule {}

