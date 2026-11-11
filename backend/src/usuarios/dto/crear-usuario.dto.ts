import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';
import { PERFILES, Perfil } from '../schemas/usuario.schema';

/**
 * POST /usuarios (dashboard del administrador, Sprint 4).
 *
 * Extiende `RegisterDto` en vez de repetir los campos: el alta desde el panel
 * pide exactamente los mismos datos y validaciones que el registro público
 * (nombre, apellido, correo, usuario, contraseña, fecha de nacimiento y
 * descripción). Lo único que agrega es poder elegir el perfil.
 *
 * Ojo: el registro público (`POST /auth/registro`) NO usa este DTO, así que un
 * usuario común sigue sin poder mandar `perfil` en el body.
 */
export class CrearUsuarioDto extends RegisterDto {
  // Llega por multipart/form-data (el alta acepta imagen), así que normalizamos
  // el texto antes de validar: "Administrador " es válido igual que
  // "administrador".
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(PERFILES, {
    message: `El perfil debe ser ${PERFILES.join(' o ')}`,
  })
  perfil: Perfil = 'usuario';
}
