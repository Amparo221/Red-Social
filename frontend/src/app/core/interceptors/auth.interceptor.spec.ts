import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import type { Sesion } from '../models/usuario.model';
import { AuthService, CLAVE_SESION } from '../services/auth.service';
import { DEMORA_REDIRECCION_MS, SesionExpiradaService } from '../services/sesion-expirada.service';
import { authInterceptor } from './auth.interceptor';

const SESION: Sesion = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1995-04-12',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'usuario',
  token: 'token-de-prueba',
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let control: HttpTestingController;
  let auth: AuthService;
  let router: Router;
  let avisoSesion: SesionExpiradaService;

  beforeEach(() => {
    // El aviso del 401 usa temporizadores (2 s antes de navegar).
    vi.useFakeTimers();
    localStorage.clear();
    // La sesión se restaura del localStorage al construir el AuthService.
    localStorage.setItem(CLAVE_SESION, JSON.stringify(SESION));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpClient);
    control = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    avisoSesion = TestBed.inject(SesionExpiradaService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    control.verify();
    localStorage.clear();
  });

  it('agrega el Bearer del JWT en las rutas del backend', () => {
    http.get(`${environment.apiUrl}/publicaciones`).subscribe();

    const pedido = control.expectOne(`${environment.apiUrl}/publicaciones`);
    expect(pedido.request.headers.get('Authorization')).toBe(`Bearer ${SESION.token}`);

    pedido.flush({ total: 0, publicaciones: [] });
  });

  it('no agrega el header en login ni en registro (son rutas públicas)', () => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe();

    const pedido = control.expectOne(`${environment.apiUrl}/auth/login`);
    expect(pedido.request.headers.has('Authorization')).toBe(false);

    pedido.flush(SESION);
  });

  it('no agrega el header si no hay sesión', () => {
    auth.cerrarSesion();

    http.get(`${environment.apiUrl}/publicaciones`).subscribe();

    const pedido = control.expectOne(`${environment.apiUrl}/publicaciones`);
    expect(pedido.request.headers.has('Authorization')).toBe(false);

    pedido.flush({});
  });

  it('con un 401 en una ruta protegida cierra la sesión y avisa 2 s antes de ir al login', () => {
    let huboError = false;
    http.get(`${environment.apiUrl}/publicaciones`).subscribe({ error: () => (huboError = true) });

    control
      .expectOne(`${environment.apiUrl}/publicaciones`)
      .flush({ statusCode: 401, message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(huboError).toBe(true);
    expect(auth.estaLogueado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();

    // El error 401 se muestra en el acto, con la cuenta regresiva.
    expect(avisoSesion.avisando()).toBe(true);
    expect(avisoSesion.motivoActual()).toBe('expirada');
    expect(avisoSesion.segundosRestantes()).toBe(DEMORA_REDIRECCION_MS / 1000);
    // Todavía no se navegó: se le da tiempo al usuario a leerlo.
    expect(router.navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DEMORA_REDIRECCION_MS);

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { sesion: 'expirada' } });
    // El cartel se cierra solo al llegar al login.
    expect(avisoSesion.avisando()).toBe(false);
  });

  it('no cierra la sesión cuando el 401 viene del login (contraseña incorrecta)', () => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => undefined });

    control
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ statusCode: 401, message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estaLogueado()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('si la cuenta fue deshabilitada avisa con ?sesion=deshabilitada', () => {
    http.get(`${environment.apiUrl}/publicaciones`).subscribe({ error: () => undefined });

    control
      .expectOne(`${environment.apiUrl}/publicaciones`)
      .flush(
        {
          statusCode: 401,
          message: 'Tu cuenta está deshabilitada. Contactá a un administrador.',
          error: 'Unauthorized',
          motivo: 'CUENTA_DESHABILITADA',
        },
        { status: 401, statusText: 'Unauthorized' },
      );

    // En los dos casos se cierra la sesión; cambia el cartel del 401 y del login.
    expect(auth.estaLogueado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
    expect(avisoSesion.motivoActual()).toBe('deshabilitada');
    expect(router.navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DEMORA_REDIRECCION_MS);

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { sesion: 'deshabilitada' },
    });
  });
});
