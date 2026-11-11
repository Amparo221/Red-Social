import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../../usuarios/schemas/usuario.schema';

/** Clave con la que el `RolesGuard` lee los perfiles permitidos. */
export const ROLES_KEY = 'roles';

/**
 * Restringe una ruta (o un controller entero) a los perfiles indicados.
 *
 * ```ts
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('administrador')
 * @Controller('usuarios')
 * ```
 *
 * Se usa junto al `JwtAuthGuard`: el guard de sesión resuelve QUIÉN es el
 * usuario y `RolesGuard` decide si su perfil alcanza. Sin el primero, este
 * decorador no tendría datos para comparar.
 */
export const Roles = (...perfiles: Perfil[]) => SetMetadata(ROLES_KEY, perfiles);
