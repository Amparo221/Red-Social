import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';
import { App } from './app';
import { CLAVE_SESION } from './core/services/auth.service';

const SESION_GUARDADA = {
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

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    // Los tests del splash usan relojes falsos: siempre se vuelve al real.
    vi.useRealTimers();
    localStorage.clear();
  });

  it('crea el shell de la app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  it('muestra la marca IdentiBird y los accesos sin sesión', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compilado = fixture.nativeElement as HTMLElement;
    const texto = compilado.textContent ?? '';

    expect(texto).toContain('IdentiBird');
    expect(texto).toContain('Ingresar');
    expect(texto).toContain('Crear cuenta');
  });

  it('con sesión muestra los accesos al feed y al perfil', async () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(SESION_GUARDADA));

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compilado = fixture.nativeElement as HTMLElement;
    const texto = compilado.textContent ?? '';
    // RouterLink pone el href en cada <a>, incluso en la marca con [routerLink].
    const destinos = Array.from(compilado.querySelectorAll('a')).map((enlace) =>
      enlace.getAttribute('href'),
    );

    expect(texto).toContain('@anamoreno');
    expect(texto).toContain('Publicaciones');
    expect(texto).toContain('Mi perfil');
    expect(texto).toContain('Salir');
    expect(destinos).toContain('/inicio');
    // La marca y el link del menú llevan al feed: es la pantalla principal.
    expect(destinos.filter((destino) => destino === '/publicaciones')).toHaveLength(2);
  });

  it('con sesión muestra el splash hasta validar el token y cumplir el mínimo', () => {
    vi.useFakeTimers();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(SESION_GUARDADA));
    const http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compilado = fixture.nativeElement as HTMLElement;
    expect(compilado.querySelector('.splash')).not.toBeNull();
    expect(compilado.textContent).toContain('Cargando tu sesión');
    // La pluma de public/ es el spinner; el logo de la app ya no va en el splash.
    const pluma = compilado.querySelector<HTMLImageElement>('.splash__spinner');
    expect(pluma?.getAttribute('src')).toBe('feather.png');
    expect(compilado.querySelector('.splash__icono')).toBeNull();

    // El splash valida la sesión guardada contra GET /auth/autorizar...
    const validacion = http.expectOne(`${environment.apiUrl}/auth/autorizar`);
    expect(validacion.request.method).toBe('GET');
    validacion.flush(SESION_GUARDADA);

    // ...y sigue visible porque todavía no se cumplieron los 2 s del mínimo.
    expect(compilado.querySelector('.splash')).not.toBeNull();

    vi.advanceTimersByTime(environment.cargaMinimaMs);
    fixture.detectChanges();

    expect(compilado.querySelector('.splash')).toBeNull();
    expect(compilado.textContent).toContain('@anamoreno');
  });

  it('sin sesión no muestra el splash ni consulta /auth/autorizar', () => {
    const http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compilado = fixture.nativeElement as HTMLElement;
    expect(compilado.querySelector('.splash')).toBeNull();
    http.expectNone((req) => req.url.endsWith('/auth/autorizar'));
  });
});
