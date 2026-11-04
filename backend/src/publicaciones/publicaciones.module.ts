import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PublicacionesController } from './publicaciones.controller';
import { PublicacionesService } from './publicaciones.service';
import { Publicacion, PublicacionSchema } from './schemas/publicacion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Publicacion.name, schema: PublicacionSchema },
    ]),
    CloudinaryModule,
    // Aporta el JwtAuthGuard (y con él el JwtService) que protege las rutas.
    AuthModule,
  ],
  controllers: [PublicacionesController],
  providers: [PublicacionesService],
  // Lo exportamos porque el Sprint #3 (comentarios) va a necesitarlo para
  // verificar que la publicación exista.
  exports: [PublicacionesService],
})
export class PublicacionesModule {}
