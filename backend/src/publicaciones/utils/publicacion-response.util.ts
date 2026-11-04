import { Types } from 'mongoose';
import { PublicacionDocument } from '../schemas/publicacion.schema';

/**
 * Autor tal como se muestra en el feed. Es lo que devuelve el `populate`
 * limitado con `select`: nunca el correo, ni el perfil, ni el hash.
 */
export interface AutorPublicacion {
  id: string;
  nombre: string;
  apellido: string;
  nombreUsuario: string;
  imagenPerfilUrl: string;
}

export interface PublicacionResponse {
  id: string;
  titulo: string;
  descripcion: string;
  nombreComun: string;
  nombreCientifico: string;
  imagenUrl: string;
  usuario: AutorPublicacion | string;
  cantidadLikes: number;
  /** true si el usuario que hizo el request ya le dio me gusta. */
  likeado: boolean;
  eliminado: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Campos del autor que se piden en el populate. */
export const CAMPOS_AUTOR = 'nombre apellido nombreUsuario imagenPerfilUrl';

/** Forma en la que queda el autor después de `populate`. */
interface UsuarioPopulado {
  _id: Types.ObjectId;
  nombre: string;
  apellido: string;
  nombreUsuario: string;
  imagenPerfilUrl: string;
}

/**
 * Convierte el documento de Mongo a la forma pública:
 * `_id` → `id`, autor populado → objeto reducido, sin `__v` y sin el array
 * crudo de likes (al front le alcanzan `cantidadLikes` y `likeado`).
 *
 * `idUsuarioActual` es quién está mirando el feed: con eso se calcula `likeado`.
 */
export function toPublicacionResponse(
  publicacion: PublicacionDocument,
  idUsuarioActual?: string,
): PublicacionResponse {
  // `.populated('usuario')` devuelve los _id originales sólo si el campo está
  // populado; así sabemos si mapear un objeto o dejar el id suelto.
  const estaPopulado = Boolean(publicacion.populated('usuario'));
  const autor = estaPopulado
    ? (publicacion.usuario as unknown as UsuarioPopulado)
    : null;

  return {
    id: String(publicacion._id),
    titulo: publicacion.titulo,
    descripcion: publicacion.descripcion,
    nombreComun: publicacion.nombreComun ?? '',
    nombreCientifico: publicacion.nombreCientifico ?? '',
    imagenUrl: publicacion.imagenUrl ?? '',
    usuario: autor
      ? {
          id: String(autor._id),
          nombre: autor.nombre,
          apellido: autor.apellido,
          nombreUsuario: autor.nombreUsuario,
          imagenPerfilUrl: autor.imagenPerfilUrl,
        }
      : String(publicacion.usuario),
    cantidadLikes: publicacion.cantidadLikes ?? publicacion.likes?.length ?? 0,
    likeado: idUsuarioActual
      ? (publicacion.likes ?? []).some((id) => String(id) === idUsuarioActual)
      : false,
    eliminado: publicacion.eliminado,
    createdAt: publicacion.createdAt,
    updatedAt: publicacion.updatedAt,
  };
}
