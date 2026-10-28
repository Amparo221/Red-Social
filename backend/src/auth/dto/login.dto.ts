import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

// Misma normalización que en el registro: sin espacios sobrantes (un tab
// invisible de copiar y pegar rompería el hash) y en minúsculas, porque el
// correo y el nombre de usuario se guardan así.
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const recortarYMinusculas = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  // Puede ser el correo o el nombre de usuario: el servicio busca en los dos.
  @Transform(recortarYMinusculas)
  @IsString({ message: 'El usuario o correo es obligatorio' })
  @IsNotEmpty({ message: 'El usuario o correo es obligatorio' })
  identificador: string;

  // Mismo recorte que en el registro: si la contraseña se guardó sin espacios
  // (porque el registro ya los recortó), el login tiene que comparar igual.
  @Transform(recortar)
  @IsString({ message: 'La contraseña es obligatoria' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}

