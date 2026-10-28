import { UsuarioDocument } from '../schemas/usuario.schema';

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
  perfil: string;
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
    createdAt: usuario.createdAt,
    updatedAt: usuario.updatedAt,
  };
}
