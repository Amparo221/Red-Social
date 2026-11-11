import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import type {
  Comentario,
  ListadoComentarios,
  Publicacion,
} from '../../core/models/publicacion.model';
import { CLAVE_SESION } from '../../core/services/auth.service';
import { Publicacion as PaginaPublicacion } from './publicacion';

const URL_PUBLICACION = (id: string) => `${environment.apiUrl}/publicaciones/${id}`;
const ID_AUTOR = '507f1f77bcf86cd799439011';

/** Ruta falsa: el `:id` del detalle se cambia desde cada test. */
const rutaFalsa = { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } };
const routerFalso = { navigate: vi.fn().mockResolvedValue(true) };

const SESION = {
  id: ID_AUTOR,
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

function unaPublicacion(id: string, extra: Partial<Publicacion> = {}): Publicacion {
  return {
    id,
    titulo: 'Tordo músico',
    descripcion: 'Cantando en el jardín',
    nombreComun: 'Tordo músico',
    nombreCientifico: 'Agelaioides badius',
    imagenUrl: '',
    usuario: {
      id: ID_AUTOR,
      nombre: 'Ana',
      apellido: 'Moreno',
      nombreUsuario: 'anamoreno',
      imagenPerfilUrl: '',
    },
    cantidadLikes: 0,
    likeado: false,
    eliminado: false,
    createdAt: '2026-10-30T12:00:00.000Z',
    ...extra,
  };
}

const URL_COMENTARIOS = (publicacionId: string) =>
  `${URL_PUBLICACION(publicacionId)}/comentarios`;

function unComentario(id: string, extra: Partial<Comentario> = {}): Comentario {
  return {
    id,
    texto: '¡Qué lindo avistaje!',
    autor: {
      id: ID_AUTOR,
      nombre: 'Ana',
      apellido: 'Moreno',
      nombreUsuario: 'anamoreno',
      imagenPerfilUrl: '',
    },
    eliminado: false,
    createdAt: '2026-10-30T12:05:00.000Z',
    ...extra,
  };
}

/** Lo que devuelve GET .../comentarios?offset=0&limit=3 (Sprint 4). */
function unListado(comentarios: Comentario[] = []): ListadoComentarios {
  return {
    total: comentarios.length,
    offset: 0,
    limit: 3,
    hayMas: false,
    comentarios,
  };
}

describe('Publicacion (detalle)', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(SESION));
    rutaFalsa.snapshot.paramMap = convertToParamMap({ id: 'p1' });
    routerFalso.navigate.mockClear();

    await TestBed.configureTestingModule({
      imports: [PaginaPublicacion],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: rutaFalsa },
        { provide: Router, useValue: routerFalso },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** Responde el GET del detalle y el de la primera página de comentarios. */
  function responderPedidos(
    fixture: ComponentFixture<PaginaPublicacion>,
    publicacion: Publicacion,
    comentarios: Comentario[] = [],
  ): void {
    const pedido = http.expectOne(URL_PUBLICACION(publicacion.id));
    expect(pedido.request.method).toBe('GET');
    pedido.flush(publicacion);

    // Con la publicación en pantalla recién ahí existe <app-comentarios>, que es
    // quien pide su primera página en ngOnInit.
    fixture.detectChanges();

    const pedidoComentarios = http.expectOne(
      (req) => req.url === URL_COMENTARIOS(publicacion.id),
    );
    expect(pedidoComentarios.request.method).toBe('GET');
    expect(pedidoComentarios.request.params.get('offset')).toBe('0');
    expect(pedidoComentarios.request.params.get('limit')).toBe('3');
    pedidoComentarios.flush(unListado(comentarios));
  }

  /** Monta la página y responde el detalle más los comentarios. */
  async function montar(
    publicacion: Publicacion = unaPublicacion('p1'),
    comentarios: Comentario[] = [],
  ): Promise<ComponentFixture<PaginaPublicacion>> {
    const fixture = TestBed.createComponent(PaginaPublicacion);
    fixture.detectChanges(); // ngOnInit → detalle + comentarios

    responderPedidos(fixture, publicacion, comentarios);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function html(fixture: ComponentFixture<PaginaPublicacion>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<PaginaPublicacion>): string {
    return html(fixture).textContent ?? '';
  }

  it('carga la publicación por su ID y muestra sus datos', async () => {
    const fixture = await montar(unaPublicacion('p1', { cantidadLikes: 3 }));

    expect(texto(fixture)).toContain('Tordo músico');
    expect(texto(fixture)).toContain('Cantando en el jardín');
    expect(texto(fixture)).toContain('Agelaioides badius');
    expect((html(fixture).querySelector('.me-gusta__contador') as HTMLElement).textContent).toBe('3');
  });

  it('muestra el nombre del autor y su nombre de usuario', async () => {
    const fixture = await montar();

    expect(texto(fixture)).toContain('Ana Moreno');
    expect(texto(fixture)).toContain('@anamoreno');
  });

  it('da me gusta de forma optimista y confirma con la respuesta del backend', async () => {
    const fixture = await montar(unaPublicacion('p1', { cantidadLikes: 2 }));

    const boton = html(fixture).querySelector('.me-gusta') as HTMLButtonElement;
    expect(boton.textContent).toContain('2');

    boton.click();
    fixture.detectChanges();

    const optimista = html(fixture).querySelector('.me-gusta') as HTMLButtonElement;
    expect(optimista.textContent).toContain('3');
    expect(optimista.classList.contains('me-gusta--activo')).toBe(true);

    const pedido = http.expectOne(`${URL_PUBLICACION('p1')}/like`);
    expect(pedido.request.method).toBe('POST');
    pedido.flush({ id: 'p1', cantidadLikes: 3, likeado: true }, { status: 201, statusText: 'Created' });

    await fixture.whenStable();
    fixture.detectChanges();

    const confirmado = html(fixture).querySelector('.me-gusta') as HTMLButtonElement;
    expect(confirmado.textContent).toContain('3');
    expect(confirmado.classList.contains('me-gusta--activo')).toBe(true);
  });

  it('borra en dos pasos y vuelve al feed', async () => {
    const fixture = await montar();

    (html(fixture).querySelector('.publicacion__cabecera .enlace-eliminar') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('¿Eliminar esta publicación?');
    http.expectNone((pedido) => pedido.method === 'DELETE');

    const confirmar = html(fixture).querySelector('.boton--peligro') as HTMLButtonElement;
    confirmar.click();
    fixture.detectChanges();

    const pedido = http.expectOne(URL_PUBLICACION('p1'));
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush({ id: 'p1', eliminado: true });

    await fixture.whenStable();

    expect(routerFalso.navigate).toHaveBeenCalledWith(['/publicaciones']);
  });

  it('no borra si se cancela la confirmación', async () => {
    const fixture = await montar();

    (html(fixture).querySelector('.publicacion__cabecera .enlace-eliminar') as HTMLButtonElement).click();
    fixture.detectChanges();

    const cancelar = Array.from(
      html(fixture).querySelectorAll<HTMLButtonElement>('.publicacion__confirmacion .boton--secundario'),
    )[0];
    cancelar.click();
    fixture.detectChanges();

    expect(texto(fixture)).not.toContain('¿Eliminar esta publicación?');
    http.expectNone((pedido) => pedido.method === 'DELETE');
  });

  it('delega los comentarios en el componente compartido', async () => {
    const fixture = await montar(unaPublicacion('p1'), [unComentario('c1')]);

    // La lista, la paginación y la edición viven en <app-comentarios>: acá sólo
    // se comprueba que el detalle lo monta y que le pasa la publicación.
    const comentarios = html(fixture).querySelector('app-comentarios');
    expect(comentarios).not.toBeNull();
    expect(texto(fixture)).toContain('¡Qué lindo avistaje!');
    expect(texto(fixture)).toContain('Comentarios');
  });

  it('muestra el mensaje del backend cuando la publicación no existe', async () => {
    rutaFalsa.snapshot.paramMap = convertToParamMap({ id: 'inexistente' });

    const fixture = TestBed.createComponent(PaginaPublicacion);
    fixture.detectChanges();

    const pedido = http.expectOne(URL_PUBLICACION('inexistente'));
    expect(pedido.request.method).toBe('GET');
    pedido.flush(
      { statusCode: 404, message: 'La publicación no existe o fue eliminada' },
      { status: 404, statusText: 'Not Found' },
    );

    // Los comentarios se piden sólo cuando la publicación se mostró; si el hijo
    // llegara a pedirlos, el backend responde 404 igual.
    http
      .match((req) => req.url === URL_COMENTARIOS('inexistente'))
      .forEach((pedidoComentarios) =>
        pedidoComentarios.flush(
          { statusCode: 404, message: 'La publicación no existe' },
          { status: 404, statusText: 'Not Found' },
        ),
      );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('La publicación no existe o fue eliminada');
  });
});
