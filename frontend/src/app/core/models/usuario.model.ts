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

/** Avatar que se muestra si el usuario no tiene foto propia. */
export const AVATAR_POR_DEFECTO = 'avatar-por-defecto.svg';

/** Devuelve la URL del avatar, con fallback al placeholder local. */
export function urlAvatar(usuario: Pick<Usuario, 'imagenPerfilUrl'> | null | undefined): string {
  const url = usuario?.imagenPerfilUrl?.trim();
  return url ? url : AVATAR_POR_DEFECTO;
}
