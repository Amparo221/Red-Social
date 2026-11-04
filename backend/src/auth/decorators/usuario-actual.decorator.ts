import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  RequestConUsuario,
  UsuarioAutenticado,
} from '../interfaces/jwt-payload.interface';

/**
 * Inyecta en el controller el usuario que resolvió el `JwtAuthGuard`:
 *
 * ```ts
 * @Post()
 * crear(@Body() dto: CreatePublicacionDto, @UsuarioActual() usuario: UsuarioAutenticado) {}
 * ```
 *
 * Si falta el guard en la ruta, el error salta en desarrollo en lugar de dejar
 * pasar un `undefined` silencioso.
 */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const request = contexto.switchToHttp().getRequest<RequestConUsuario>();

    if (!request.usuario) {
      throw new Error('@UsuarioActual() requiere el JwtAuthGuard en la ruta');
    }

    return request.usuario;
  },
);
