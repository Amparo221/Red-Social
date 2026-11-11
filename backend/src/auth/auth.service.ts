import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from '../usuarios/schemas/usuario.schema';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  toUsuarioResponse,
  UsuarioResponse,
} from '../usuarios/utils/usuario-response.util';
import {
  CUENTA_DESHABILITADA,
  MOTIVO_CUENTA_DESHABILITADA,
} from './constants/cuenta-deshabilitada';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { leerPoliticaSesion, PoliticaSesion } from './utils/sesion-config.util';

const CREDENCIALES_INVALIDAS = 'Usuario/correo o contraseña incorrectos';

/**
 * Respuesta de registro/login: el usuario público + el JWT.
 *
 * El token se agrega como un campo más en vez de envolver la respuesta
 * (`{ usuario, token }`) para no romper al front del Sprint #1, que ya guarda
 * el usuario tal cual lo recibe.
 */
export interface UsuarioConToken extends UsuarioResponse {
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
  ) {}

  /**
   * POST /auth/registro.
   *
   * El alta en sí vive en `UsuariosService.crear` (la comparte el dashboard):
   * acá se fuerza el perfil "usuario" y se firma el token, así el que se
   * registra queda logueado. Ojo: el body del registro público NO tiene el
   * campo `perfil`, y aunque lo mandara, este método lo pisa siempre.
   */
  async registrar(
    registerDto: RegisterDto,
    file?: Express.Multer.File,
  ): Promise<UsuarioConToken> {
    const usuario = await this.usuariosService.crear(
      { ...registerDto, perfil: 'usuario' },
      file,
    );

    return this.conToken(usuario);
  }

  async login(
    identificador: string,
    passwordPlano: string,
  ): Promise<UsuarioConToken> {
    // `identificador` puede ser el correo o el nombre de usuario. Los dos se
    // guardan en minúsculas, así que normalizamos también lo que llega por el
    // body: el login no distingue mayúsculas ni espacios sobrantes.
    const identificadorNormalizado = identificador.trim().toLowerCase();

    // `.select('+password')` es necesario porque el esquema lo oculta por defecto.
    const usuario = await this.usuarioModel
      .findOne({
        $or: [
          { correo: identificadorNormalizado },
          { nombreUsuario: identificadorNormalizado },
        ],
      })
      .select('+password');

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: no le
    // contamos a un atacante cuál de los dos datos existe.
    if (!usuario) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    const coincide = await bcrypt.compare(passwordPlano, usuario.password);
    if (!coincide) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    // La baja lógica se informa recién después de validar la contraseña: así el
    // mensaje no le confirma a un atacante que la cuenta existe.
    if (usuario.activo === false) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: CUENTA_DESHABILITADA,
        error: 'Unauthorized',
        motivo: MOTIVO_CUENTA_DESHABILITADA,
      });
    }

    return this.conToken(toUsuarioResponse(usuario));
  }

  /**
   * GET /auth/autorizar
   *
   * Lo llama el front al arrancar: el `JwtAuthGuard` ya validó la firma y el
   * vencimiento del token, acá sólo confirmamos que el usuario del payload
   * sigue existiendo y devolvemos sus datos frescos.
   *
   * No firma un token nuevo a propósito: esto valida la sesión guardada en el
   * navegador, no la renueva. Para renovarla está `POST /auth/refrescar`.
   */
  async autorizar(id: string): Promise<UsuarioResponse> {
    const usuario = await this.usuarioModel.findById(id).exec();

    if (!usuario) {
      throw new UnauthorizedException('El usuario del token ya no existe');
    }

    // Defensa en profundidad: el `JwtAuthGuard` ya rechazó a los deshabilitados,
    // pero esta consulta podría ganarle una carrera a una baja recién hecha.
    if (usuario.activo === false) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: CUENTA_DESHABILITADA,
        error: 'Unauthorized',
        motivo: MOTIVO_CUENTA_DESHABILITADA,
      });
    }

    return toUsuarioResponse(usuario);
  }

  /**
   * GET /auth/sesion (público)
   *
   * Tiempos de la sesión para que el frontend no los hardcodee: el splash, el
   * cronómetro y el modal de aviso se ajustan solos cambiando
   * `JWT_EXPIRES_IN` / `SESION_AVISO_SEGUNDOS` en el `.env` del backend.
   */
  politicaSesion(): PoliticaSesion {
    return leerPoliticaSesion(this.configService);
  }

  /**
   * POST /auth/refrescar
   *
   * Renueva la sesión sin pedir la contraseña otra vez: el `JwtAuthGuard`
   * confirmó que el token actual es válido y acá se firma uno nuevo con la
   * misma duración. Es lo que llama el botón "Extender sesión" del aviso.
   */
  async refrescar(id: string): Promise<UsuarioConToken> {
    // Reutiliza la validación de `autorizar`: si el usuario ya no existe, 401.
    return this.conToken(await this.autorizar(id));
  }

  /**
   * Firma el JWT con los datos mínimos que el guard necesita para identificar
   * al usuario en los próximos requests (id, nombre de usuario y perfil).
   * El vencimiento y el secret los pone el JwtModule desde el .env.
   */
  private conToken(usuario: UsuarioResponse): UsuarioConToken {
    const payload: JwtPayload = {
      sub: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      perfil: usuario.perfil,
    };

    return { ...usuario, token: this.jwtService.sign(payload) };
  }
}
