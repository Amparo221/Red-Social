import type { Request } from 'express';
import { Perfil } from '../../usuarios/schemas/usuario.schema';

/**
 * Contenido del JWT que firma el backend.
 *
 * - `sub` (subject) es el id del usuario: es la convención de la librería y
 *   evita que un campo genérico como `id` se confunda con otros datos.
 * - Sólo viajan datos que no son secretos: nunca la contraseña ni el correo.
 */
export interface JwtPayload {
  sub: string;
  nombreUsuario: string;
  perfil: Perfil;
}

/**
 * Usuario autenticado que el `JwtAuthGuard` deja disponible en `request.usuario`
 * y que los controladores reciben con `@UsuarioActual()`.
 */
export interface UsuarioAutenticado {
  id: string;
  nombreUsuario: string;
  perfil: Perfil;
}

/** Request de Express ya enriquecido por el guard. */
export interface RequestConUsuario extends Request {
  usuario?: UsuarioAutenticado;
}
