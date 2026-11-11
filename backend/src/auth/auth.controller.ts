import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsuarioAutenticado } from './interfaces/jwt-payload.interface';
import { OPCIONES_IMAGEN } from '../common/multer/imagen.multer';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  @UseInterceptors(FileInterceptor('imagen', OPCIONES_IMAGEN))
  async registro(
    @Body() registerDto: RegisterDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registrar(registerDto, file);
  }

  @Post('login')
  // Un login no crea recursos: corresponde 200 y no el 201 que Nest usa por
  // defecto en los POST.
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.identificador, loginDto.password);
  }

  /**
   * GET /auth/autorizar → valida el token del header y devuelve el usuario.
   *
   * La usa la pantalla de carga del front al iniciar la aplicación: con 200
   * entra al feed, con 401 borra la sesión guardada y vuelve al login.
   */
  @Get('autorizar')
  @UseGuards(JwtAuthGuard)
  async autorizar(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.authService.autorizar(usuario.id);
  }

  /**
   * POST /auth/refrescar → renueva el token sin pedir la contraseña otra vez.
   *
   * La llama el botón "Extender sesión" del aviso de 10 minutos: el guard
   * valida el token vigente y el servicio firma uno nuevo con la misma
   * duración, así el usuario sigue trabajando sin volver a loguearse.
   */
  @Post('refrescar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async refrescar(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.authService.refrescar(usuario.id);
  }

  /**
   * GET /auth/sesion → tiempos de la sesión, en segundos.
   *
   * Es público a propósito: el splash lo pide antes de saber si el token
   * sigue vigente y no expone nada sensible (sólo la duración y el aviso).
   * El front calcula con esto cuándo mostrar el modal y cuándo vence.
   */
  @Get('sesion')
  politicaSesion() {
    return this.authService.politicaSesion();
  }
}
