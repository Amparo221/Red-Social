import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * PATCH /usuarios/:id/estado — habilitar o deshabilitar una cuenta.
 *
 * El front manda JSON (`{ "activo": true }`), pero `@Transform` tolera también
 * los strings "true"/"false" para que el endpoint funcione igual si alguien lo
 * llama con un formulario.
 */
export class CambiarEstadoDto {
  @Transform(({ value }: TransformFnParams) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo: boolean;
}
