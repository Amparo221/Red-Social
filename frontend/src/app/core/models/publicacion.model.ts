/**
 * Tipos que reflejan el contrato del backend
 * (ver backend/src/publicaciones/utils/publicacion-response.util.ts y
 * backend/src/publicaciones/publicaciones.service.ts).
 */

/**
 * Autor tal como lo devuelve el `populate` del feed: nunca el correo, ni el
 * perfil, ni el hash del password.
 */
export interface AutorPublicacion {
  id: string;
  nombre: string;
  apellido: string;
  nombreUsuario: string;
  imagenPerfilUrl: string;
}

export interface Publicacion {
  id: string;
  titulo: string;
  descripcion: string;
  nombreComun: string;
  nombreCientifico: string;
  imagenUrl: string;
  /**
   * Populado en el feed y al crear, pero el contrato admite el id suelto: si el
   * autor se borró de la base, Mongoose deja el ObjectId como string.
   */
  usuario: AutorPublicacion | string;
  cantidadLikes: number;
  /** true si el usuario de la sesión ya le dio me gusta (lo calcula el backend). */
  likeado: boolean;
  eliminado: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Órdenes que acepta GET /publicaciones. */
export type OrdenPublicaciones = 'fecha' | 'likes';

/** Respuesta paginada del feed; `hayMas` y `total` ya vienen calculados. */
export interface ListadoPublicaciones {
  total: number;
  offset: number;
  limit: number;
  orden: OrdenPublicaciones;
  hayMas: boolean;
  publicaciones: Publicacion[];
}

/** Parámetros de GET /publicaciones (todos opcionales: el backend tiene defaults). */
export interface FiltrosPublicaciones {
  offset?: number;
  limit?: number;
  orden?: OrdenPublicaciones;
  /** Filtra por autor (id del usuario). */
  usuario?: string;
}

/** Respuesta de POST y DELETE /publicaciones/:id/like. */
export interface ResultadoLike {
  id: string;
  cantidadLikes: number;
  likeado: boolean;
}

/** Respuesta de DELETE /publicaciones/:id (baja lógica, no borra el documento). */
export interface PublicacionEliminada {
  id: string;
  eliminado: boolean;
  fechaEliminacion?: string;
}

/** Campos que viajan en el multipart de POST /publicaciones. */
export interface NuevaPublicacion {
  titulo: string;
  descripcion: string;
  nombreComun?: string;
  nombreCientifico?: string;
}

/** El backend limita el page size a 50 (ListarPublicacionesDto). */
export const PUBLICACIONES_POR_PAGINA = 6;

/** Autor de la publicación, o null si el backend devolvió sólo el id. */
export function autorDe(publicacion: Publicacion): AutorPublicacion | null {
  return typeof publicacion.usuario === 'string' ? null : publicacion.usuario;
}

/** Nombre visible del autor: "Ana Moreno" o "@anamoreno" si no hay nombre. */
export function nombreAutor(publicacion: Publicacion): string {
  const autor = autorDe(publicacion);
  if (!autor) {
    return 'Usuario eliminado';
  }
  const nombreCompleto = `${autor.nombre ?? ''} ${autor.apellido ?? ''}`.trim();
  return nombreCompleto || `@${autor.nombreUsuario}`;
}

/** true si el usuario de la sesión es el autor (habilita el botón de borrar). */
export function esAutor(publicacion: Publicacion, idUsuario: string | null | undefined): boolean {
  const autor = autorDe(publicacion);
  return !!idUsuario && !!autor && autor.id === idUsuario;
}

/**
 * Comentario de una publicación.
 * Contrato: backend/src/comentarios/utils/comentario-response.util.ts
 */
export interface Comentario {
  id: string;
  texto: string;
  /**
   * Autor populado en el detalle, pero el contrato admite el id suelto: si el
   * autor se borró de la base, Mongoose deja el ObjectId como string.
   */
  autor: AutorPublicacion | string;
  eliminado?: boolean;
  /** true si el texto se editó alguna vez (badge "editado"). */
  editado?: boolean;
  /** Cuándo se editó por última vez (null si nunca). */
  fechaEdicion?: string | null;
  /** Los agrega `timestamps: true` en Mongoose. */
  createdAt?: string;
  updatedAt?: string;
}

/** Respuesta de DELETE /comentarios/:id (baja lógica, no borra el documento). */
export interface ComentarioEliminado {
  id: string;
  eliminado: boolean;
}

/** Respuesta paginada de GET /publicaciones/:id/comentarios (Sprint 4). */
export interface ListadoComentarios {
  total: number;
  offset: number;
  limit: number;
  hayMas: boolean;
  comentarios: Comentario[];
}

/** Parámetros de GET /publicaciones/:id/comentarios (el backend tiene defaults). */
export interface FiltrosComentarios {
  offset?: number;
  limit?: number;
}

/** El backend valida 1..500 caracteres (CrearComentarioDto). */
export const MAXIMO_TEXTO_COMENTARIO = 500;

/** Comentarios que se muestran al abrir la lista y en cada "cargar más". */
export const COMENTARIOS_POR_PAGINA = 3;

/** Autor del comentario, o null si el backend devolvió sólo el id. */
export function autorComentarioDe(comentario: Comentario): AutorPublicacion | null {
  return typeof comentario.autor === 'string' ? null : comentario.autor;
}

/** Nombre visible del autor de un comentario. */
export function nombreAutorComentario(comentario: Comentario): string {
  const autor = autorComentarioDe(comentario);
  if (!autor) {
    return 'Usuario eliminado';
  }
  const nombreCompleto = `${autor.nombre ?? ''} ${autor.apellido ?? ''}`.trim();
  return nombreCompleto || `@${autor.nombreUsuario}`;
}

/**
 * true si el usuario de la sesión puede eliminar el comentario.
 * El backend lo permite para el autor del comentario o un administrador.
 */
export function esAutorComentario(
  comentario: Comentario,
  idUsuario: string | null | undefined,
  esAdministrador = false,
): boolean {
  if (esAdministrador) {
    return true;
  }
  const autor = autorComentarioDe(comentario);
  return !!idUsuario && !!autor && autor.id === idUsuario;
}

/**
 * true si el comentario ya fue editado alguna vez.
 * Se miran las dos marcas: el backend manda `editado` y, por si llega una
 * respuesta vieja, la fecha de edición también alcanza.
 */
export function estaEditado(comentario: Comentario): boolean {
  return comentario.editado === true || !!comentario.fechaEdicion;
}

/**
 * true si el usuario de la sesión puede editar el comentario.
 * Más restrictivo que borrar: sólo el autor (el administrador modera, pero no
 * reescribe textos ajenos). Refleja la regla del backend.
 */
export function puedeEditarComentario(
  comentario: Comentario,
  idUsuario: string | null | undefined,
): boolean {
  const autor = autorComentarioDe(comentario);
  return !!idUsuario && !!autor && autor.id === idUsuario;
}

