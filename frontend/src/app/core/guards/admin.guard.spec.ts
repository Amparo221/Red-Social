import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { Sesion } from '../models/usuario.model';
import { AuthService, CLAVE_SESION } from '../services/auth.service';
import { adminGuard } from './admin.guard';

const SESION_ADMIN: Sesion = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  nombre: 'Ada',
  apellido: 'Admin',
  correo: 'ada@correo.com',
  nombreUsuario: 'adaadmin',
  fechaNacimiento: '1990-01-01',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'administrador',
  token: 'token-de-prueba',
};

const RUTA = {} as ActivatedRouteSnapshot;
const ESTADO = {} as RouterStateSnapshot;

describe('adminGuard', () => {
  let router: Router;
  let crearUrlTree: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
    crearUrlTree = vi.spyOn(router, 'createUrlTree');
  });

  afterEach(() => {
    localStorage.clear();
  });

  /** Ejecuta el guard dentro del injector de Angular, como lo haría el router. */
  const ejecutar = () => TestBed.runInInjectionContext(() => adminGuard(RUTA, ESTADO));

  it('deja pasar al administrador', () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(SESION_ADMIN));

    expect(ejecutar()).toBe(true);
    expect(crearUrlTree).not.toHaveBeenCalled();
  });

  it('manda al login si no hay sesión', () => {
    const resultado = ejecutar();

    expect(resultado).not.toBe(true);
    expect(crearUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('devuelve al feed con ?denegado=1 si el perfil no es administrador', () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ ...SESION_ADMIN, perfil: 'usuario' }),
    );

    const resultado = ejecutar();

    expect(resultado).not.toBe(true);
    expect(crearUrlTree).toHaveBeenCalledWith(['/publicaciones'], {
      queryParams: { denegado: 1 },
    });
    // La sesión NO se cierra: el usuario sigue logueado, sólo no tiene permiso.
    expect(TestBed.inject(AuthService).estaLogueado()).toBe(true);
  });
});
