import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import {
  CARPETA_PUBLICACIONES,
  CloudinaryService,
} from '../cloudinary/cloudinary.service';
import { CreatePublicacionDto } from './dto/create-publicacion.dto';
import {
  ListarPublicacionesDto,
  OrdenPublicaciones,
} from './dto/listar-publicaciones.dto';
import { Publicacion, PublicacionDocument } from './schemas/publicacion.schema';
import {
  CAMPOS_AUTOR,
  PublicacionResponse,
  toPublicacionResponse,
} from './utils/publicacion-response.util';

export interface ListadoPublicaciones {
  total: number;
  offset: number;
  limit: number;
  orden: OrdenPublicaciones;
  /** true si quedan publicaciones después de esta página (para el scroll). */
  hayMas: boolean;
  publicaciones: PublicacionResponse[];
}

export interface ResultadoLike {
  id: string;
  cantidadLikes: number;
  likeado: boolean;
}

const NO_EXISTE = 'La publicación no existe o fue eliminada';

/**
 * Filtro de búsqueda tal como lo usa `listar`. Lo escribimos explícito en vez
 * de importar el tipo interno de Mongoose (en la v9 `FilterQuery` pasó a
 * llamarse `QueryFilter`): así el código no se rompe al actualizar la librería.
 */
type FiltroPublicaciones = { eliminado: boolean; usuario?: Types.ObjectId };

@Injectable()
export class PublicacionesService {
  private readonly logger = new Logger(PublicacionesService.name);

