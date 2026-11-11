import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Usuario, UsuarioDocument } from '../usuarios/schemas/usuario.schema';
import {
  toUsuarioResponse,
  UsuarioResponse,
} from '../usuarios/utils/usuario-response.util';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { leerPoliticaSesion, PoliticaSesion } from './utils/sesion-config.util';

const SALT_ROUNDS = 10;
const CREDENCIALES_INVALIDAS = 'Usuario/correo o contraseña incorrectos';
const CLAVE_DUPLICADA = 11000;

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async registrar(
    registerDto: RegisterDto,
    file?: Express.Multer.File,
  ): Promise<UsuarioConToken> {
    // Separamos la contraseña: el resto son los datos que se guardan tal cual.
    const { password, ...datos } = registerDto;

    // Todo el flujo va dentro del try: si falla la base, Cloudinary o bcrypt,
    // el cliente recibe un JSON con `message` y `detalle` (en vez de un 500 sin
    // cuerpo) y el stack completo queda en el log del servidor.
    try {
      // 1) Los índices unique devuelven un error genérico; preguntamos antes para
      //    poder responder qué campo está en uso.
      await this.verificarDisponibilidad(datos.correo, datos.nombreUsuario);

      // 2) Nunca guardamos la contraseña en texto plano: bcrypt genera un salt y
      //    un hash irreversible (con el mismo salt, el hash es el mismo).
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // 3) Imagen opcional: si el usuario no subió una, usamos la de perfil
      //    por defecto (subida una sola vez a Cloudinary).
      const imagenPerfilUrl = file
        ? await this.cloudinaryService.uploadImage(file)
        : (this.configService.get<string>('DEFAULT_AVATAR_URL') ?? '');

      // 4) Copiamos campo por campo (no `...registerDto`): así el cliente no
      //    puede inyectar `perfil: 'administrador'` ni pisar otros campos.
      const usuario = await this.usuarioModel.create({
        nombre: datos.nombre,
        apellido: datos.apellido,
        correo: datos.correo,
        nombreUsuario: datos.nombreUsuario,
        password: passwordHash,
        fechaNacimiento: datos.fechaNacimiento,
        descripcion: datos.descripcion ?? '',
        imagenPerfilUrl,
        perfil: 'usuario',
      });

      // 5) Devolvemos la forma pública (sin password, sin __v) + el token: al
      //    registrarse el usuario ya queda logueado.
      return this.conToken(toUsuarioResponse(usuario));
    } catch (error) {
      // Los 409 de disponibilidad y el 500 de Cloudinary ya son HttpException:
      // salen tal cual, con su status y su mensaje.
      if (error instanceof HttpException) {
        throw error;
      }

      // Si dos registros simultáneos pasan el chequeo anterior, el índice unique
      // de Mongo frena al segundo con el código 11000.
      if (this.esClaveDuplicada(error)) {
        throw new ConflictException('El correo o nombre de usuario ya existe');
      }

      // Cualquier otra cosa es una falla de infraestructura: Mongo inaccesible,
      // credenciales vencidas, una variable de entorno que falta…
      const detalle = error instanceof Error ? error.message : String(error);

      this.logger.error(
        'No se pudo crear el usuario',
        error instanceof Error ? error.stack : detalle,
      );

      throw new InternalServerErrorException({
        statusCode: 500,
        message: 'No se pudo crear el usuario',
        error: 'Internal Server Error',
        detalle,
      });
    }
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

  private async verificarDisponibilidad(
    correo: string,
    nombreUsuario: string,
  ): Promise<void> {
    const correoEnUso = await this.usuarioModel.exists({ correo });
    if (correoEnUso) {
      throw new ConflictException('El correo ya está registrado');
    }

    const nombreEnUso = await this.usuarioModel.exists({ nombreUsuario });
    if (nombreEnUso) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }
  }

  private esClaveDuplicada(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === CLAVE_DUPLICADA
    );
  }
}
