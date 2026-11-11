import {
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
  CAMPOS_AUTOR_COMENTARIO,
  ComentarioResponse,
  ListadoComentariosResponse,
  toComentarioResponse,
} from './utils/comentario-response.util';
import { Comentario, ComentarioDocument } from './schemas/comentario.schema';
import { ListarComentariosDto } from './dto/listar-comentarios.dto';
import { Publicacion, PublicacionDocument } from '../publicaciones/schemas/publicacion.schema';

const NO_EXISTE = 'El comentario no existe o fue eliminado';
const NO_EXISTE_PUBLICACION = 'La publicación no existe';

@Injectable()
export class ComentarioService {
  private readonly logger = new Logger(ComentarioService.name);

  constructor(
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<ComentarioDocument>,
    @InjectModel(Publicacion.name)
    private readonly publicacionModel: Model<PublicacionDocument>,
  ) {}

  /** GET /publicaciones/:publicacionId/comentarios?offset=0&limit=10 */
  async listarComentarios(
    publicacionId: string,
    dto: ListarComentariosDto = new ListarComentariosDto(),
  ): Promise<ListadoComentariosResponse> {
    // Verificamos que la publicación exista y no esté eliminada.
    const publicacion = await this.publicacionModel
      .findOne({ _id: publicacionId, eliminado: false })
      .exec();

    if (!publicacion) {
      throw new NotFoundException(NO_EXISTE_PUBLICACION);
    }

    const filtro = {
      publicacion: new Types.ObjectId(publicacionId),
      eliminado: false,
    };

    // En paralelo: el total para armar `hayMas` y la página que se devuelve.
    const [total, comentarios] = await Promise.all([
      this.comentarioModel.countDocuments(filtro).exec(),
      this.comentarioModel
        .find(filtro)
        .populate('autor', CAMPOS_AUTOR_COMENTARIO)
        // Orden cronológico (el hilo se lee de arriba a abajo). `_id` funciona
        // como desempate: dos comentarios con el mismo `createdAt` no se
        // repiten ni se saltean al pasar de una página a la siguiente.
        .sort({ createdAt: 1, _id: 1 })
        .skip(dto.offset)
        .limit(dto.limit)
        .exec(),
    ]);

    return {
      total,
      offset: dto.offset,
      limit: dto.limit,
      hayMas: dto.offset + comentarios.length < total,
      comentarios: comentarios.map((c) => toComentarioResponse(c)),
    };
  }

  /** POST /publicaciones/:publicacionId/comentarios */
  async crearComentario(
    publicacionId: string,
    texto: string,
    autor: UsuarioAutenticado,
  ): Promise<ComentarioResponse> {
    // Verificamos que la publicación exista.
    const publicacion = await this.publicacionModel
      .findOne({ _id: publicacionId, eliminado: false })
      .exec();

    if (!publicacion) {
      throw new NotFoundException(NO_EXISTE_PUBLICACION);
    }

    try {
      const comentario = await this.comentarioModel.create({
        texto,
        autor: new Types.ObjectId(autor.id),
        publicacion: new Types.ObjectId(publicacionId),
        eliminado: false,
      });

      await comentario.populate('autor', CAMPOS_AUTOR_COMENTARIO);

      return toComentarioResponse(comentario);
    } catch (error) {
      this.logger.error(
        'No se pudo crear el comentario',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('No se pudo crear el comentario');
    }
  }

  /** DELETE /comentarios/:comentarioId */
  async eliminarComentario(
    comentarioId: string,
    usuario: UsuarioAutenticado,
  ): Promise<{ id: string; eliminado: true }> {
    const comentario = await this.comentarioModel
      .findOne({ _id: comentarioId, eliminado: false })
      .exec();

    if (!comentario) {
      throw new NotFoundException(NO_EXISTE);
    }

    const esAutor = String(comentario.autor) === usuario.id;
    if (!esAutor && usuario.perfil !== 'administrador') {
      throw new ForbiddenException(
        'Solo el autor del comentario o un administrador pueden eliminarlo',
      );
    }

    // Baja lógica.
    comentario.eliminado = true;
    comentario.fechaEliminacion = new Date();
    await comentario.save();

    return { id: comentarioId, eliminado: true };
  }

  /** PATCH /comentarios/:comentarioId → sólo el autor puede cambiar el texto. */
  async editarComentario(
    comentarioId: string,
    texto: string,
    usuario: UsuarioAutenticado,
  ): Promise<ComentarioResponse> {
    const comentario = await this.comentarioModel
      .findOne({ _id: comentarioId, eliminado: false })
      .exec();

    if (!comentario) {
      throw new NotFoundException(NO_EXISTE);
    }

    // Editar es más restrictivo que borrar: el administrador puede moderar
    // (baja lógica), pero no reescribir lo que dijo otra persona.
    if (String(comentario.autor) !== usuario.id) {
      throw new ForbiddenException('Solo el autor puede editar su comentario');
    }

    try {
      comentario.texto = texto;
      comentario.editado = true;
      comentario.fechaEdicion = new Date();
      await comentario.save();

      // El documento salió sin populado: sin este paso la respuesta devolvería
      // el id suelto y la lista mostraría "Usuario eliminado" justo después de
      // guardar.
      await comentario.populate('autor', CAMPOS_AUTOR_COMENTARIO);

      return toComentarioResponse(comentario);
    } catch (error) {
      this.logger.error(
        'No se pudo editar el comentario',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('No se pudo editar el comentario');
    }
  }
}
