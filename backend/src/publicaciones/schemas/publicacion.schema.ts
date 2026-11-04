import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Usuario } from '../../usuarios/schemas/usuario.schema';

export type PublicacionDocument = HydratedDocument<Publicacion>;

// Los largos viven acá para que el esquema y los DTO validen exactamente lo
// mismo (un solo número para cambiar si algún día hace falta).
export const LARGO_MAXIMO_TITULO = 100;
export const LARGO_MAXIMO_DESCRIPCION = 500;
export const LARGO_MAXIMO_NOMBRE_AVE = 80;

@Schema({ timestamps: true })
export class Publicacion {
  @Prop({ required: true, trim: true, maxlength: LARGO_MAXIMO_TITULO })
  titulo: string;

  @Prop({ required: true, trim: true, maxlength: LARGO_MAXIMO_DESCRIPCION })
  descripcion: string;

  // Datos "de campo" del ave fotografiada. Son opcionales: el usuario puede
  // publicar sin saber la especie.
  @Prop({ default: '', trim: true, maxlength: LARGO_MAXIMO_NOMBRE_AVE })
  nombreComun: string;

  @Prop({ default: '', trim: true, maxlength: LARGO_MAXIMO_NOMBRE_AVE })
  nombreCientifico: string;

  // '' cuando la publicación no lleva imagen (mismo criterio que el perfil).
  @Prop({ default: '' })
  imagenUrl: string;

  // Referencia al autor (no se embebe el usuario: si cambia el nombre o la foto
  // de perfil, el feed muestra los datos nuevos sin migrar nada).
  @Prop({
    type: Types.ObjectId,
    ref: Usuario.name,
    required: true,
    index: true,
  })
  usuario: Types.ObjectId;

  // Un elemento por usuario que dio me gusta: el propio array es la garantía
  // de que cada usuario pueda dar un solo "me gusta" por publicación.
  @Prop({ type: [{ type: Types.ObjectId, ref: Usuario.name }], default: [] })
  likes: Types.ObjectId[];

  // Espejo de likes.length. Está repetido a propósito: permite ordenar y
  // paginar por cantidad de me gusta con un índice (con $size de agregación
  // Mongo no puede usar índice y se degrada con volumen).
  @Prop({ default: 0, min: 0 })
  cantidadLikes: number;

  // Baja lógica: la publicación no se borra de la base, deja de mostrarse.
  @Prop({ default: false, index: true })
  eliminado: boolean;

  @Prop({ type: Date, default: null })
  fechaEliminacion?: Date | null;

  // Los agrega `timestamps: true`.
  createdAt?: Date;
  updatedAt?: Date;
}

export const PublicacionSchema = SchemaFactory.createForClass(Publicacion);

// Un índice por cada orden que ofrece el feed: primero se filtra por
// `eliminado` y después se ordena. El tercero cubre el perfil de un usuario.
PublicacionSchema.index({ eliminado: 1, createdAt: -1 });
PublicacionSchema.index({ eliminado: 1, cantidadLikes: -1 });
PublicacionSchema.index({ usuario: 1, eliminado: 1, createdAt: -1 });
