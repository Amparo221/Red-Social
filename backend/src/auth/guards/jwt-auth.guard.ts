import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Usuario,
  UsuarioDocument,
} from '../../usuarios/schemas/usuario.schema';
import {
  CUENTA_DESHABILITADA,
  MOTIVO_CUENTA_DESHABILITADA,
} from '../constants/cuenta-deshabilitada';
import {
  JwtPayload,
  RequestConUsuario,
} from '../interfaces/jwt-payload.interface';

/**
 * Guard de sesión: exige el header `Authorization: Bearer <token>`, valida el
 * JWT y confirma contra la base que la cuenta siga habilitada.
 *
 * El id del usuario para likes y bajas sale SIEMPRE de acá (del token firmado),
 * nunca de un id que mande el cliente por body o query, porque ese id se podría
 * falsificar y cualquiera podría borrar publicaciones ajenas.
 *
 * ¿Por qué consulta la base en cada request (Sprint 4)? Es la única forma de
 * que la baja lógica sea inmediata: el token dura 15 minutos y, sin esta
 * consulta, un usuario deshabilitado podría seguir usando la API hasta que
 * venciera. De paso el `perfil` se toma de la base y no del token, así que
 * quitarle el rol de administrador a alguien tiene efecto en el acto.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const token = this.extraerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }

    const payload = this.verificarFirma(token);

    // `.select()`: sólo los tres campos que necesita el request. El hash de la
    // contraseña jamás se trae acá.
    const usuario = await this.usuarioModel
      .findById(payload.sub)
      .select('activo perfil nombreUsuario')
      .exec();

    // Token válido pero usuario inexistente (base recreada, cuenta borrada a
    // mano): la sesión guardada en el navegador quedó inservible.
    if (!usuario) {
      throw new UnauthorizedException('El usuario del token ya no existe');
    }

    // Baja lógica: 401 (no 403) para que el front borre la sesión guardada. El
    // `motivo` le indica que muestre "cuenta deshabilitada" en el login y no
    // "la sesión expiró".
    if (usuario.activo === false) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: CUENTA_DESHABILITADA,
        error: 'Unauthorized',
        motivo: MOTIVO_CUENTA_DESHABILITADA,
      });
    }

    request.usuario = {
      id: String(usuario._id),
      nombreUsuario: usuario.nombreUsuario,
      perfil: usuario.perfil,
    };

    return true;
  }

  /** verify() controla firma y vencimiento; un token roto cae en el mismo 401. */
  private verificarFirma(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
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

