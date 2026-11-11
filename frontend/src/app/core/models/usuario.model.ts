/**
 * Tipos que reflejan el contrato del backend (ver
 * backend/src/usuarios/utils/usuario-response.util.ts).
 */

/** Usuario público: el backend nunca devuelve el hash del password. */
export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  nombreUsuario: string;
  fechaNacimiento: string;
  descripcion: string;
  imagenPerfilUrl: string;
  perfil: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Lo que devuelven /auth/login y /auth/registro: el usuario público + el JWT.
 * El token se guarda junto con el usuario para no tener dos claves en el
 * navegador (y para poder restaurar la sesión completa con un F5).
 */
export interface Sesion extends Usuario {
  token: string;
}

/** POST /auth/login: el identificador puede ser el correo o el nombre de usuario. */
export interface Credenciales {
  identificador: string;
  password: string;
}

/** Campos que viajan en el multipart de POST /auth/registro. */
export interface NuevoUsuario {
  nombre: string;
  apellido: string;
  correo: string;
  nombreUsuario: string;
  password: string;
  fechaNacimiento: string;
  descripcion?: string;
}

/** Cuerpo de error estándar de NestJS. */
export interface ErrorNest {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/**
 * Tiempos de la sesión que expone `GET /auth/sesion` (Sprint 4).
 * Salen del `.env` del backend (`JWT_EXPIRES_IN` y `SESION_AVISO_SEGUNDOS`),
 * así que el front no los hardcodea: los pide al arrancar.
 */
export interface PoliticaSesion {
  /** Duración total del JWT, en segundos. */
  expiracionSegundos: number;
  /** Cuántos segundos antes del vencimiento aparece el aviso. */
  avisoSegundos: number;
}

/**
 * Fallback si `/auth/sesion` no responde (backend caído o versión vieja):
 * son los mismos valores por defecto del backend, para no quedar sin aviso.
 */
export const POLITICA_SESION_POR_DEFECTO: PoliticaSesion = {
  expiracionSegundos: 900,
  avisoSegundos: 300,
};

/** Avatar que se muestra si el usuario no tiene foto propia. */
export const AVATAR_POR_DEFECTO = 'avatar-por-defecto.svg';

/** Devuelve la URL del avatar, con fallback al placeholder local. */
export function urlAvatar(usuario: Pick<Usuario, 'imagenPerfilUrl'> | null | undefined): string {
  const url = usuario?.imagenPerfilUrl?.trim();
  return url ? url : AVATAR_POR_DEFECTO;
}

/**
 * El backend permite borrar una publicación si sos el autor **o** administrador
 * (ver PublicacionesService.eliminar). El front usa lo mismo para decidir si
 * muestra el botón. Los perfiles válidos están en
 * backend/src/usuarios/schemas/usuario.schema.ts: 'usuario' | 'administrador'.
 */
export function esAdministrador(usuario: Pick<Usuario, 'perfil'> | null | undefined): boolean {
  return usuario?.perfil === 'administrador';
}
