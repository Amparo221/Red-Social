import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import type { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import { Usuario } from './schemas/usuario.schema';
import { UsuariosService } from './usuarios.service';

const ADMIN_ID = '507f1f77bcf86cd799439011';
const USUARIO_ID = '507f1f77bcf86cd799439012';
const AVATAR_POR_DEFECTO =
  'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/default.png';
const IMAGEN_SUBIDA =
  'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/nueva.png';

const administrador: UsuarioAutenticado = {
  id: ADMIN_ID,
  nombreUsuario: 'admin',
  perfil: 'administrador',
};

/** Documento tal como lo devuelve Mongo (con _id, sin password por defecto). */
const documento = (datos: Record<string, unknown> = {}) => ({
  _id: USUARIO_ID,
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1998-05-20',
  descripcion: 'Hola!',
  imagenPerfilUrl: AVATAR_POR_DEFECTO,
  perfil: 'usuario',
  activo: true,
  fechaBaja: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...datos,
});

const altaValida: CrearUsuarioDto = {
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  password: 'Segura123',
  fechaNacimiento: '1998-05-20',
  descripcion: 'Hola!',
  perfil: 'usuario',
};

const listadoBase: ListarUsuariosDto = { offset: 0, limit: 10 };

/**
 * Cadena `find().sort().skip().limit().exec()` simulada. Devuelve cada paso
 * para poder comprobar con qué valores se llamó.
 */
const crearConsulta = (documentos: unknown[]) => {
  const exec = jest.fn().mockResolvedValue(documentos);
  const limit = jest.fn().mockReturnValue({ exec });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  const find = jest.fn().mockReturnValue({ sort });

  return { find, sort, skip, limit, exec };
};

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuarioModel: {
    countDocuments: jest.Mock;
    find: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
  };
  let cloudinaryService: { uploadImage: jest.Mock };
  let consulta: ReturnType<typeof crearConsulta>;
  /** Simula el .env del backend. */
  let variablesDeEntorno: Record<string, string | undefined>;

  beforeEach(async () => {
    variablesDeEntorno = { DEFAULT_AVATAR_URL: AVATAR_POR_DEFECTO };
    consulta = crearConsulta([documento()]);
    usuarioModel = {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: consulta.find,
      findByIdAndUpdate: jest.fn(),
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn((datos: Record<string, unknown>) =>
        Promise.resolve(documento(datos)),
      ),
    };
    cloudinaryService = {
      uploadImage: jest.fn().mockResolvedValue(IMAGEN_SUBIDA),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: CloudinaryService, useValue: cloudinaryService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((clave: string) => variablesDeEntorno[clave]),
          },
        },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('listar', () => {
    it('sin filtro de estado devuelve activos y deshabilitados', async () => {
      await service.listar(listadoBase);

      expect(usuarioModel.countDocuments).toHaveBeenCalledWith({});
      expect(consulta.find).toHaveBeenCalledWith({});
    });

    it('pide sólo los habilitados con $ne:false (incluye a los usuarios viejos)', async () => {
      await service.listar({ ...listadoBase, estado: 'activos' });

      // `{ activo: true }` dejaría afuera los documentos sin el campo.
      expect(consulta.find).toHaveBeenCalledWith({ activo: { $ne: false } });
    });

    it('filtra los deshabilitados', async () => {
      await service.listar({ ...listadoBase, estado: 'deshabilitados' });

      expect(consulta.find).toHaveBeenCalledWith({ activo: false });
    });

    it('combina estado y perfil en el mismo filtro', async () => {
      await service.listar({
        ...listadoBase,
        estado: 'activos',
        perfil: 'administrador',
      });

      expect(consulta.find).toHaveBeenCalledWith({
        activo: { $ne: false },
        perfil: 'administrador',
      });
    });

    it('busca por nombre, apellido, correo y usuario sin distinguir mayúsculas', async () => {
      await service.listar({ ...listadoBase, busqueda: '  Ana  ' });

      const filtro = consulta.find.mock.calls[0][0] as {
        $or: Record<string, RegExp>[];
      };
      expect(filtro.$or).toHaveLength(4);
      expect(filtro.$or.map((campo) => Object.keys(campo)[0])).toEqual([
        'nombre',
        'apellido',
        'correo',
        'nombreUsuario',
      ]);
      expect(filtro.$or[0].nombre.flags).toContain('i');
      // El texto se recorta antes de armar la expresión.
      expect(filtro.$or[0].nombre.source).toBe('Ana');
    });

    it('escapa los caracteres especiales para que la búsqueda sea literal', async () => {
      await service.listar({ ...listadoBase, busqueda: 'ana.*' });

      const filtro = consulta.find.mock.calls[0][0] as {
        $or: Record<string, RegExp>[];
      };
      expect(filtro.$or[0].nombre.source).toBe('ana\\.\\*');
    });

    it('pagina con offset/limit y avisa si quedan más', async () => {
      const pagina = crearConsulta([documento(), documento()]);
      usuarioModel.find.mockReturnValue({ sort: pagina.sort });
      usuarioModel.countDocuments.mockResolvedValue(12);

      const resultado = await service.listar({ offset: 4, limit: 2 });

      expect(pagina.skip).toHaveBeenCalledWith(4);
      expect(pagina.limit).toHaveBeenCalledWith(2);
      expect(pagina.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(resultado).toMatchObject({
        total: 12,
        offset: 4,
        limit: 2,
        hayMas: true,
      });
    });

    it('marca hayMas en false en la última página', async () => {
      const pagina = crearConsulta([documento()]);
      usuarioModel.find.mockReturnValue({ sort: pagina.sort });
      usuarioModel.countDocuments.mockResolvedValue(1);

      const resultado = await service.listar(listadoBase);

      expect(resultado.hayMas).toBe(false);
    });

    it('devuelve la forma pública: sin password y con activo/fechaBaja', async () => {
      const resultado = await service.listar(listadoBase);
      const [usuario] = resultado.usuarios;

      expect(usuario).toMatchObject({
        id: USUARIO_ID,
        nombreUsuario: 'anamoreno',
        perfil: 'usuario',
        activo: true,
        fechaBaja: null,
      });
      expect(usuario).not.toHaveProperty('password');
      expect(usuario).not.toHaveProperty('_id');
    });

    it('trata como habilitado a un usuario sin el campo activo (datos viejos)', async () => {
      const pagina = crearConsulta([documento({ activo: undefined })]);
      usuarioModel.find.mockReturnValue({ sort: pagina.sort });

      const resultado = await service.listar(listadoBase);

      expect(resultado.usuarios[0].activo).toBe(true);
    });

    it('responde 500 si la base de datos falla', async () => {
      usuarioModel.countDocuments.mockRejectedValue(
        new Error('connection timed out'),
      );

      await expect(service.listar(listadoBase)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('crear', () => {
    it('guarda el hash de la contraseña, el perfil elegido y la imagen por defecto', async () => {
      const resultado = await service.crear(altaValida);

      const datosGuardados = usuarioModel.create.mock.calls[0][0];
      expect(datosGuardados.password).not.toBe(altaValida.password);
      expect(
        await bcrypt.compare(altaValida.password, datosGuardados.password),
      ).toBe(true);
      expect(datosGuardados.imagenPerfilUrl).toBe(AVATAR_POR_DEFECTO);
      expect(datosGuardados.perfil).toBe('usuario');
      expect(datosGuardados.activo).toBe(true);
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
      expect(resultado).not.toHaveProperty('password');
    });

    it('permite crear un administrador desde el dashboard', async () => {
      await service.crear({ ...altaValida, perfil: 'administrador' });

      expect(usuarioModel.create.mock.calls[0][0].perfil).toBe('administrador');
    });

    it('no deja que el DTO pise activo ni fechaBaja', async () => {
      // Campos de más: se ignoran porque el servicio copia campo por campo.
      const conExtras = {
        ...altaValida,
        activo: false,
        fechaBaja: new Date('2020-01-01'),
      };

      await service.crear(conExtras);

      const datosGuardados = usuarioModel.create.mock.calls[0][0];
      expect(datosGuardados.activo).toBe(true);
      expect(datosGuardados.fechaBaja).toBeUndefined();
    });

    it('sube la imagen a Cloudinary cuando se adjunta un archivo', async () => {
      const archivo = { buffer: Buffer.from('imagen') } as Express.Multer.File;

      const resultado = await service.crear(altaValida, archivo);

      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(archivo);
      expect(usuarioModel.create.mock.calls[0][0].imagenPerfilUrl).toBe(
        IMAGEN_SUBIDA,
      );
      expect(resultado.imagenPerfilUrl).toBe(IMAGEN_SUBIDA);
    });

    it('rechaza con 409 si el correo ya está registrado', async () => {
      usuarioModel.exists.mockResolvedValueOnce({ _id: 'otro' });

      await expect(service.crear(altaValida)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usuarioModel.create).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el nombre de usuario ya está en uso', async () => {
      usuarioModel.exists
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: 'otro' });

      await expect(service.crear(altaValida)).rejects.toThrow(
        'El nombre de usuario ya está en uso',
      );
    });

    it('traduce el error 11000 (índice unique) en un 409', async () => {
      usuarioModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.crear(altaValida)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('responde 500 con el detalle si la base de datos falla', async () => {
      usuarioModel.create.mockRejectedValue(new Error('connection timed out'));

      const error: unknown = await service
        .crear(altaValida)
        .catch((fallo: unknown) => fallo);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(
        (error as InternalServerErrorException).getResponse(),
      ).toMatchObject({
        statusCode: 500,
        message: 'No se pudo crear el usuario',
        detalle: 'connection timed out',
      });
    });

    it('responde 500 con el detalle si Cloudinary rechaza la imagen', async () => {
      cloudinaryService.uploadImage.mockRejectedValue(
        new Error('Must supply api_key'),
      );

      const error: unknown = await service
        .crear(altaValida, {
          buffer: Buffer.from('imagen'),
        } as Express.Multer.File)
        .catch((fallo: unknown) => fallo);

      expect(
        (error as InternalServerErrorException).getResponse(),
      ).toMatchObject({ detalle: 'Must supply api_key' });
      // Si la imagen no se pudo subir no se guarda nada en la base.
      expect(usuarioModel.create).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    const darActualizado = (usuario: unknown) => ({
      exec: jest.fn().mockResolvedValue(usuario),
    });

    it('deshabilita la cuenta y guarda la fecha de baja', async () => {
      const fechaBaja = new Date('2026-02-01T00:00:00.000Z');
      usuarioModel.findByIdAndUpdate.mockReturnValue(
        darActualizado(documento({ activo: false, fechaBaja })),
      );

      const resultado = await service.cambiarEstado(
        USUARIO_ID,
        false,
        administrador,
      );

      expect(usuarioModel.findByIdAndUpdate).toHaveBeenCalledWith(
        USUARIO_ID,
        { activo: false, fechaBaja: expect.any(Date) },
        { new: true },
      );
      expect(resultado).toEqual({
        id: USUARIO_ID,
        activo: false,
        fechaBaja,
      });
    });

    it('al rehabilitar limpia la fecha de baja con $unset', async () => {
      usuarioModel.findByIdAndUpdate.mockReturnValue(
        darActualizado(documento({ activo: true })),
      );

      const resultado = await service.cambiarEstado(
        USUARIO_ID,
        true,
        administrador,
      );

      // Asignar `undefined` no borra el campo en Mongo: hay que usar $unset.
      expect(usuarioModel.findByIdAndUpdate).toHaveBeenCalledWith(
        USUARIO_ID,
        { activo: true, $unset: { fechaBaja: 1 } },
        { new: true },
      );
      expect(resultado).toEqual({
        id: USUARIO_ID,
        activo: true,
        fechaBaja: null,
      });
    });

    it('no permite que un administrador se deshabilite a sí mismo', async () => {
      await expect(
        service.cambiarEstado(ADMIN_ID, false, administrador),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(usuarioModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('un administrador sí puede habilitarse a sí mismo', async () => {
      usuarioModel.findByIdAndUpdate.mockReturnValue(
        darActualizado(documento({ _id: ADMIN_ID, activo: true })),
      );

      await expect(
        service.cambiarEstado(ADMIN_ID, true, administrador),
      ).resolves.toMatchObject({ activo: true });
    });

    it('lanza 404 si el usuario no existe', async () => {
      usuarioModel.findByIdAndUpdate.mockReturnValue(darActualizado(null));

      await expect(
        service.cambiarEstado(USUARIO_ID, false, administrador),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('considera habilitada una cuenta sin el campo activo', async () => {
      usuarioModel.findByIdAndUpdate.mockReturnValue(
        darActualizado(documento({ activo: undefined })),
      );

      const resultado = await service.cambiarEstado(
        USUARIO_ID,
        true,
        administrador,
      );

      expect(resultado.activo).toBe(true);
    });
  });
});
