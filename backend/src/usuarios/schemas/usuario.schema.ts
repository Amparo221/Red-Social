import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UsuarioDocument = HydratedDocument<Usuario>;

// Perfiles posibles del sistema (el enum lo valida también Mongo).
export const PERFILES = ['usuario', 'administrador'] as const;
export type Perfil = (typeof PERFILES)[number];

// `timestamps: true` agrega createdAt y updatedAt automáticamente: los vamos a
// necesitar en el Sprint 2 para ordenar publicaciones por fecha.
@Schema({ timestamps: true })
export class Usuario {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  apellido: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  correo: string;

  // `lowercase` + `trim`: se guarda siempre normalizado, así "AnaMoreno" queda
  // "anamoreno" y el login no depende de cómo lo escriba el usuario.
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  nombreUsuario: string;

  // `select: false` => el hash NO se devuelve en las consultas por defecto.
  // Solo el login lo pide explícitamente con .select('+password').
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true })
  fechaNacimiento: string; // string ISO 'YYYY-MM-DD'

  @Prop({ default: '', maxlength: 200 })
  descripcion: string;

  @Prop({ default: '' })
  imagenPerfilUrl: string;

  @Prop({ type: String, enum: PERFILES, default: 'usuario' })
  perfil: Perfil;

  // ---- Sprint 4: baja lógica de usuarios -----------------------------------
  // No se borra el documento: se marca `activo: false` y sus publicaciones y
  // comentarios siguen existiendo (la consigna sólo pide que no pueda ingresar).
  //
  // `default: true` + `index` porque el listado del dashboard filtra por este
  // campo. Ojo: los usuarios que ya estaban en Atlas no tienen el campo, así que
  // las consultas usan `{ activo: { $ne: false } }` en vez de `{ activo: true }`
  // (un `true` estricto no matchea los documentos viejos).
  @Prop({ default: true, index: true })
  activo: boolean;

  // Cuándo se dio de baja. Se limpia al rehabilitar la cuenta.
  @Prop()
  fechaBaja?: Date;

  // Los completa Mongoose por `timestamps: true` (no llevan @Prop para no
  // duplicar la definición del esquema).
  createdAt?: Date;
  updatedAt?: Date;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
