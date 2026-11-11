import { Types } from 'mongoose';
import { ComentarioDocument } from '../schemas/comentario.schema';

/** Autor tal como se muestra en el comentario (populado, sin datos privados). */
export interface AutorComentario {
  id: string;
  nombre: string;
  apellido: string;
  nombreUsuario: string;
  imagenPerfilUrl: string;
}

/** Respuesta pública de un comentario. */
export interface ComentarioResponse {
  id: string;
  texto: string;
  /** Autor populado, o solo el id si el populate falló. */
  autor: AutorComentario | string;
  /** Los agrega `timestamps: true` en Mongoose. */
  createdAt?: Date;
  updatedAt?: Date;
  eliminado: boolean;
  /** `true` si el texto se editó alguna vez desde que se publicó. */
  editado: boolean;
  /** Cuándo se editó por última vez (null si nunca). */
  fechaEdicion?: Date | null;
}

/**
 * Respuesta paginada de GET /publicaciones/:id/comentarios.
 * Misma forma que el feed (`total`/`offset`/`limit`/`hayMas`) para que el front
 * reutilice la lógica de "cargar más".
 */
export interface ListadoComentariosResponse {
  total: number;
  offset: number;
  limit: number;
  hayMas: boolean;
  comentarios: ComentarioResponse[];
}


/** Campos del autor que se piden en el populate. */
export const CAMPOS_AUTOR_COMENTARIO =
  'nombre apellido nombreUsuario imagenPerfilUrl';

/**
 * Convierte el documento de Mongo a la forma pública:
 * `_id` → `id`, autor populado → objeto reducido.
 */
export function toComentarioResponse(
  comentario: ComentarioDocument,
): ComentarioResponse {
  const estaPopulado = Boolean(comentario.populated('autor'));
  const autor = estaPopulado
    ? (comentario.autor as unknown as { _id: Types.ObjectId; nombre: string; apellido: string; nombreUsuario: string; imagenPerfilUrl: string })
    : null;

  return {
    id: String(comentario._id),
    texto: comentario.texto ?? '',
    autor: autor
      ? {
          id: String(autor._id),
          nombre: autor.nombre,
          apellido: autor.apellido,
          nombreUsuario: autor.nombreUsuario,
          imagenPerfilUrl: autor.imagenPerfilUrl,
        }
      : String(comentario.autor),
    createdAt: comentario.createdAt,
    updatedAt: comentario.updatedAt,
    eliminado: comentario.eliminado,
    editado: comentario.editado === true,
    fechaEdicion: comentario.fechaEdicion ?? null,
  };
}
