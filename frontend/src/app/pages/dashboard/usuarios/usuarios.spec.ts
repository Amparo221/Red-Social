import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import type { ListadoUsuarios, Sesion, Usuario } from '../../../core/models/usuario.model';
import { CLAVE_SESION } from '../../../core/services/auth.service';
import { Usuarios } from './usuarios';

const URL_USUARIOS = `${environment.apiUrl}/usuarios`;

const ADMIN: Sesion = {
  id: 'admin-1',
  nombre: 'Ada',
  apellido: 'Admin',
  correo: 'ada@correo.com',
  nombreUsuario: 'adaadmin',
  fechaNacimiento: '1990-01-01',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'administrador',
  activo: true,
  token: 'token-de-prueba',
};

const ANA: Usuario = {
  id: 'u-1',
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1998-05-20',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'usuario',
  activo: true,
  fechaBaja: null,
};

const BETO: Usuario = {
  id: 'u-2',
  nombre: 'Beto',
  apellido: 'Pérez',
  correo: 'beto@correo.com',
  nombreUsuario: 'betoperez',
  fechaNacimiento: '1995-02-02',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'usuario',
  activo: false,
  fechaBaja: '2026-11-01T12:00:00.000Z',
};

const LISTADO: ListadoUsuarios = {
  total: 2,
  offset: 0,
  limit: 10,
  hayMas: false,
  usuarios: [ANA, BETO],
};

const html = (fixture: ComponentFixture<Usuarios>) => fixture.nativeElement as HTMLElement;

/** Fila de la tabla cuyo texto contiene el nombre de usuario. */
const filaDe = (fixture: ComponentFixture<Usuarios>, usuario: string) =>
  Array.from(html(fixture).querySelectorAll('tbody tr')).find((fila) =>
    fila.textContent?.includes(`@${usuario}`),
  ) as HTMLTableRowElement;

describe('Usuarios (dashboard)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(ADMIN));

    TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** Crea la pantalla y responde el listado inicial. */
  const montar = (listado: ListadoUsuarios = LISTADO) => {
    const fixture = TestBed.createComponent(Usuarios);
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_USUARIOS);
    expect(pedido.request.method).toBe('GET');
    pedido.flush(listado);
    fixture.detectChanges();

    return fixture;
  };

  it('carga el listado al entrar y muestra estado y fecha de baja', () => {
    const fixture = montar();
    const texto = html(fixture).textContent ?? '';

    expect(texto).toContain('@anamoreno');
    expect(texto).toContain('Habilitada');
    expect(texto).toContain('@betoperez');
    expect(texto).toContain('Deshabilitada');
    // La fecha de baja se muestra relativa ("hace …") o como fecha corta.
    expect(filaDe(fixture, 'betoperez').textContent).not.toContain('—');
  });

  it('deshabilita con DELETE y actualiza la fila sin recargar', () => {
    const fixture = montar();

    const boton = filaDe(fixture, 'anamoreno').querySelector('button') as HTMLButtonElement;
    expect(boton.textContent).toContain('Deshabilitar');
    boton.click();

    const pedido = http.expectOne(`${URL_USUARIOS}/${ANA.id}`);
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush({ id: ANA.id, activo: false, fechaBaja: '2026-11-11T10:00:00.000Z' });
    fixture.detectChanges();

    expect(filaDe(fixture, 'anamoreno').textContent).toContain('Deshabilitada');
    expect(html(fixture).textContent).toContain('Se deshabilitó la cuenta de @anamoreno');
  });

  it('habilita con PATCH /usuarios/:id/estado', () => {
    const fixture = montar();

    const boton = filaDe(fixture, 'betoperez').querySelector('button') as HTMLButtonElement;
    expect(boton.textContent).toContain('Habilitar');
    boton.click();

    const pedido = http.expectOne(`${URL_USUARIOS}/${BETO.id}/estado`);
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ activo: true });
    pedido.flush({ id: BETO.id, activo: true, fechaBaja: null });
    fixture.detectChanges();

    expect(filaDe(fixture, 'betoperez').textContent).toContain('Habilitada');
    expect(html(fixture).textContent).toContain('Se habilitó la cuenta de @betoperez');
  });

  it('no ofrece deshabilitarse a sí mismo', () => {
    const fixture = montar({ ...LISTADO, total: 1, usuarios: [ADMIN] });

    const fila = filaDe(fixture, 'adaadmin');
    expect(fila.textContent).toContain('Tu cuenta');
    expect(fila.querySelector('button')).toBeNull();
  });

  it('busca por texto al enviar el formulario de filtros', () => {
    const fixture = montar();

    const input = html(fixture).querySelector('#busqueda') as HTMLInputElement;
    input.value = ' ana ';
    input.dispatchEvent(new Event('input'));
    html(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_USUARIOS);
    // El servicio recorta la búsqueda antes de mandarla.
    expect(pedido.request.params.get('busqueda')).toBe('ana');
    pedido.flush({ ...LISTADO, total: 0, usuarios: [] });
    fixture.detectChanges();

    expect(html(fixture).textContent).toContain('No hay usuarios que coincidan');
  });

  it('muestra el estado vacío cuando no hay usuarios', () => {
    const fixture = montar({ ...LISTADO, total: 0, usuarios: [] });

    expect(html(fixture).textContent).toContain('Todavía no hay usuarios cargados');
  });

  it('muestra el mensaje del backend si el listado falla', () => {
    const fixture = TestBed.createComponent(Usuarios);
    fixture.detectChanges();

    http
      .expectOne((req) => req.url === URL_USUARIOS)
      .flush(
        { statusCode: 403, message: 'Sólo un administrador puede realizar esta acción' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(html(fixture).textContent).toContain('Sólo un administrador puede realizar esta acción');
  });
});
