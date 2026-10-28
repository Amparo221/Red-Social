import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import toStream = require('buffer-to-stream');

const CARPETA_PERFILES = 'red-social/perfiles';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    // Las credenciales salen del .env a través de ConfigService, no de
    // process.env, así la configuración es testeable e inyectable.
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUD_NAME'),
      api_key: this.configService.get<string>('API_KEY'),
      api_secret: this.configService.get<string>('API_SECRET'),
    });
  }

  /**
   * Sube una imagen en memoria (Multer) a Cloudinary y devuelve su URL https.
   */
  async uploadImage(file: Express.Multer.File, publicId?: string): Promise<string> {
    try {
      return await this.subirBuffer(file.buffer, publicId);
    } catch (error) {
      this.logger.error(
        'Falló la subida a Cloudinary',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('No se pudo subir la imagen');
    }
  }

  /**
   * Cloudinary espera un stream, no un Buffer: `buffer-to-stream` convierte el
   * archivo que Multer dejó en memoria y lo "pipes" al upload_stream.
   */
  private subirBuffer(buffer: Buffer, publicId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: CARPETA_PERFILES,
          ...(publicId ? { public_id: publicId, overwrite: true, invalidate: true } : {}),
        },
        (error, result) => {
          if (error || !result) {
            return reject(error ?? new Error('Cloudinary no devolvió resultado'));
          }
          resolve(result.secure_url);
        },
      );

      toStream(buffer).pipe(upload);
    });
  }
}
