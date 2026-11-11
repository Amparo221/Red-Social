import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const COMENTARIOS_POR_DEFECTO = 10;
export const COMENTARIOS_MAXIMOS = 50;

/**
 * Query string de GET /publicaciones/:publicacionId/comentarios.
 *
 * La pantalla de detalle pide de a 3 ("cargar más") y el perfil también, así
 * que el front siempre manda `limit`: el valor por defecto sólo cubre a quien
 * llame a la API sin parámetros.
 *
 * Igual que en el feed, `@Type(() => Number)` castea el texto de la URL antes
 * de validar, para que `offset=abc` termine en 400 y no en NaN.
 */
export class ListarComentariosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un número entero' })
  @Min(0, { message: 'offset no puede ser negativo' })
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(COMENTARIOS_MAXIMOS, {
    message: `limit no puede superar ${COMENTARIOS_MAXIMOS}`,
  })
  limit: number = COMENTARIOS_POR_DEFECTO;
}
