import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { AuthService } from './auth.service';

const AVATAR_POR_DEFECTO =
  'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/default.png';
const IMAGEN_SUBIDA =
  'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/nueva.png';
const TOKEN = 'token-de-prueba';

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
  let usuarioModel: {
    exists: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };
  let cloudinaryService: { uploadImage: jest.Mock };
  let jwtService: { sign: jest.Mock };
  /** Simula el .env del backend: cada test agrega o pisa las variables que usa. */
  let variablesDeEntorno: Record<string, string | undefined>;

  const darResultadoDeFindOne = (usuario: unknown) => ({
    select: jest.fn().mockResolvedValue(usuario),
  });

  beforeEach(async () => {
    variablesDeEntorno = { DEFAULT_AVATAR_URL: AVATAR_POR_DEFECTO };
    usuarioModel = {
      exists: jest.fn().mockResolvedValue(null),
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn((datos: Record<string, unknown>) =>
        Promise.resolve(documentoGuardado(datos)),
      ),
    };
    cloudinaryService = {
      uploadImage: jest.fn().mockResolvedValue(IMAGEN_SUBIDA),
    };
    // No firmamos un JWT real: alcanza con comprobar QUÉ datos se firman.
    jwtService = { sign: jest.fn().mockReturnValue(TOKEN) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            // Simula el .env: cada test puede cambiarlo antes de llamar.
            get: jest.fn((clave: string) => variablesDeEntorno[clave]),
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
      expect(
        await bcrypt.compare(registroValido.password, datosGuardados.password),
      ).toBe(true);
      expect(datosGuardados.imagenPerfilUrl).toBe(AVATAR_POR_DEFECTO);
      expect(datosGuardados.perfil).toBe('usuario');
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();

      expect(resultado.id).toBe('507f1f77bcf86cd799439011');
      expect(resultado).not.toHaveProperty('password');
      expect(resultado).not.toHaveProperty('_id');
    });

    it('firma un token con el id, el nombre de usuario y el perfil', async () => {
      const resultado = await service.registrar(registroValido);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '507f1f77bcf86cd799439011',
        nombreUsuario: 'anamoreno',
        perfil: 'usuario',
      });
      expect(resultado.token).toBe(TOKEN);
    });

    it('sube la imagen a Cloudinary cuando el usuario adjunta un archivo', async () => {
      const archivo = { buffer: Buffer.from('imagen') } as Express.Multer.File;

      const resultado = await service.registrar(registroValido, archivo);

      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(archivo);
      expect(usuarioModel.create.mock.calls[0][0].imagenPerfilUrl).toBe(
        IMAGEN_SUBIDA,
      );
      expect(resultado.imagenPerfilUrl).toBe(IMAGEN_SUBIDA);
    });

    it('rechaza con 409 si el correo ya está registrado', async () => {
      usuarioModel.exists.mockResolvedValueOnce({ _id: 'otro' });

      await expect(service.registrar(registroValido)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usuarioModel.create).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el nombre de usuario ya está en uso', async () => {
      usuarioModel.exists
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: 'otro' });

      await expect(service.registrar(registroValido)).rejects.toThrow(
        'El nombre de usuario ya está en uso',
      );
    });

    it('traduce el error 11000 (índice unique) en un 409', async () => {
      usuarioModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.registrar(registroValido)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('responde 500 con el detalle si la base de datos falla', async () => {
      usuarioModel.create.mockRejectedValue(new Error('connection timed out'));

      const error: unknown = await service
        .registrar(registroValido)
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
        .registrar(registroValido, {
          buffer: Buffer.from('imagen'),
        } as Express.Multer.File)
        .catch((fallo: unknown) => fallo);

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(
        (error as InternalServerErrorException).getResponse(),
      ).toMatchObject({
        detalle: 'Must supply api_key',
      });
      // Si la imagen no se pudo subir no se guarda nada en la base.
      expect(usuarioModel.create).not.toHaveBeenCalled();
    });

    it('propaga el 409 de la verificación de duplicados sin convertirlo en 500', async () => {
      usuarioModel.exists.mockResolvedValueOnce({ _id: 'ya-existe' });

      const error: unknown = await service
        .registrar(registroValido)
        .catch((fallo: unknown) => fallo);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        message: 'El correo ya está registrado',
      });
    });
  });

  describe('login', () => {
    const hashValido = () => bcrypt.hash('Segura123', 4);

    it('devuelve los datos del usuario (sin la contraseña) si todo coincide', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(
          documentoGuardado({ ...registroValido, password }),
        ),
      );

      const resultado = await service.login('anamoreno', 'Segura123');

      expect(usuarioModel.findOne).toHaveBeenCalledWith({
        $or: [{ correo: 'anamoreno' }, { nombreUsuario: 'anamoreno' }],
      });
      expect(resultado.nombreUsuario).toBe('anamoreno');
      expect(resultado).not.toHaveProperty('password');
    });

    it('devuelve el token firmado para que el front lo use en los próximos requests', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(
          documentoGuardado({
            ...registroValido,
            password,
            perfil: 'administrador',
          }),
        ),
      );

      const resultado = await service.login('ana@correo.com', 'Segura123');

      expect(resultado.token).toBe(TOKEN);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '507f1f77bcf86cd799439011',
        nombreUsuario: 'anamoreno',
        perfil: 'administrador',
      });
    });

    it('busca por el correo y el nombre de usuario sin distinguir mayúsculas', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(
          documentoGuardado({ ...registroValido, password }),
        ),
      );

      await service.login('ANA@Correo.com', 'Segura123');

      expect(usuarioModel.findOne).toHaveBeenCalledWith({
        $or: [
          { correo: 'ana@correo.com' },
          { nombreUsuario: 'ana@correo.com' },
        ],
      });
    });

    it('recorta los espacios sobrantes del identificador', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(
          documentoGuardado({ ...registroValido, password }),
        ),
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
        darResultadoDeFindOne(
          documentoGuardado({ ...registroValido, password }),
        ),
      );

      await expect(
        service.login('anamoreno', 'OtraClave1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('autorizar', () => {
    const darUsuarioPorId = (usuario: unknown) => ({
      exec: jest.fn().mockResolvedValue(usuario),
    });

    it('devuelve el usuario del token sin la contraseña', async () => {
      usuarioModel.findById.mockReturnValue(
        darUsuarioPorId(
          documentoGuardado({ ...registroValido, password: 'hash' }),
        ),
      );

      const resultado = await service.autorizar('507f1f77bcf86cd799439011');

      expect(usuarioModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
      expect(resultado).toMatchObject({
        id: '507f1f77bcf86cd799439011',
        nombreUsuario: 'anamoreno',
        correo: 'ana@correo.com',
      });
      expect(resultado).not.toHaveProperty('password');
    });

    it('no firma un token nuevo (sólo valida la sesión guardada)', async () => {
      usuarioModel.findById.mockReturnValue(
        darUsuarioPorId(documentoGuardado({ ...registroValido })),
      );

      const resultado = await service.autorizar('507f1f77bcf86cd799439011');

      expect(resultado).not.toHaveProperty('token');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('lanza 401 si el usuario del token ya no existe', async () => {
      usuarioModel.findById.mockReturnValue(darUsuarioPorId(null));

      await expect(
        service.autorizar('507f1f77bcf86cd799439011'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refrescar', () => {
    const darUsuarioPorId = (usuario: unknown) => ({
      exec: jest.fn().mockResolvedValue(usuario),
    });

    it('firma un token nuevo con los datos del usuario vigente', async () => {
      usuarioModel.findById.mockReturnValue(
        darUsuarioPorId(
          documentoGuardado({ ...registroValido, perfil: 'administrador' }),
        ),
      );

      const resultado = await service.refrescar('507f1f77bcf86cd799439011');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '507f1f77bcf86cd799439011',
        nombreUsuario: 'anamoreno',
        perfil: 'administrador',
      });
      expect(resultado.token).toBe(TOKEN);
      expect(resultado).not.toHaveProperty('password');
    });

    it('lanza 401 si el usuario del token ya no existe', async () => {
      usuarioModel.findById.mockReturnValue(darUsuarioPorId(null));

      await expect(
        service.refrescar('507f1f77bcf86cd799439011'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('politicaSesion', () => {
    it('lee la duración y el aviso del .env', () => {
      variablesDeEntorno.JWT_EXPIRES_IN = '60';
      variablesDeEntorno.SESION_AVISO_SEGUNDOS = '20';

      expect(service.politicaSesion()).toEqual({
        expiracionSegundos: 60,
        avisoSegundos: 20,
      });
    });

    it('usa 15 minutos de sesión y 5 de aviso si faltan las variables', () => {
      expect(service.politicaSesion()).toEqual({
        expiracionSegundos: 900,
        avisoSegundos: 300,
      });
    });

    it('ignora valores inválidos (cero, texto vacío o basura)', () => {
      variablesDeEntorno.JWT_EXPIRES_IN = '0';
      variablesDeEntorno.SESION_AVISO_SEGUNDOS = 'cinco minutos';

      expect(service.politicaSesion()).toEqual({
        expiracionSegundos: 900,
        avisoSegundos: 300,
      });
    });

    it('recorta el aviso para que no tape la sesión entera', () => {
      variablesDeEntorno.JWT_EXPIRES_IN = '60';
      variablesDeEntorno.SESION_AVISO_SEGUNDOS = '600';

      // 60 s de sesión: el aviso no puede durar más de la mitad.
      expect(service.politicaSesion()).toEqual({
        expiracionSegundos: 60,
        avisoSegundos: 30,
      });
    });
  });
});
