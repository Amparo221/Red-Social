import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { NuevoUsuario, Usuario } from '../models/usuario.model';
import { AuthService, CLAVE_SESION } from './auth.service';

const USUARIO: Usuario = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1995-04-12',
  descripcion: '',
  imagenPerfilUrl: 'https://res.cloudinary.com/demo/red-social/perfiles/default.jpg',
  perfil: 'usuario',
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
  });

  it('hace POST JSON a /auth/login, recorta los datos y guarda la sesión', () => {
    let respuesta: Usuario | undefined;

    servicio
      .login({ identificador: '  ana@correo.com ', password: ' Segura123 ' })
      .subscribe((usuario) => (respuesta = usuario));

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
    expect(localStorage.getItem(CLAVE_SESION)).toContain('anamoreno');
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
  });
});
