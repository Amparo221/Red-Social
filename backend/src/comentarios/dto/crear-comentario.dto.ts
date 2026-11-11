import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { LARGO_MAXIMO_TEXTO_COMENTARIO } from '../schemas/comentario.schema';

/** Quita los espacios de los extremos antes de validar. */
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Cuerpo del POST /publicaciones/:publicacionId/comentarios. */
export class CrearComentarioDto {
  @Transform(recortar)
  @IsString({ message: 'El comentario debe ser un texto' })
  @IsNotEmpty({ message: 'El comentario es obligatorio' })
  @MaxLength(LARGO_MAXIMO_TEXTO_COMENTARIO, {
    message: `El comentario no puede superar los ${LARGO_MAXIMO_TEXTO_COMENTARIO} caracteres`,
  })
  texto: string;
}
