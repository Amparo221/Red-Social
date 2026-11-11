import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestConUsuario } from '../interfaces/jwt-payload.interface';
import { Perfil } from '../../usuarios/schemas/usuario.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Autorización por perfil (Sprint 4): deja pasar sólo si el perfil del usuario
 * autenticado está entre los declarados con `@Roles(...)`.
 *
 * El perfil NO se lee del token sino de `request.usuario`, que el
 * `JwtAuthGuard` completa con los datos frescos de la base: si a un
 * administrador se le quita el perfil, deja de tener acceso en el acto (el
 * token que ya tenía firmado no le sirve).
 *
 * Las rutas sin `@Roles` no se ven afectadas (`return true`), así el guard se
 * puede sumar a un controller sin tocar sus otros métodos.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride: `@Roles` puede estar en el método y en la clase; gana
    // el del método, que es el más específico.
    const permitidos = this.reflector.getAllAndOverride<Perfil[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permitidos || permitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const usuario = request.usuario;

    // Si falta `usuario`, alguien se olvidó del JwtAuthGuard en la ruta: se
    // responde 403 igual, nunca se deja pasar.
    if (!usuario || !permitidos.includes(usuario.perfil)) {
      throw new ForbiddenException(
        'Sólo un administrador puede realizar esta acción',
      );
    }

    return true;
  }
}