  constructor(
    @InjectModel(Publicacion.name)
    private readonly publicacionModel: Model<PublicacionDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * POST /publicaciones. La imagen (opcional) se sube a Cloudinary y en la base
   * sólo queda la URL; el autor sale del token, no del body.
   */
  async crear(
    createDto: CreatePublicacionDto,
    usuario: UsuarioAutenticado,
    archivo?: Express.Multer.File,
  ): Promise<PublicacionResponse> {
    const imagenUrl = archivo
      ? await this.cloudinaryService.uploadImage(
          archivo,
          undefined,
          CARPETA_PUBLICACIONES,
        )
      : '';

    try {
      // Campo por campo (no `...createDto`): así el cliente no puede forzar el
      // autor, los likes ni el estado de baja.
      const publicacion = await this.publicacionModel.create({
        titulo: createDto.titulo,
        descripcion: createDto.descripcion,
        nombreComun: createDto.nombreComun ?? '',
        nombreCientifico: createDto.nombreCientifico ?? '',
        imagenUrl,
        usuario: new Types.ObjectId(usuario.id),
        likes: [],
        cantidadLikes: 0,
        eliminado: false,
      });

      // El documento recién creado trae el autor como id; lo populamos para
      // devolver el mismo formato que el feed (nombre, foto, etc.).
      await publicacion.populate({ path: 'usuario', select: CAMPOS_AUTOR });

      return toPublicacionResponse(publicacion, usuario.id);
    } catch (error) {
      this.logger.error(
        'No se pudo crear la publicación',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('No se pudo crear la publicación');
    }
  }

  /**
   * GET /publicaciones: últimas publicaciones, sin las dadas de baja, con
   * paginación (offset/limit), orden por fecha o por cantidad de me gusta y
   * filtro opcional por autor.
   */
  async listar(
    listarDto: ListarPublicacionesDto,
    usuario: UsuarioAutenticado,
  ): Promise<ListadoPublicaciones> {
    // La baja es lógica: el filtro por `eliminado` no es opcional.
    const filtro: FiltroPublicaciones = { eliminado: false };

    if (listarDto.usuario) {
      filtro.usuario = new Types.ObjectId(listarDto.usuario);
    }

    // Las dos consultas van en paralelo: el total para paginar y la página.
    const [total, documentos] = await Promise.all([
      this.publicacionModel.countDocuments(filtro),
      this.publicacionModel
        .find(filtro)
        .sort(this.armarOrden(listarDto.orden))
        .skip(listarDto.offset)
        .limit(listarDto.limit)
        .populate({ path: 'usuario', select: CAMPOS_AUTOR })
        .exec(),
    ]);

    return {
      total,
      offset: listarDto.offset,
      limit: listarDto.limit,
      orden: listarDto.orden,
      hayMas: listarDto.offset + documentos.length < total,
      publicaciones: documentos.map((documento) =>
        toPublicacionResponse(documento, usuario.id),
      ),
    };
  }

  /**
   * POST /publicaciones/:id/like.
   *
   * Todo se resuelve en una sola operación atómica: el filtro
   * `likes: { $ne: usuario }` es el que garantiza el "un me gusta por usuario".
   * Si dos requests iguales llegan a la vez, el segundo no matchea y responde
   * 409 (con leer-y-guardar los dos pasarían y el contador quedaría en 2).
   */
  async darLike(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoLike> {
    const actualizada = await this.publicacionModel
      .findOneAndUpdate(
        { _id: id, eliminado: false, likes: { $ne: usuario.id } },
        { $addToSet: { likes: usuario.id }, $inc: { cantidadLikes: 1 } },
        { new: true },
      )
      .exec();

    if (!actualizada) {
      throw await this.errorDeLike(
        id,
        'Ya le diste me gusta a esta publicación',
      );
    }

    return { id, cantidadLikes: actualizada.cantidadLikes, likeado: true };
  }

  /**
   * DELETE /publicaciones/:id/like: sólo si el usuario antes dio el me gusta
   * (la consigna lo pide explícito). Mismo patrón atómico que darLike.
   */
  async quitarLike(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoLike> {
    const actualizada = await this.publicacionModel
      .findOneAndUpdate(
        { _id: id, eliminado: false, likes: usuario.id },
        { $pull: { likes: usuario.id }, $inc: { cantidadLikes: -1 } },
        { new: true },
      )
      .exec();

    if (!actualizada) {
      throw await this.errorDeLike(
        id,
        'No habías dado me gusta a esta publicación',
      );
    }

    return { id, cantidadLikes: actualizada.cantidadLikes, likeado: false };
  }

  /**
   * GET /publicaciones/:id: detalle de una publicación (Sprint 3).
   * Devuelve 404 si no existe o fue eliminada.
   */
  async obtenerUno(id: string, idUsuarioActual?: string) {
    const publicacion = await this.publicacionModel
      .findOne({ _id: id, eliminado: false })
      .populate('usuario', CAMPOS_AUTOR)
      .exec();

    if (!publicacion) {
      throw new NotFoundException(NO_EXISTE);
    }

    return toPublicacionResponse(publicacion, idUsuarioActual);
  }

  /**
   * DELETE /publicaciones/:id: baja lógica. Sólo el autor o un administrador.
   */
  async eliminar(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<{ id: string; eliminado: true; fechaEliminacion: Date }> {
    const publicacion = await this.publicacionModel
      .findOne({ _id: id, eliminado: false })
      .exec();

    if (!publicacion) {
      throw new NotFoundException(NO_EXISTE);
    }

    const esAutor = String(publicacion.usuario) === usuario.id;
    if (!esAutor && usuario.perfil !== 'administrador') {
      throw new ForbiddenException(
        'Solo el autor de la publicación o un administrador pueden eliminarla',
      );
    }

    // Baja lógica: no se borra el documento, se marca y se guarda la fecha.
    publicacion.eliminado = true;
    publicacion.fechaEliminacion = new Date();
    await publicacion.save();

    return {
      id,
      eliminado: true,
      fechaEliminacion: publicacion.fechaEliminacion,
    };
  }

  /**
   * Con likes iguales desempatamos por fecha: sin el desempate, dos páginas
   * consecutivas podrían repetir o saltear publicaciones.
   */
  private armarOrden(orden: OrdenPublicaciones): Record<string, 1 | -1> {
    return orden === 'likes'
      ? { cantidadLikes: -1, createdAt: -1 }
      : { createdAt: -1 };
  }

  /**
   * findOneAndUpdate devuelve null en dos casos muy distintos: la publicación
   * no existe (404) o existe pero el like ya estaba/no estaba (409). Una
   * consulta extra nos deja responder el error correcto.
   */
  private async errorDeLike(
    id: string,
    mensajeConflicto: string,
  ): Promise<Error> {
    const existe = await this.publicacionModel.exists({
      _id: id,
      eliminado: false,
    });

    return existe
      ? new ConflictException(mensajeConflicto)
      : new NotFoundException(NO_EXISTE);
  }
}
