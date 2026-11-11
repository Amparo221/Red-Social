/**
 * Tipos que reflejan el contrato del backend (ver
 * backend/src/usuarios/utils/usuario-response.util.ts).
 */

export type PerfilUsuario = 'usuario' | 'administrador';

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
  /**
   * Baja lógica (Sprint 4). `false` = deshabilitado. Es opcional porque las
   * sesiones guardadas antes de este sprint (y los documentos viejos de Atlas)
   * no traen el campo: en ese caso la cuenta cuenta como habilitada.
   */
  activo?: boolean;
  /** Fecha de la baja; `null` (o ausente) mientras la cuenta está habilitada. */
  fechaBaja?: string | null;
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
  /**
   * Sólo lo usa el alta del dashboard (POST /usuarios). El registro público no
   * manda este campo: el backend fuerza 'usuario' pase lo que pase.
   */
  perfil?: PerfilUsuario;
}

/** Estados que acepta el filtro del listado del dashboard. */
export type EstadoUsuario = 'activos' | 'deshabilitados';

/** Cantidad de usuarios por página en el dashboard (igual que el backend). */
export const USUARIOS_POR_PAGINA = 10;

/** Respuesta de GET /usuarios (sólo administradores). */
export interface ListadoUsuarios {
  total: number;
  offset: number;
  limit: number;
  hayMas: boolean;
  usuarios: Usuario[];
}

/** Parámetros de GET /usuarios. */
export interface FiltrosUsuarios {
  offset?: number;
  limit?: number;
  /** Busca en nombre, apellido, correo y nombre de usuario. */
  busqueda?: string;
  estado?: EstadoUsuario;
  perfil?: PerfilUsuario;
}

/** Respuesta de DELETE /usuarios/:id y PATCH /usuarios/:id/estado. */
export interface EstadoCambiado {
  id: string;
  activo: boolean;
  fechaBaja: string | null;
}

/** Cuerpo de error estándar de NestJS. */
export interface ErrorNest {
  statusCode: number;
  message: string | string[];
  error?: string;
  /** Código corto de los guards (por ejemplo `CUENTA_DESHABILITADA`). */
  motivo?: string;
  detalle?: string;
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

/**
 * Una cuenta está habilitada salvo que el backend diga `activo: false`.
 * El `!== false` (en vez de `=== true`) contempla los usuarios creados antes
 * del Sprint 4, que no tienen el campo guardado.
 */
export function estaHabilitado(usuario: Pick<Usuario, 'activo'> | null | undefined): boolean {
  return usuario?.activo !== false;
}

