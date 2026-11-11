import { Perfil, UsuarioDocument } from '../schemas/usuario.schema';

// Forma pública de un usuario: nunca incluye el hash ni campos internos de
// Mongo (_id, __v). El front trabaja con `id`.
export interface UsuarioResponse {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  nombreUsuario: string;
  fechaNacimiento: string;
  descripcion: string;
  imagenPerfilUrl: string;
  perfil: Perfil;
  /** Baja lógica (Sprint 4). `false` = deshabilitado. */
  activo: boolean;
  /** Fecha de la baja lógica; `null` mientras la cuenta está habilitada. */
  fechaBaja: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toUsuarioResponse(usuario: UsuarioDocument): UsuarioResponse {
  return {
    id: String(usuario._id),
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    nombreUsuario: usuario.nombreUsuario,
    fechaNacimiento: usuario.fechaNacimiento,
    descripcion: usuario.descripcion,
    imagenPerfilUrl: usuario.imagenPerfilUrl,
    perfil: usuario.perfil,
    // `!== false` a propósito: un usuario creado antes del Sprint #4 no tiene
    // el campo en la base y tiene que seguir contando como habilitado.
    activo: usuario.activo !== false,
    fechaBaja: usuario.fechaBaja ?? null,
    createdAt: usuario.createdAt,
    updatedAt: usuario.updatedAt,
  };
}
