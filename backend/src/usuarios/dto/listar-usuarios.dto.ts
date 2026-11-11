import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PERFILES, Perfil } from '../schemas/usuario.schema';

/** Estados que acepta el filtro del listado. Sin `estado` se devuelven todos. */
export const ESTADOS_USUARIO = ['activos', 'deshabilitados'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export const USUARIOS_POR_PAGINA = 10;
export const USUARIOS_MAXIMO_POR_PAGINA = 50;

/**
 * Query string de GET /usuarios (sólo administradores).
 *
 * Igual que en el feed: los valores de la URL llegan como texto, así que
 * `@Type(() => Number)` los castea antes de validar y `offset=abc` termina en
 * 400 en lugar de NaN.
 */
export class ListarUsuariosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un número entero' })
  @Min(0, { message: 'offset no puede ser negativo' })
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(USUARIOS_MAXIMO_POR_PAGINA, {
    message: `limit no puede superar ${USUARIOS_MAXIMO_POR_PAGINA}`,
  })
  limit: number = USUARIOS_POR_PAGINA;

  /** Busca en nombre, apellido, correo y nombre de usuario (sin distinguir mayúsculas). */
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(50, { message: 'busqueda no puede superar los 50 caracteres' })
  busqueda?: string;

  @IsOptional()
  @IsIn(ESTADOS_USUARIO, {
    message: `estado debe ser ${ESTADOS_USUARIO.join(' o ')}`,
  })
  estado?: EstadoUsuario;

  @IsOptional()
  @IsIn(PERFILES, { message: `perfil debe ser ${PERFILES.join(' o ')}` })
  perfil?: Perfil;
}
