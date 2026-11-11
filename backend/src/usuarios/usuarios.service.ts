import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import type { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import { Perfil, Usuario, UsuarioDocument } from './schemas/usuario.schema';
import {
  toUsuarioResponse,
  UsuarioResponse,
} from './utils/usuario-response.util';

const SALT_ROUNDS = 10;
const CLAVE_DUPLICADA = 11000;
const NO_EXISTE = 'El usuario no existe';

export interface ListadoUsuarios {
  total: number;
  offset: number;
  limit: number;
  /** true si quedan usuarios después de esta página (para el paginador). */
  hayMas: boolean;
  usuarios: UsuarioResponse[];
}

/** Respuesta de la baja/alta lógica: lo mínimo que necesita el dashboard. */
export interface UsuarioEstadoResponse {
  id: string;
  activo: boolean;
  fechaBaja: Date | null;
}

/**
 * Filtro del listado, escrito explícito (igual que en publicaciones) para no
 * depender del nombre interno del tipo de Mongoose, que cambia entre versiones.
 */
type FiltroUsuarios = {
  activo?: { $ne: false } | false;
  perfil?: Perfil;
  $or?: Record<string, RegExp>[];
};

/** Escapa los caracteres especiales para que la búsqueda sea literal. */
const escaparRegex = (texto: string): string =>
  texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Reglas de negocio de los usuarios (Sprint 4).
 *
 * El alta vive acá y no en `AuthService` porque la usan los dos flujos: el
 * registro público (`POST /auth/registro`, siempre perfil "usuario") y el alta
 * del dashboard (`POST /usuarios`, que sí elige perfil). Así las validaciones de
 * duplicados, el hash de la contraseña y la imagen por defecto están una sola vez.
 */
@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /usuarios: listado paginado con búsqueda y filtros por estado y perfil.
   *
   * Nunca devuelve el hash de la contraseña (el esquema lo oculta y además se
   * arma la respuesta con `toUsuarioResponse`).
   */
  async listar(listarDto: ListarUsuariosDto): Promise<ListadoUsuarios> {
    const filtro = this.armarFiltro(listarDto);

    try {
      // Las dos consultas van en paralelo: el total para paginar y la página.
      const [total, documentos] = await Promise.all([
        this.usuarioModel.countDocuments(filtro),
        this.usuarioModel
          .find(filtro)
          .sort({ createdAt: -1, _id: -1 })
          .skip(listarDto.offset)
          .limit(listarDto.limit)
          .exec(),
      ]);

      return {
        total,
        offset: listarDto.offset,
        limit: listarDto.limit,
        hayMas: listarDto.offset + documentos.length < total,
        usuarios: documentos.map(toUsuarioResponse),
      };
    } catch (error) {
      this.logger.error(
        'No se pudieron obtener los usuarios',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No se pudieron obtener los usuarios',
      );
    }
  }
  /**
   * POST /usuarios (y POST /auth/registro, que delega acá).
   *
   * Copiamos campo por campo en vez de `...crearDto`: así el cliente no puede
   * inyectar `activo`, `fechaBaja` ni el hash de la contraseña.
   */
  async crear(
    crearDto: CrearUsuarioDto,
    archivo?: Express.Multer.File,
  ): Promise<UsuarioResponse> {
    const { password, perfil, ...datos } = crearDto;

    try {
      // 1) Preguntamos antes de insertar para poder decir QUÉ campo está en uso
      //    (el índice unique de Mongo devuelve un error genérico).
      await this.verificarDisponibilidad(datos.correo, datos.nombreUsuario);

      // 2) bcrypt con salt: la contraseña nunca se guarda en texto plano.
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // 3) Imagen opcional; sin archivo se usa la de perfil por defecto.
      const imagenPerfilUrl = archivo
        ? await this.cloudinaryService.uploadImage(archivo)
        : (this.configService.get<string>('DEFAULT_AVATAR_URL') ?? '');

      const usuario = await this.usuarioModel.create({
        nombre: datos.nombre,
        apellido: datos.apellido,
        correo: datos.correo,
        nombreUsuario: datos.nombreUsuario,
        password: passwordHash,
        fechaNacimiento: datos.fechaNacimiento,
        descripcion: datos.descripcion ?? '',
        imagenPerfilUrl,
        // Sólo el dashboard puede crear administradores: el registro público
        // siempre llama con 'usuario' (lo fuerza AuthService).
        perfil: perfil ?? 'usuario',
        activo: true,
      });

      return toUsuarioResponse(usuario);
    } catch (error) {
      // Los 409 de disponibilidad y el 500 de Cloudinary ya son HttpException:
      // salen tal cual, con su status y su mensaje.
      if (error instanceof HttpException) {
        throw error;
      }

      // Dos altas simultáneas: el índice unique de Mongo frena a la segunda.
      if (this.esClaveDuplicada(error)) {
        throw new ConflictException('El correo o nombre de usuario ya existe');
      }

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

  /**
   * Baja o alta lógica de una cuenta.
   *
   * - `DELETE /usuarios/:id` → deshabilitar (`activo: false`).
   * - `PATCH /usuarios/:id/estado` → `{ activo: true|false }` (idempotente).
   *
   * No se borra el documento: sus publicaciones y comentarios siguen existiendo
   * (la consigna sólo pide que no pueda ingresar).
   */
  async cambiarEstado(
    id: string,
    activo: boolean,
    administrador: UsuarioAutenticado,
  ): Promise<UsuarioEstadoResponse> {
    // Si el único administrador se deshabilita a sí mismo, el panel queda sin
    // nadie que pueda rehabilitarlo: se frena con un 403 explicativo.
    if (!activo && id === administrador.id) {
      throw new ForbiddenException('No podés deshabilitar tu propia cuenta');
    }

    const usuario = await this.usuarioModel
      .findByIdAndUpdate(
        id,
        activo
          ? // Al rehabilitar hay que SACAR el campo (asignar undefined no lo
            // borra en Mongo): por eso el $unset.
            { activo: true, $unset: { fechaBaja: 1 } }
          : { activo: false, fechaBaja: new Date() },
        { new: true },
      )
      .exec();

    if (!usuario) {
      throw new NotFoundException(NO_EXISTE);
    }

    return {
      id: String(usuario._id),
      // `!== false`: cubre los documentos previos al Sprint #4, que no tienen
      // el campo y tienen que seguir contando como habilitados.
      activo: usuario.activo !== false,
      fechaBaja: usuario.fechaBaja ?? null,
    };
  }

  /** Traduce la query string a un filtro de Mongo. */
  private armarFiltro(listarDto: ListarUsuariosDto): FiltroUsuarios {
    const filtro: FiltroUsuarios = {};

    if (listarDto.estado === 'activos') {
      // `$ne: false` (y no `true`) para incluir los usuarios creados antes de
      // que existiera el campo `activo`.
      filtro.activo = { $ne: false };
    } else if (listarDto.estado === 'deshabilitados') {
      filtro.activo = false;
    }

    if (listarDto.perfil) {
      filtro.perfil = listarDto.perfil;
    }

    const busqueda = listarDto.busqueda?.trim();
    if (busqueda) {
      // Una sola expresión para los cuatro campos: con este volumen no hace
      // falta un índice de texto y el `$or` mantiene la consulta simple.
      const patron = new RegExp(escaparRegex(busqueda), 'i');
      filtro.$or = [
        { nombre: patron },
        { apellido: patron },
        { correo: patron },
        { nombreUsuario: patron },
      ];
    }

    return filtro;
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

