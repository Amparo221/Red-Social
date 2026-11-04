import { BadRequestException } from '@nestjs/common';

export const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB
export const TIPOS_IMAGEN_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Opciones de Multer para las rutas que reciben una imagen opcional
 * (`FileInterceptor('imagen', OPCIONES_IMAGEN)`).
 *
 * Están acá y no en cada controller para que el registro (imagen de perfil) y
 * las publicaciones acepten exactamente los mismos formatos y el mismo tamaño
 * máximo: si mañana hay que subir el límite, se cambia en un solo lugar.
 *
 * - `limits.fileSize`: Multer corta el archivo antes de subirlo; Nest traduce
 *   ese error a 413 Payload Too Large.
 * - `fileFilter`: valida el MIME que informa el cliente y responde 400.
 */
export const OPCIONES_IMAGEN = {
  limits: { fileSize: TAMANIO_MAXIMO_IMAGEN },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, aceptar: boolean) => void,
  ): void => {
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype)) {
      return callback(
        new BadRequestException('La imagen debe ser JPG, PNG, WEBP o GIF'),
        false,
      );
    }

    callback(null, true);
  },
};
