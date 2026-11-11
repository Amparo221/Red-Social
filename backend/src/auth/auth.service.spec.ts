import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import {
  CUENTA_DESHABILITADA,
  MOTIVO_CUENTA_DESHABILITADA,
} from './constants/cuenta-deshabilitada';

const TOKEN = 'token-de-prueba';
const USUARIO_ID = '507f1f77bcf86cd799439011';
const AVATAR_POR_DEFECTO =
  'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/default.png';

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
  _id: USUARIO_ID,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...datos,
});

// Lo que devuelve `UsuariosService.crear` (ya sin password ni __v).
const usuarioCreado = {
  id: USUARIO_ID,
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1998-05-20',
  descripcion: 'Hola!',
  imagenPerfilUrl: AVATAR_POR_DEFECTO,
  perfil: 'usuario' as const,
  activo: true,
  fechaBaja: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let usuarioModel: { findOne: jest.Mock; findById: jest.Mock };
  let usuariosService: { crear: jest.Mock };
  let jwtService: { sign: jest.Mock };
  /** Simula el .env del backend: cada test agrega o pisa las variables que usa. */
  let variablesDeEntorno: Record<string, string | undefined>;

  const darResultadoDeFindOne = (usuario: unknown) => ({
    select: jest.fn().mockResolvedValue(usuario),
  });

  const darUsuarioPorId = (usuario: unknown) => ({
    exec: jest.fn().mockResolvedValue(usuario),
  });

  beforeEach(async () => {
    variablesDeEntorno = { DEFAULT_AVATAR_URL: AVATAR_POR_DEFECTO };
    usuarioModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    // El alta ahora vive en UsuariosService: acá sólo se comprueba la delegación.
    usuariosService = {
      crear: jest.fn().mockResolvedValue(usuarioCreado),
    };
    // No firmamos un JWT real: alcanza con comprobar QUÉ datos se firman.
    jwtService = { sign: jest.fn().mockReturnValue(TOKEN) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: UsuariosService, useValue: usuariosService },
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
    it('delega el alta en UsuariosService con el perfil "usuario" y la imagen', async () => {
      const archivo = { buffer: Buffer.from('imagen') } as Express.Multer.File;

      const resultado = await service.registrar(registroValido, archivo);

      expect(usuariosService.crear).toHaveBeenCalledWith(
        { ...registroValido, perfil: 'usuario' },
        archivo,
      );
      // El registro público devuelve lo mismo que antes: el usuario + el token.
      expect(resultado.id).toBe(USUARIO_ID);
      expect(resultado.token).toBe(TOKEN);
      expect(resultado).not.toHaveProperty('password');
      expect(resultado).not.toHaveProperty('_id');
    });

    it('pisa el perfil que venga en el body: nadie se registra como administrador', async () => {
      // Variable aparte a propósito: así el objeto puede tener un campo de más
      // sin que TypeScript lo rechace por "excess property".
      const intentoDeAdmin = { ...registroValido, perfil: 'administrador' };

      await service.registrar(intentoDeAdmin);

      expect(usuariosService.crear).toHaveBeenCalledWith(
        expect.objectContaining({ perfil: 'usuario' }),
        undefined,
      );
    });

    it('firma un token con el id, el nombre de usuario y el perfil', async () => {
      await service.registrar(registroValido);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: USUARIO_ID,
        nombreUsuario: 'anamoreno',
        perfil: 'usuario',
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

    it('lanza 401 con motivo CUENTA_DESHABILITADA si la cuenta está dada de baja', async () => {
      const password = await hashValido();
      usuarioModel.findOne.mockReturnValue(
        darResultadoDeFindOne(
          documentoGuardado({ ...registroValido, password, activo: false }),
        ),
      );

      const error: unknown = await service
        .login('anamoreno', 'Segura123')
        .catch((fallo: unknown) => fallo);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(
        (error as UnauthorizedException).getResponse(),
      ).toMatchObject({
        message: CUENTA_DESHABILITADA,
        motivo: MOTIVO_CUENTA_DESHABILITADA,
      });
      // No se firma token para una cuenta deshabilitada.
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('autorizar', () => {
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

    it('lanza 401 con motivo si la cuenta fue deshabilitada después del login', async () => {
      usuarioModel.findById.mockReturnValue(
        darUsuarioPorId(
          documentoGuardado({
            ...registroValido,
            password: 'hash',
            activo: false,
          }),
        ),
      );

      const error: unknown = await service
        .autorizar('507f1f77bcf86cd799439011')
        .catch((fallo: unknown) => fallo);

      expect(
        (error as UnauthorizedException).getResponse(),
      ).toMatchObject({ motivo: MOTIVO_CUENTA_DESHABILITADA });
    });
  });

  describe('refrescar', () => {
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
