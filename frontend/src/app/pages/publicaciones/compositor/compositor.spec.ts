import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import type { Publicacion } from '../../../core/models/publicacion.model';
import { Compositor } from './compositor';

const URL_PUBLICACIONES = `${environment.apiUrl}/publicaciones`;

const CREADA: Publicacion = {
  id: 'p1',
  titulo: 'Tordo músico',
  descripcion: 'Cantando en el paraíso',
  nombreComun: '',
  nombreCientifico: '',
  imagenUrl: '',
  usuario: {
    id: '507f1f77bcf86cd799439011',
    nombre: 'Ana',
    apellido: 'Moreno',
    nombreUsuario: 'anamoreno',
    imagenPerfilUrl: '',
  },
  cantidadLikes: 0,
  likeado: false,
  eliminado: false,
  createdAt: '2026-10-30T12:00:00.000Z',
};

describe('Compositor', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Compositor],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Escribe en un campo como lo haría el usuario (input + event). */
  function escribir(compilado: HTMLElement, selector: string, valor: string): void {
    const campo = compilado.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function enviar(compilado: HTMLElement): void {
    const formulario = compilado.querySelector('form') as HTMLFormElement;
    formulario.dispatchEvent(new Event('submit'));
  }

  it('no llama al backend si falta el título o la descripción', () => {
    const fixture = TestBed.createComponent(Compositor);
    fixture.detectChanges();
    const compilado = fixture.nativeElement as HTMLElement;

    enviar(compilado);
    fixture.detectChanges();

    http.expectNone(URL_PUBLICACIONES);
    expect(compilado.textContent).toContain('Poné un título.');
    expect(compilado.textContent).toContain('Contá algo sobre la publicación.');
  });

  it('publica como multipart, emite la publicación y limpia el formulario', () => {
    const fixture = TestBed.createComponent(Compositor);
    fixture.detectChanges();
    const compilado = fixture.nativeElement as HTMLElement;

    let creada: Publicacion | undefined;
    fixture.componentInstance.creada.subscribe((publicacion) => (creada = publicacion));

    escribir(compilado, '#titulo-publicacion', 'Tordo músico');
    escribir(compilado, '#descripcion-publicacion', 'Cantando en el paraíso');
    enviar(compilado);
    fixture.detectChanges();

    const pedido = http.expectOne(URL_PUBLICACIONES);
    const cuerpo = pedido.request.body as FormData;

    expect(pedido.request.method).toBe('POST');
    expect(cuerpo.get('titulo')).toBe('Tordo músico');
    expect(cuerpo.get('descripcion')).toBe('Cantando en el paraíso');
    expect(cuerpo.has('imagen')).toBe(false);

    pedido.flush(CREADA, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(creada).toEqual(CREADA);
    expect((compilado.querySelector('#titulo-publicacion') as HTMLInputElement).value).toBe('');
  });

  it('muestra el mensaje del backend si la publicación falla', () => {
    const fixture = TestBed.createComponent(Compositor);
    fixture.detectChanges();
    const compilado = fixture.nativeElement as HTMLElement;

    escribir(compilado, '#titulo-publicacion', 'Tordo');
    escribir(compilado, '#descripcion-publicacion', 'Cantando');
    enviar(compilado);
    fixture.detectChanges();

    http
      .expectOne(URL_PUBLICACIONES)
      .flush(
        { statusCode: 500, message: 'No se pudo crear la publicación' },
        { status: 500, statusText: 'Server Error' },
      );

    fixture.detectChanges();

    expect(compilado.textContent).toContain('No se pudo crear la publicación');
    // No se limpió: el usuario no pierde lo que escribió.
    expect((compilado.querySelector('#titulo-publicacion') as HTMLInputElement).value).toBe('Tordo');
  });
});
