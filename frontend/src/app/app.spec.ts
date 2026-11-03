import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
