import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB
const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  @UseInterceptors(
    FileInterceptor('imagen', {
      // Multer corta el archivo antes de subirlo si supera el tamaño máximo
      // (Nest lo traduce a 413 Payload Too Large).
      limits: { fileSize: TAMANIO_MAXIMO_IMAGEN },
      fileFilter: (_req, file, callback) => {
        if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype)) {
          return callback(
            new BadRequestException('La imagen debe ser JPG, PNG, WEBP o GIF'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
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
}
