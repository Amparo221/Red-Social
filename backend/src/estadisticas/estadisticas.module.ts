import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  Comentario,
  ComentarioSchema,
} from '../comentarios/schemas/comentario.schema';
import {
  Publicacion,
  PublicacionSchema,
} from '../publicaciones/schemas/publicacion.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';

/**
 * Sprint 5: estadísticas del dashboard.
 *
 * El módulo no toca los esquemas: registra los tres modelos que ya existen para
 * poder agregar sobre ellos y `$lookup`-ear los nombres con un `find` aparte.
 * `AuthModule` se importa por los guards (sesión + perfil administrador).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Publicacion.name, schema: PublicacionSchema },
      { name: Comentario.name, schema: ComentarioSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
    AuthModule,
  ],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
