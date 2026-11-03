import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

/** Órdenes que acepta el feed (los dos que pide la consigna). */
export const ORDENES = ['fecha', 'likes'] as const;
export type OrdenPublicaciones = (typeof ORDENES)[number];

export const LIMITE_POR_DEFECTO = 5;
export const LIMITE_MAXIMO = 50;

/**
 * Query string de GET /publicaciones.
 *
 * Los valores de la URL llegan SIEMPRE como texto ("0", "5"), por eso
 * `@Type(() => Number)` los castea antes de validar: con el ValidationPipe
 * global en `transform: true`, `offset=abc` termina en 400 y no en NaN.
 */
export class ListarPublicacionesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un número entero' })
  @Min(0, { message: 'offset no puede ser negativo' })
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  // Ponemos techo para que nadie pida 1.000.000 de documentos de una vez.
  @Max(LIMITE_MAXIMO, { message: `limit no puede superar ${LIMITE_MAXIMO}` })
  limit: number = LIMITE_POR_DEFECTO;

  @IsOptional()
  @IsIn(ORDENES, { message: `orden debe ser ${ORDENES.join(' o ')}` })
  orden: OrdenPublicaciones = 'fecha';

  /** Filtra el feed de un usuario puntual (id de Mongo del autor). */
  @IsOptional()
  @IsMongoId({ message: 'usuario debe ser un id válido' })
  usuario?: string;
}
