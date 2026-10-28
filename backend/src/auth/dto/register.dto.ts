import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// El registro llega como multipart/form-data, así que todos los valores son
// strings: los decoradores validan ese formato y @Transform los normaliza.
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const recortarYMinusculas = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre es obligatorio' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(50)
  nombre: string;

  @Transform(recortar)
  @IsString({ message: 'El apellido es obligatorio' })
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @MaxLength(50)
  apellido: string;

  @Transform(recortarYMinusculas)
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  correo: string;

  // Igual que el correo: se guarda en minúsculas para que el login no dependa
  // de las mayúsculas (así "AnaMoreno" y "anamoreno" son el mismo usuario).
  @Transform(recortarYMinusculas)
  @IsString({ message: 'El nombre de usuario es obligatorio' })
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @MinLength(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
  @MaxLength(30)
  @Matches(/^\S+$/, { message: 'El nombre de usuario no puede contener espacios' })
  nombreUsuario: string;

  // Se recorta igual que el resto: un espacio o un tab invisible (copiar y
  // pegar desde una tabla) haría que el login devuelva 401 sin explicación.
  @Transform(recortar)
  @IsString({ message: 'La contraseña es obligatoria' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe tener al menos una mayúscula y un número',
  })
  password: string;

  @IsDateString({}, { message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD' })
  fechaNacimiento: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200, { message: 'La descripción no puede superar los 200 caracteres' })
  descripcion?: string;
}
