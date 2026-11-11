import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { OPCIONES_IMAGEN } from '../common/multer/imagen.multer';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreatePublicacionDto } from './dto/create-publicacion.dto';
import { ListarPublicacionesDto } from './dto/listar-publicaciones.dto';
import { PublicacionesService } from './publicaciones.service';

// El guard va a nivel de controller: TODO el módulo requiere sesión iniciada
// (la consigna: "sólo se puede acceder estando registrado o logueado").
@Controller('publicaciones')
@UseGuards(JwtAuthGuard)
export class PublicacionesController {
  constructor(private readonly publicacionesService: PublicacionesService) {}

  /** POST /publicaciones → 201 con la publicación creada (Nest ya usa 201 en POST). */
  @Post()
  @UseInterceptors(FileInterceptor('imagen', OPCIONES_IMAGEN))
  async crear(
    @Body() createDto: CreatePublicacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.publicacionesService.crear(createDto, usuario, archivo);
  }

  /** GET /publicaciones/:id → 200 con la publicación y su autor populado. */
  @Get(':id')
  async obtenerUno(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.publicacionesService.obtenerUno(id, usuario.id);
  }

  /** GET /publicaciones?offset=0&limit=5&orden=fecha|likes&usuario=<id> → 200 */
  @Get()
  async listar(
    @Query() listarDto: ListarPublicacionesDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.publicacionesService.listar(listarDto, usuario);
  }

  /** POST /publicaciones/:id/like → 201 (crea la relación usuario-publicación). */
  @Post(':id/like')
  async darLike(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.publicacionesService.darLike(id, usuario);
  }

  /** DELETE /publicaciones/:id/like → 200 con el contador actualizado. */
  @Delete(':id/like')
  async quitarLike(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.publicacionesService.quitarLike(id, usuario);
  }

  /** DELETE /publicaciones/:id → 200 (baja lógica, autor o administrador). */
  @Delete(':id')
  async eliminar(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.publicacionesService.eliminar(id, usuario);
  }
}
