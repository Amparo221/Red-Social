import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Un ObjectId de Mongo siempre son 24 caracteres hexadecimales. */
const FORMATO_OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Valida los `:id` de las rutas antes de que lleguen al servicio.
 *
 * Sin este pipe, un id como `/publicaciones/123` hace que Mongoose lance un
 * CastError y el cliente reciba 500 cuando el problema real es que el id está
 * mal escrito (400). No usamos `Types.ObjectId.isValid` porque acepta
 * cualquier texto de 12 caracteres como válido; la expresión regular es más
 * estricta con lo que realmente esperamos.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(valor: string): string {
    if (!FORMATO_OBJECT_ID.test(valor)) {
      throw new BadRequestException('El id no tiene un formato válido');
    }

    return valor;
  }
}
