import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Perfil } from '../../usuarios/schemas/usuario.schema';
import { RolesGuard } from './roles.guard';

/** Contexto con el usuario que dejó `JwtAuthGuard` en el request. */
const crearContexto = (perfil?: Perfil) => {
  const handler = () => undefined;
  const clase = class ControladorDePrueba {};
  const request = {
    usuario: perfil
      ? { id: '507f1f77bcf86cd799439011', nombreUsuario: 'ana', perfil }
      : undefined,
  };

  const contexto = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => clase,
  } as unknown as ExecutionContext;

  return { contexto, handler, clase };
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('deja pasar las rutas sin @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { contexto } = crearContexto('usuario');

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('usa la metadata del método y de la clase, en ese orden', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);
    const { contexto, handler, clase } = crearContexto('administrador');

    guard.canActivate(contexto);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      clase,
    ]);
  });

  it('deja pasar al administrador', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);
    const { contexto } = crearContexto('administrador');

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('rechaza con 403 a un usuario común', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);
    const { contexto } = crearContexto('usuario');

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto)).toThrow(
      'Sólo un administrador puede realizar esta acción',
    );
  });

  it('rechaza si falta el usuario (ruta sin JwtAuthGuard)', () => {
    reflector.getAllAndOverride.mockReturnValue(['administrador']);
    const { contexto } = crearContexto(undefined);

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });
});
