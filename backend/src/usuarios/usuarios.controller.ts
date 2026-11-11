import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { OPCIONES_IMAGEN } from '../common/multer/imagen.multer';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Módulo de usuarios (Sprint 4).
 *
 * Los dos guards van a nivel de controller: primero el de sesión resuelve QUIÉN
 * es el usuario (y confirma que la cuenta siga habilitada) y después `RolesGuard`
 * rechaza con 403 a cualquier perfil que no sea administrador. Con un solo
 * `@UseGuards(JwtAuthGuard)` estas rutas estarían abiertas a cualquier usuario
 * logueado, que es justo lo que la consigna pide evitar.
 */
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /** GET /usuarios?offset=0&limit=10&busqueda=ana&estado=activos&perfil=usuario */
  @Get()
  async listar(@Query() listarDto: ListarUsuariosDto) {
    return this.usuariosService.listar(listarDto);
  }

  /**
   * POST /usuarios → 201 con el usuario creado.
   *
   * Mismo formulario que el registro (multipart por la imagen opcional) más el
   * campo `perfil`, que decide si el nuevo usuario es común o administrador.
   */
  @Post()
  @UseInterceptors(FileInterceptor('imagen', OPCIONES_IMAGEN))
  async crear(
    @Body() crearDto: CrearUsuarioDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.usuariosService.crear(crearDto, archivo);
  }

  /**
   * DELETE /usuarios/:id → baja lógica (la consigna pide "deshabilitar", no
   * borrar el documento). El usuario deja de poder ingresar en el acto.
   */
  @Delete(':id')
  async deshabilitar(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioActual() administrador: UsuarioAutenticado,
  ) {
    return this.usuariosService.cambiarEstado(id, false, administrador);
  }

  /**
   * PATCH /usuarios/:id/estado → habilita o deshabilita según `{ activo }`.
   *
   * Es el endpoint que usa el botón "Habilitar" del dashboard; acepta los dos
   * sentidos para que la operación sea idempotente.
   */
  @Patch(':id/estado')
  async cambiarEstado(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() cambiarEstadoDto: CambiarEstadoDto,
    @UsuarioActual() administrador: UsuarioAutenticado,
  ) {
    return this.usuariosService.cambiarEstado(
      id,
      cambiarEstadoDto.activo,
      administrador,
    );
  }
}
