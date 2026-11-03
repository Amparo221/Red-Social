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
