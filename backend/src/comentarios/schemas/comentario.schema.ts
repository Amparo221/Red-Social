import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Usuario } from '../../usuarios/schemas/usuario.schema';
import { Publicacion } from '../../publicaciones/schemas/publicacion.schema';

export type ComentarioDocument = HydratedDocument<Comentario>;

// Largos consistentes con los DTOs del front y del backend (un solo número
// para cambiar si algún día hace falta).
export const LARGO_MAXIMO_TEXTO_COMENTARIO = 500;

@Schema({ timestamps: true })
export class Comentario {
  @Prop({ required: true, trim: true, maxlength: LARGO_MAXIMO_TEXTO_COMENTARIO })
  texto: string;

  // Quién escribió el comentario.
  @Prop({
    type: Types.ObjectId,
    ref: Usuario.name,
    required: true,
    index: true,
  })
  autor: Types.ObjectId;

  // A qué publicación pertenece.
  @Prop({
    type: Types.ObjectId,
    ref: Publicacion.name,
    required: true,
    index: true,
  })
  publicacion: Types.ObjectId;

  // Baja lógica: no se borra el documento, se marca y se deja de mostrar.
  @Prop({ default: false, index: true })
  eliminado: boolean;

  @Prop({ type: Date, default: null })
  fechaEliminacion?: Date | null;

  // Marca de edición: el front la usa para anunciar "editado" (la consigna del
  // Sprint #3 lo pide explícitamente). Queda en true para siempre: si se edita
  // dos veces, lo que importa es que no sea el texto original.
  @Prop({ default: false })
  editado: boolean;

  @Prop({ type: Date, default: null })
  fechaEdicion?: Date | null;

  // Los agrega `timestamps: true`.
  createdAt?: Date;
  updatedAt?: Date;
}

export const ComentarioSchema = SchemaFactory.createForClass(Comentario);

// Índices para las consultas de comentarios: primero filtra por publicación y
// si está eliminado, luego ordena por fecha.
ComentarioSchema.index({ publicacion: 1, eliminado: 1, createdAt: 1 });
ComentarioSchema.index({ autor: 1, eliminado: 1, createdAt: -1 });
