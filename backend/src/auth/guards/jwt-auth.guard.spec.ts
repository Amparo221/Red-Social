import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { UsuarioDocument } from '../../usuarios/schemas/usuario.schema';
import {
  CUENTA_DESHABILITADA,
  MOTIVO_CUENTA_DESHABILITADA,
} from '../constants/cuenta-deshabilitada';
import { JwtAuthGuard } from './jwt-auth.guard';

const ID_USUARIO = '507f1f77bcf86cd799439011';

/** Request falso con el header que queremos probar. */
const contextoConHeader = (authorization?: string) => {
  const request: { headers: { authorization?: string }; usuario?: unknown } = {
    headers: { authorization },
  };

  const contexto = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { contexto, request };
};

/** Simula la consulta `findById(id).select(...).exec()` que hace el guard. */
const darUsuarioDeLaBase = (usuario: unknown) => {
  const exec = jest.fn().mockResolvedValue(usuario);
  const select = jest.fn().mockReturnValue({ exec });

  return { findById: jest.fn().mockReturnValue({ select }), select, exec };
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verify: jest.Mock };
  let usuarioModel: ReturnType<typeof darUsuarioDeLaBase>;

  const crearGuard = () =>
    new JwtAuthGuard(
      jwtService as unknown as JwtService,
      usuarioModel as unknown as Model<UsuarioDocument>,
    );

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    usuarioModel = darUsuarioDeLaBase({
      _id: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
      activo: true,
    });
    guard = crearGuard();
  });

  it('deja pasar el request y cuelga el usuario cuando el token es válido', async () => {
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    const { contexto, request } = contextoConHeader('Bearer token-valido');

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('token-valido');
    // Sólo se piden los campos que el request necesita (nunca el hash).
    expect(usuarioModel.findById).toHaveBeenCalledWith(ID_USUARIO);
    expect(usuarioModel.select).toHaveBeenCalledWith('activo perfil nombreUsuario');
    // Los controladores usan este objeto: el id sale del token, no del cliente.
    expect(request.usuario).toEqual({
      id: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
  });

  it('acepta el esquema bearer en minúsculas', async () => {
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'ana',
      perfil: 'usuario',
    });
    const { contexto } = contextoConHeader('bearer token-valido');

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('toma el perfil de la base y no del token', async () => {
    // El token decía "usuario"; en la base ya es administrador (o al revés):
    // manda la base para que un cambio de rol tenga efecto inmediato.
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    usuarioModel = darUsuarioDeLaBase({
      _id: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'administrador',
      activo: true,
    });
    guard = crearGuard();
    const { contexto, request } = contextoConHeader('Bearer token-valido');

    await guard.canActivate(contexto);

    expect(request.usuario).toMatchObject({ perfil: 'administrador' });
  });

  it('deja pasar a los usuarios viejos que no tienen el campo activo', async () => {
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    usuarioModel = darUsuarioDeLaBase({
      _id: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    guard = crearGuard();
    const { contexto } = contextoConHeader('Bearer token-valido');

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('lanza 401 si no viene el header Authorization', async () => {
    const { contexto } = contextoConHeader(undefined);

    await expect(guard.canActivate(contexto)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      'Falta el token de autenticación',
    );
  });

  it('lanza 401 si el header no usa el esquema Bearer', async () => {
    const { contexto } = contextoConHeader('Basic dXN1YXJpbzpjbGF2ZQ==');

    await expect(guard.canActivate(contexto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el token está vencido o la firma no es válida', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const { contexto, request } = contextoConHeader('Bearer token-vencido');

    await expect(guard.canActivate(contexto)).rejects.toThrow(
      'El token es inválido o expiró',
    );
    // Nunca se marca al request como autenticado.
    expect(request.usuario).toBeUndefined();
    expect(usuarioModel.findById).not.toHaveBeenCalled();
  });

  it('lanza 401 si el usuario del token ya no existe en la base', async () => {
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    usuarioModel = darUsuarioDeLaBase(null);
    guard = crearGuard();
    const { contexto } = contextoConHeader('Bearer token-valido');

    await expect(guard.canActivate(contexto)).rejects.toThrow(
      'El usuario del token ya no existe',
    );
  });

  it('lanza 401 con motivo CUENTA_DESHABILITADA si la cuenta fue dada de baja', async () => {
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    usuarioModel = darUsuarioDeLaBase({
      _id: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
      activo: false,
    });
    guard = crearGuard();
    const { contexto, request } = contextoConHeader('Bearer token-valido');

    const error: unknown = await guard.canActivate(contexto).catch(
      (fallo: unknown) => fallo,
    );

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      statusCode: 401,
      message: CUENTA_DESHABILITADA,
      motivo: MOTIVO_CUENTA_DESHABILITADA,
    });
    expect(request.usuario).toBeUndefined();
  });
});
