import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CrearComentarioDto } from './dto/crear-comentario.dto';
import { EditarComentarioDto } from './dto/editar-comentario.dto';
import { ListarComentariosDto } from './dto/listar-comentarios.dto';
import { ComentarioService } from './comentario.service';

// Todo el módulo de comentarios requiere sesión iniciada.
@Controller('publicaciones')
@UseGuards(JwtAuthGuard)
export class ComentarioController {
  constructor(private readonly comentarioService: ComentarioService) {}

  /** GET /publicaciones/:publicacionId/comentarios?offset=0&limit=3 */
  @Get(':publicacionId/comentarios')
  async listar(
    @Param('publicacionId', ParseObjectIdPipe) publicacionId: string,
    @Query() listarDto: ListarComentariosDto,
  ) {
    return this.comentarioService.listarComentarios(publicacionId, listarDto);
  }

  /** POST /publicaciones/:publicacionId/comentarios */
  @Post(':publicacionId/comentarios')
  async crear(
    @Param('publicacionId', ParseObjectIdPipe) publicacionId: string,
    @Body() crearDto: CrearComentarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.comentarioService.crearComentario(
      publicacionId,
      crearDto.texto,
      usuario,
    );
  }
}

/**
 * Rutas que cuelgan de /comentarios (no de /publicaciones).
 * Se separa del controller anterior porque Nest usa una sola ruta base por
 * clase; así `DELETE /comentarios/:id` queda simétrico con el POST.
 */
@Controller('comentarios')
@UseGuards(JwtAuthGuard)
export class ComentariosController {
  constructor(private readonly comentarioService: ComentarioService) {}

  /** DELETE /comentarios/:comentarioId → baja lógica (autor o administrador). */
  @Delete(':comentarioId')
  async eliminar(
    @Param('comentarioId', ParseObjectIdPipe) comentarioId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.comentarioService.eliminarComentario(comentarioId, usuario);
  }

  /** PATCH /comentarios/:comentarioId → edita el texto (sólo el autor). */
  @Patch(':comentarioId')
  async editar(
    @Param('comentarioId', ParseObjectIdPipe) comentarioId: string,
    @Body() editarDto: EditarComentarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.comentarioService.editarComentario(
      comentarioId,
      editarDto.texto,
      usuario,
    );
  }
}
