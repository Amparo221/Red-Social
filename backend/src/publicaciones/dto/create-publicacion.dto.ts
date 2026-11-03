import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  LARGO_MAXIMO_DESCRIPCION,
  LARGO_MAXIMO_NOMBRE_AVE,
  LARGO_MAXIMO_TITULO,
} from '../schemas/publicacion.schema';

/** Quita los espacios de los extremos antes de validar ("  Hola  " → "Hola"). */
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Datos del POST /publicaciones (multipart/form-data).
 *
 * La imagen NO se declara acá: viaja como archivo en el campo `imagen` y llega
 * por `@UploadedFile()`. Es opcional: se puede publicar sólo texto.
 */
export class CreatePublicacionDto {
  @Transform(recortar)
  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(LARGO_MAXIMO_TITULO, {
    message: `El título no puede superar los ${LARGO_MAXIMO_TITULO} caracteres`,
  })
  titulo: string;

  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(LARGO_MAXIMO_DESCRIPCION, {
    message: `La descripción no puede superar los ${LARGO_MAXIMO_DESCRIPCION} caracteres`,
  })
  descripcion: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre común debe ser un texto' })
  @MaxLength(LARGO_MAXIMO_NOMBRE_AVE, {
    message: `El nombre común no puede superar los ${LARGO_MAXIMO_NOMBRE_AVE} caracteres`,
  })
  nombreComun?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre científico debe ser un texto' })
  @MaxLength(LARGO_MAXIMO_NOMBRE_AVE, {
    message: `El nombre científico no puede superar los ${LARGO_MAXIMO_NOMBRE_AVE} caracteres`,
  })
  nombreCientifico?: string;
}
