import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  JwtPayload,
  RequestConUsuario,
} from '../interfaces/jwt-payload.interface';

/**
 * Guard de sesión: exige el header `Authorization: Bearer <token>` y valida el
 * JWT antes de dejar pasar el request.
 *
 * El id del usuario para likes y bajas sale SIEMPRE de acá (del token firmado),
 * nunca de un id que mande el cliente por body o query, porque ese id se podría
 * falsificar y cualquiera podría borrar publicaciones ajenas.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const token = this.extraerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }

    try {
      // verify() usa el secret configurado en el JwtModule y además controla el
      // vencimiento: un token expirado cae en el catch igual que una firma rota.
      const payload = this.jwtService.verify<JwtPayload>(token);

      request.usuario = {
        id: payload.sub,
        nombreUsuario: payload.nombreUsuario,
        perfil: payload.perfil,
      };

      return true;
    } catch {
      throw new UnauthorizedException('El token es inválido o expiró');
    }
  }

  /** Acepta el formato estándar `Bearer <token>` (el esquema no distingue mayúsculas). */
  private extraerToken(header?: string): string | null {
    const [esquema, token] = (header ?? '').split(' ');
    return esquema?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
