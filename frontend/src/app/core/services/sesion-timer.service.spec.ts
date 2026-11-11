import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import type { Sesion } from '../models/usuario.model';
import { AuthService, CLAVE_SESION } from './auth.service';
import { SesionTimerService } from './sesion-timer.service';

const AHORA = new Date('2026-11-11T12:00:00.000Z');
const URL_SESION = `${environment.apiUrl}/auth/sesion`;
const URL_REFRESCAR = `${environment.apiUrl}/auth/refrescar`;

/** JWT de mentira que vence `segundos` después de AHORA. */
function tokenQueVenceEn(segundos: number): string {
  const payload = {
    sub: '64b7f0c2a1b2c3d4e5f60718',
    nombreUsuario: 'anamoreno',
    perfil: 'usuario',
    exp: Math.floor(AHORA.getTime() / 1000) + segundos,
  };
  const base64url = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `cabecera.${base64url}.firma`;
}

function unaSesion(token: string): Sesion {
  return {
    id: '64b7f0c2a1b2c3d4e5f60718',
    nombre: 'Ana',
    apellido: 'Moreno',
    correo: 'ana@correo.com',
    nombreUsuario: 'anamoreno',
    fechaNacimiento: '1995-04-12',
    descripcion: '',
    imagenPerfilUrl: '',
    perfil: 'usuario',
    token,
  };
}

describe('SesionTimerService', () => {
  let http: HttpTestingController;
  let appRef: ApplicationRef;
  let auth: AuthService;
  let timer: SesionTimerService;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    localStorage.clear();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion(tokenQueVenceEn(30))));

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    http = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    auth = TestBed.inject(AuthService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    timer = TestBed.inject(SesionTimerService);
    // Los `effect` corren en un tick de la aplicación (no hay componente que
    // los dispare en este test).
    appRef.tick();

    // El reloj pide la política al backend: aviso 10 s antes del vencimiento.
    http.expectOne(URL_SESION).flush({ expiracionSegundos: 900, avisoSegundos: 10 });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('deriva el tiempo restante del exp del token', () => {
    expect(timer.segundosRestantes()).toBe(30);
    expect(timer.avisando()).toBe(false);
  });

  it('avisa cuando entra en la ventana que manda el backend', () => {
    vi.advanceTimersByTime(21_000);

    expect(timer.segundosRestantes()).toBe(9);
    expect(timer.avisando()).toBe(true);
  });

  it('al llegar a cero cierra la sesión y manda al login con el aviso', () => {
    vi.advanceTimersByTime(30_000);

    expect(timer.segundosRestantes()).toBe(0);
    expect(auth.estaLogueado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], {
      queryParams: { sesion: 'expirada' },
    });
  });

  it('extender pide un token nuevo y reinicia el reloj', () => {
    timer.extender();

    expect(timer.extendiendoSesion()).toBe(true);

    http.expectOne(URL_REFRESCAR).flush(unaSesion(tokenQueVenceEn(900)));

    expect(timer.extendiendoSesion()).toBe(false);

    // El token cambió: el effect vuelve a correr y recalcula.
    appRef.tick();

    expect(timer.segundosRestantes()).toBe(900);
    expect(timer.avisando()).toBe(false);
    // La política está cacheada: no se vuelve a pedir en cada refresco.
    http.expectNone(URL_SESION);
  });

  it('si el refresco falla, cierra la sesión igual', () => {
    timer.extender();

    http
      .expectOne(URL_REFRESCAR)
      .flush({ message: 'No autorizado' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estaLogueado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], {
      queryParams: { sesion: 'expirada' },
    });
  });

  it('salir cierra la sesión sin mostrar el aviso de expirada', () => {
    timer.salir();

    expect(auth.estaLogueado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });

  it('sin sesión no arranca el reloj', () => {
    auth.cerrarSesion();
    appRef.tick();

    expect(timer.segundosRestantes()).toBe(0);
    expect(timer.avisando()).toBe(false);
  });
});
