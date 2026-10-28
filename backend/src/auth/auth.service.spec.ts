import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { AuthService } from './auth.service';

const AVATAR_POR_DEFECTO = 'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/default.png';
const IMAGEN_SUBIDA = 'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/nueva.png';

const registroValido = {
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  password: 'Segura123',
  fechaNacimiento: '1998-05-20',
  descripcion: 'Hola!',
};

// Documento que "devuelve" Mongo en los tests (sin tocar la base real).
const documentoGuardado = (datos: Record<string, unknown>) => ({
  _id: '507f1f77bcf86cd799439011',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...datos,
});

describe('AuthService', () => {
  let service: AuthService;
  let usuarioModel: { exists: jest.Mock; findOne: jest.Mock; create: jest.Mock };
  let cloudinaryService: { uploadImage: jest.Mock };

  const darResultadoDeFindOne = (usuario: unknown) => ({
    select: jest.fn().mockResolvedValue(usuario),
  });

  beforeEach(async () => {
    usuarioModel = {
      exists: jest.fn().mockResolvedValue(null),
      findOne: jest.fn(),
      create: jest.fn((datos: Record<string, unknown>) =>
        Promise.resolve(documentoGuardado(datos)),
      ),
    };
    cloudinaryService = { uploadImage: jest.fn().mockResolvedValue(IMAGEN_SUBIDA) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: CloudinaryService, useValue: cloudinaryService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((clave: string) =>
              clave === 'DEFAULT_AVATAR_URL' ? AVATAR_POR_DEFECTO : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('registrar', () => {
    it('guarda el hash de la contraseña y la imagen por defecto', async () => {
      const resultado = await service.registrar(registroValido);

      const datosGuardados = usuarioModel.create.mock.calls[0][0];
      expect(datosGuardados.password).not.toBe(registroValido.password);
      expect(await bcrypt.compare(registroValido.password, datosGuardados.password)).toBe(true);
      expect(datosGuardados.imagenPerfilUrl).toBe(AVATAR_POR_DEFECTO);
      expect(datosGuardados.perfil).toBe('usuario');
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();

      expect(resultado.id).toBe('507f1f77bcf86cd799439011');
      expect(resultado).not.toHaveProperty('password');
      expect(resultado).not.toHaveProperty('_id');
    });

    it('sube la imagen a Cloudinary cuando el usuario adjunta un archivo', async () => {
      const archivo = { buffer: Buffer.from('imagen') } as Express.Multer.File;

      const resultado = await service.registrar(registroValido, archivo);

      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(archivo);
      expect(usuarioModel.create.mock.calls[0][0].imagenPerfilUrl).toBe(IMAGEN_SUBIDA);
      expect(resultado.imagenPerfilUrl).toBe(IMAGEN_SUBIDA);
    });

    it('rechaza con 409 si el correo ya está registrado', async () => {
      usuarioModel.exists.mockResolvedValueOnce({ _id: 'otro' });

      await expect(service.registrar(registroValido)).rejects.toBeInstanceOf(ConflictException);
      expect(usuarioModel.create).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el nombre de usuario ya está en uso', async () => {
      usuarioModel.exists.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'otro' });

      await expect(service.registrar(registroValido)).rejects.toThrow(
        'El nombre de usuario ya está en uso',
      );
    });

    it('traduce el error 11000 (índice unique) en un 409', async () => {
      usuarioModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.registrar(registroValido)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    const hashValido = () => bcrypt.hash('Segura123', 4);

    it('devuelve los datos del usuario (sin la contraseña) si todo coincide', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(documentoGuardado({ ...registroValido, password })),
      );

      const resultado = await service.login('anamoreno', 'Segura123');

      expect(usuarioModel.findOne).toHaveBeenCalledWith({
        $or: [{ correo: 'anamoreno' }, { nombreUsuario: 'anamoreno' }],
      });
      expect(resultado.nombreUsuario).toBe('anamoreno');
      expect(resultado).not.toHaveProperty('password');
    });

    it('busca por el correo y el nombre de usuario sin distinguir mayúsculas', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(documentoGuardado({ ...registroValido, password })),
      );

      await service.login('ANA@Correo.com', 'Segura123');

      expect(usuarioModel.findOne).toHaveBeenCalledWith({
        $or: [{ correo: 'ana@correo.com' }, { nombreUsuario: 'ana@correo.com' }],
      });
    });

    it('recorta los espacios sobrantes del identificador', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(documentoGuardado({ ...registroValido, password })),
      );

      // El DTO ya recorta, pero el servicio normaliza igual (defensa en profundidad).
      await service.login('  AnaMoreno  ', 'Segura123');

      expect(usuarioModel.findOne).toHaveBeenCalledWith({
        $or: [{ correo: 'anamoreno' }, { nombreUsuario: 'anamoreno' }],
      });
    });

    it('lanza 401 si el usuario no existe', async () => {
      usuarioModel.findOne.mockReturnValue(darResultadoDeFindOne(null));

      await expect(service.login('nadie', 'Segura123')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('lanza 401 si la contraseña es incorrecta', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(documentoGuardado({ ...registroValido, password })),
      );

      await expect(service.login('anamoreno', 'OtraClave1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
