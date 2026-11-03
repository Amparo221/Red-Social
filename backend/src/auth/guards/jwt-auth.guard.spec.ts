import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verify: jest.Mock };

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
  });

  it('deja pasar el request y cuelga el usuario cuando el token es válido', () => {
    jwtService.verify.mockReturnValue({
      sub: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
    const { contexto, request } = contextoConHeader('Bearer token-valido');

    expect(guard.canActivate(contexto)).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('token-valido');
    // Los controladores usan este objeto: el id sale del token, no del cliente.
    expect(request.usuario).toEqual({
      id: ID_USUARIO,
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
    });
  });

  it('acepta el esquema bearer en minúsculas', () => {
    jwtService.verify.mockReturnValue({ sub: ID_USUARIO, nombreUsuario: 'ana', perfil: 'usuario' });
    const { contexto } = contextoConHeader('bearer token-valido');

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('lanza 401 si no viene el header Authorization', () => {
    const { contexto } = contextoConHeader(undefined);

    expect(() => guard.canActivate(contexto)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contexto)).toThrow('Falta el token de autenticación');
  });

  it('lanza 401 si el header no usa el esquema Bearer', () => {
    const { contexto } = contextoConHeader('Basic dXN1YXJpbzpjbGF2ZQ==');

    expect(() => guard.canActivate(contexto)).toThrow(UnauthorizedException);
  });

  it('lanza 401 si el token está vencido o la firma no es válida', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const { contexto, request } = contextoConHeader('Bearer token-vencido');

    expect(() => guard.canActivate(contexto)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contexto)).toThrow('El token es inválido o expiró');
    // Nunca se marca al request como autenticado.
    expect(request.usuario).toBeUndefined();
  });
});
