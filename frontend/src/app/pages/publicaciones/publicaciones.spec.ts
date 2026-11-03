import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import type { Publicacion } from '../../core/models/publicacion.model';
import { CLAVE_SESION } from '../../core/services/auth.service';
import { Publicaciones } from './publicaciones';

const URL_PUBLICACIONES = `${environment.apiUrl}/publicaciones`;
const ID_AUTOR = '507f1f77bcf86cd799439011';

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

/** Publicación armada como la devuelve el backend (autor populado). */
function publicacion(id: string, extra: Partial<Publicacion> = {}): Publicacion {
  return {
    id,
    titulo: `Publicación ${id}`,
    descripcion: 'Un tordo en el jardín',
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

describe('Publicaciones', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(SESION));

    await TestBed.configureTestingModule({
      imports: [Publicaciones],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** Monta la página y responde el primer GET del feed. */
  async function montar(
    publicaciones: Publicacion[] = [publicacion('p1')],
    total = publicaciones.length,
  ): Promise<ComponentFixture<Publicaciones>> {
    const fixture = TestBed.createComponent(Publicaciones);
    fixture.detectChanges(); // ngOnInit → GET /publicaciones

    const pedido = http.expectOne((req) => req.url === URL_PUBLICACIONES);
    pedido.flush({
      total,
      offset: 0,
      limit: 6,
      orden: 'fecha',
      hayMas: total > publicaciones.length,
      publicaciones,
    });

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: ComponentFixture<Publicaciones>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function buscarBoton(fixture: ComponentFixture<Publicaciones>, etiqueta: string): HTMLButtonElement {
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const boton = botones.find((candidato) => candidato.textContent?.includes(etiqueta));
    if (!boton) {
      throw new Error(`No se encontró el botón "${etiqueta}"`);
    }
    return boton;
  }

  it('pide la primera página y muestra las publicaciones', async () => {
    const fixture = await montar([publicacion('p1'), publicacion('p2')], 2);

    expect(texto(fixture)).toContain('Publicación p1');
    expect(texto(fixture)).toContain('Publicación p2');
    expect(texto(fixture)).toContain('2 publicaciones');
    expect(texto(fixture)).toContain('No hay más publicaciones');
  });

  it('muestra el estado vacío cuando no hay publicaciones', async () => {
    const fixture = await montar([], 0);

    expect(texto(fixture)).toContain('Todavía no hay publicaciones');
  });

  it('pide la página siguiente con offset igual a lo ya mostrado', async () => {
    const primeras = Array.from({ length: 6 }, (_, indice) => publicacion(`p${indice + 1}`));
    const fixture = await montar(primeras, 8);
    const compilado = fixture.nativeElement as HTMLElement;

    const cargarMas = compilado.querySelector(
      'button.boton--secundario.boton--bloque',
    ) as HTMLButtonElement;
    expect(cargarMas.textContent).toContain('Cargar más');

    cargarMas.click();
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_PUBLICACIONES);
    expect(pedido.request.params.get('offset')).toBe('6');
    expect(pedido.request.params.get('limit')).toBe('6');

    pedido.flush({
      total: 8,
      offset: 6,
      limit: 6,
      orden: 'fecha',
      hayMas: false,
      publicaciones: [publicacion('p7'), publicacion('p8')],
    });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Publicación p8');
    expect(texto(fixture)).toContain('No hay más publicaciones');
  });

  it('vuelve a pedir el feed al cambiar el orden', async () => {
    const fixture = await montar([publicacion('p1')]);

    buscarBoton(fixture, 'Más gustadas').click();
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_PUBLICACIONES);
    expect(pedido.request.params.get('orden')).toBe('likes');
    expect(pedido.request.params.get('offset')).toBe('0');

    pedido.flush({
      total: 0,
      offset: 0,
      limit: 6,
      orden: 'likes',
      hayMas: false,
      publicaciones: [],
    });

    await fixture.whenStable();
    expect(texto(fixture)).toContain('Todavía no hay publicaciones');
  });

  it('da me gusta de forma optimista y confirma con la respuesta del backend', async () => {
    const fixture = await montar([publicacion('p1', { cantidadLikes: 2 })]);
    const compilado = fixture.nativeElement as HTMLElement;

    const boton = compilado.querySelector('.me-gusta') as HTMLButtonElement;
    expect(boton.textContent).toContain('2');

    boton.click();
    fixture.detectChanges();

    // Optimista: la tarjeta ya muestra 3 y el corazón lleno, sin esperar al backend.
    const optimista = compilado.querySelector('.me-gusta') as HTMLButtonElement;
    expect(optimista.textContent).toContain('3');
    expect(optimista.classList.contains('me-gusta--activo')).toBe(true);
    expect(optimista.getAttribute('aria-pressed')).toBe('true');

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/p1/like`);
    expect(pedido.request.method).toBe('POST');

    pedido.flush(
      { id: 'p1', cantidadLikes: 3, likeado: true },
      { status: 201, statusText: 'Created' },
    );

    await fixture.whenStable();
    expect((compilado.querySelector('.me-gusta') as HTMLButtonElement).textContent).toContain('3');
  });

  it('revierte el me gusta si el backend falla', async () => {
    const fixture = await montar([publicacion('p1', { cantidadLikes: 5 })]);
    const compilado = fixture.nativeElement as HTMLElement;

    (compilado.querySelector('.me-gusta') as HTMLButtonElement).click();
    fixture.detectChanges();

    http
      .expectOne(`${URL_PUBLICACIONES}/p1/like`)
      .flush(
        { statusCode: 500, message: 'No se pudo guardar el me gusta' },
        { status: 500, statusText: 'Server Error' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    const boton = compilado.querySelector('.me-gusta') as HTMLButtonElement;
    expect(boton.textContent).toContain('5');
    expect(boton.classList.contains('me-gusta--activo')).toBe(false);
    expect(texto(fixture)).toContain('No se pudo guardar el me gusta');
  });

  it('borra en dos pasos y saca la tarjeta de la lista', async () => {
    const fixture = await montar([publicacion('p1'), publicacion('p2')], 2);
    const compilado = fixture.nativeElement as HTMLElement;

    (compilado.querySelector('.enlace-eliminar') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Primero pregunta: todavía no se borró nada.
    expect(texto(fixture)).toContain('¿Eliminar?');
    http.expectNone(`${URL_PUBLICACIONES}/p1`);

    buscarBoton(fixture, 'Sí, borrar').click();
    fixture.detectChanges();

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/p1`);
    expect(pedido.request.method).toBe('DELETE');

    pedido.flush({ id: 'p1', eliminado: true });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).not.toContain('Publicación p1');
    expect(texto(fixture)).toContain('Publicación p2');
    expect(texto(fixture)).toContain('Publicación eliminada.');
  });
});
