import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComentarioController, ComentariosController } from './comentario.controller';
import { ComentarioService } from './comentario.service';
import { Comentario, ComentarioSchema } from './schemas/comentario.schema';
import { Publicacion, PublicacionSchema } from '../publicaciones/schemas/publicacion.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comentario.name, schema: ComentarioSchema },
      { name: Publicacion.name, schema: PublicacionSchema },
    ]),
    AuthModule,
  ],
  controllers: [ComentarioController, ComentariosController],
  providers: [ComentarioService],
  exports: [ComentarioService],
})
export class ComentarioModule {}
