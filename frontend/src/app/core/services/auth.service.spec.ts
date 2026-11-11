import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { NuevoUsuario, PoliticaSesion, Sesion, Usuario } from '../models/usuario.model';
import { POLITICA_SESION_POR_DEFECTO } from '../models/usuario.model';
import { AuthService, CLAVE_SESION } from './auth.service';

const TOKEN = 'token-de-prueba';

const USUARIO: Sesion = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1995-04-12',
  descripcion: '',
  imagenPerfilUrl: 'https://res.cloudinary.com/demo/red-social/perfiles/default.jpg',
  perfil: 'usuario',
  token: TOKEN,
};

const NUEVO: NuevoUsuario = {
  nombre: ' Ana ',
  apellido: 'Moreno',
  correo: ' Ana@Correo.com ',
  nombreUsuario: ' AnaMoreno ',
  password: ' Segura123 ',
  fechaNacimiento: '1995-04-12',
  descripcion: '  Hola  ',
};

describe('AuthService', () => {
  let servicio: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('arranca sin sesión', () => {
    expect(servicio.estaLogueado()).toBe(false);
    expect(servicio.usuarioActual()).toBeNull();
    expect(servicio.tokenActual()).toBeNull();
  });

  it('hace POST JSON a /auth/login, recorta los datos y guarda la sesión', () => {
    let respuesta: Sesion | undefined;

    servicio
      .login({ identificador: '  ana@correo.com ', password: ' Segura123 ' })
      .subscribe((sesion) => (respuesta = sesion));

    const pedido = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      identificador: 'ana@correo.com',
      password: 'Segura123',
    });

    pedido.flush(USUARIO);

    expect(respuesta).toEqual(USUARIO);
    expect(servicio.usuarioActual()).toEqual(USUARIO);
    expect(servicio.estaLogueado()).toBe(true);
    expect(servicio.tokenActual()).toBe(TOKEN);
    expect(localStorage.getItem(CLAVE_SESION)).toContain('anamoreno');
    expect(localStorage.getItem(CLAVE_SESION)).toContain(TOKEN);
  });

  it('registra como multipart (FormData) con la foto elegida', () => {
    const foto = new File(['foto'], 'foto.png', { type: 'image/png' });

    servicio.registrar(NUEVO, foto).subscribe();

    const pedido = http.expectOne(`${environment.apiUrl}/auth/registro`);
    const cuerpo = pedido.request.body as FormData;

    expect(cuerpo instanceof FormData).toBe(true);
    expect(cuerpo.get('nombre')).toBe('Ana');
    expect(cuerpo.get('correo')).toBe('Ana@Correo.com');
    expect(cuerpo.get('nombreUsuario')).toBe('AnaMoreno');
    expect(cuerpo.get('password')).toBe('Segura123');
    expect(cuerpo.get('fechaNacimiento')).toBe('1995-04-12');
    expect(cuerpo.get('descripcion')).toBe('Hola');
    expect(cuerpo.get('imagen')).toBe(foto);

    pedido.flush(USUARIO);
    expect(servicio.estaLogueado()).toBe(true);
  });

  it('no manda descripcion ni imagen cuando quedaron vacías', () => {
    servicio.registrar({ ...NUEVO, descripcion: '   ' }).subscribe();

    const pedido = http.expectOne(`${environment.apiUrl}/auth/registro`);
    const cuerpo = pedido.request.body as FormData;

    expect(cuerpo.has('descripcion')).toBe(false);
    expect(cuerpo.has('imagen')).toBe(false);

    pedido.flush(USUARIO);
  });

  it('cerrarSesion limpia el signal y el localStorage', () => {
    servicio.login({ identificador: 'ana@correo.com', password: 'Segura123' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(USUARIO);

    servicio.cerrarSesion();

    expect(servicio.usuarioActual()).toBeNull();
    expect(servicio.estaLogueado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it('restaura la sesión guardada al arrancar (F5)', () => {
    TestBed.resetTestingModule();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(USUARIO));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const nuevoServicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    expect(nuevoServicio.estaLogueado()).toBe(true);
    expect(nuevoServicio.usuarioActual()?.nombreUsuario).toBe('anamoreno');
    expect(nuevoServicio.tokenActual()).toBe(TOKEN);
  });

  it('validarSesion pide GET /auth/autorizar y conserva el token guardado', () => {
    TestBed.resetTestingModule();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(USUARIO));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const servicioValidado = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    let usuario: Usuario | undefined;
    servicioValidado.validarSesion().subscribe((respuesta) => (usuario = respuesta));

    const pedido = http.expectOne(`${environment.apiUrl}/auth/autorizar`);
    expect(pedido.request.method).toBe('GET');

    // El backend no firma un token nuevo: aunque el cuerpo traiga otro, se
    // conserva el que ya tenía la sesión (y se refrescan los datos del perfil).
    pedido.flush({ ...USUARIO, descripcion: 'Nueva bio', token: 'otro-token' });

    expect(usuario?.descripcion).toBe('Nueva bio');
    expect(servicioValidado.usuarioActual()?.descripcion).toBe('Nueva bio');
    expect(servicioValidado.tokenActual()).toBe(TOKEN);
  });

  it('refrescar pide POST /auth/refrescar y reemplaza el token guardado', () => {
    servicio.login({ identificador: 'ana@correo.com', password: 'Segura123' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(USUARIO);

    servicio.refrescar().subscribe();

    const pedido = http.expectOne(`${environment.apiUrl}/auth/refrescar`);
    expect(pedido.request.method).toBe('POST');
    pedido.flush({ ...USUARIO, token: 'token-renovado' });

    expect(servicio.tokenActual()).toBe('token-renovado');
    expect(servicio.usuarioActual()?.nombreUsuario).toBe('anamoreno');
    expect(localStorage.getItem(CLAVE_SESION)).toContain('token-renovado');
  });

  it('politicaSesion pide /auth/sesion una sola vez (la cachea)', () => {
    let politica: PoliticaSesion | undefined;

    servicio.politicaSesion().subscribe((respuesta) => (politica = respuesta));

    const pedido = http.expectOne(`${environment.apiUrl}/auth/sesion`);
    expect(pedido.request.method).toBe('GET');
    pedido.flush({ expiracionSegundos: 60, avisoSegundos: 20 });

    expect(politica).toEqual({ expiracionSegundos: 60, avisoSegundos: 20 });

    // Segunda llamada: sale de la cache, sin otro request.
    servicio.politicaSesion().subscribe((respuesta) => (politica = respuesta));
    http.expectNone(`${environment.apiUrl}/auth/sesion`);
    expect(politica).toEqual({ expiracionSegundos: 60, avisoSegundos: 20 });
  });

  it('politicaSesion cae en los valores por defecto si el backend falla', () => {
    let politica: PoliticaSesion | undefined;

    servicio.politicaSesion().subscribe((respuesta) => (politica = respuesta));

    http
      .expectOne(`${environment.apiUrl}/auth/sesion`)
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(politica).toEqual(POLITICA_SESION_POR_DEFECTO);
  });

  it('descarta la sesión guardada sin token (las del Sprint 1 ya no sirven)', () => {
    TestBed.resetTestingModule();
    // Un JSON.stringify ignora las claves undefined, así que esto simula una
    // sesión vieja guardada sin token.
    localStorage.setItem(CLAVE_SESION, JSON.stringify({ ...USUARIO, token: undefined }));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const nuevoServicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    expect(nuevoServicio.estaLogueado()).toBe(false);
    expect(nuevoServicio.tokenActual()).toBeNull();
  });
});
