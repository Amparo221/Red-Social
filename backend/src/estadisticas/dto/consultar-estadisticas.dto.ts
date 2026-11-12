import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AGRUPACIONES, Agrupacion } from '../utils/periodos.util';

/** Días que se muestran si el cliente no manda `desde`. */
export const DIAS_POR_DEFECTO = 30;

/**
 * Techo del rango. Con más días el gráfico de líneas deja de ser legible y la
 * consulta recorre demasiados documentos para un dashboard.
 */
export const DIAS_MAXIMOS = 366;

/** Filas que devuelven los dos rankings (torta y barras). */
export const LIMITE_POR_DEFECTO = 10;
export const LIMITE_MINIMO = 3;
export const LIMITE_MAXIMO = 20;

/**
 * Query string de `GET /estadisticas` (sólo administradores).
 *
 * `desde` y `hasta` son días `AAAA-MM-DD` (o un ISO completo). El rango se
 * interpreta en hora argentina y los dos extremos entran: `desde=2026-11-01`
 * incluye todo el 1/11. La validación de que `hasta` no sea anterior a `desde`
 * y de que el rango no supere `DIAS_MAXIMOS` vive en el servicio, porque
 * depende de los dos valores juntos y necesita la fecha de hoy para los
 * valores por defecto.
 */
export class ConsultarEstadisticasDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'desde debe ser una fecha (AAAA-MM-DD o ISO 8601)' },
  )
  desde?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'hasta debe ser una fecha (AAAA-MM-DD o ISO 8601)' },
  )
  hasta?: string;

  @IsOptional()
  @IsIn(AGRUPACIONES, {
    message: `agrupacion debe ser ${AGRUPACIONES.join(', ')}`,
  })
  agrupacion: Agrupacion = 'dia';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limite debe ser un número entero' })
  @Min(LIMITE_MINIMO, { message: `limite debe ser al menos ${LIMITE_MINIMO}` })
  @Max(LIMITE_MAXIMO, {
    message: `limite no puede superar ${LIMITE_MAXIMO}`,
  })
  limite: number = LIMITE_POR_DEFECTO;
}
