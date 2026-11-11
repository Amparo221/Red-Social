import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import type {
  Comentario,
  ListadoComentarios,
} from '../../../core/models/publicacion.model';
import { CLAVE_SESION } from '../../../core/services/auth.service';
import { ComentariosPublicacion } from './comentarios-publicacion';

const ID_AUTOR = '507f1f77bcf86cd799439011';
const ID_OTRO = '507f1f77bcf86cd799439022';

const URL_COMENTARIOS = (publicacionId: string) =>
  `${environment.apiUrl}/publicaciones/${publicacionId}/comentarios`;
const URL_COMENTARIO = (comentarioId: string) =>
  `${environment.apiUrl}/comentarios/${comentarioId}`;

function unaSesion(extra: Record<string, unknown> = {}) {
  return {
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
    ...extra,
  };
}

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
    editado: false,
    fechaEdicion: null,
    createdAt: '2026-10-30T12:05:00.000Z',
    ...extra,
  };
}

/** Un comentario de otra persona, para probar los permisos. */
function comentarioAjeno(id: string, extra: Partial<Comentario> = {}): Comentario {
  return unComentario(id, {
    texto: 'Hermosa foto',
    autor: {
      id: ID_OTRO,
      nombre: 'Bruno',
      apellido: 'Gómez',
      nombreUsuario: 'brunogomez',
      imagenPerfilUrl: '',
    },
    ...extra,
  });
}

/** Página tal como la devuelve el backend (`comentario-response.util`). */
function unListado(
  comentarios: Comentario[] = [],
  extra: Partial<ListadoComentarios> = {},
): ListadoComentarios {
  return {
    total: comentarios.length,
    offset: 0,
    limit: 3,
    hayMas: false,
    comentarios,
    ...extra,
  };
}

describe('ComentariosPublicacion', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion()));

    await TestBed.configureTestingModule({
      imports: [ComentariosPublicacion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** Monta el componente y responde la primera página de comentarios. */
  async function montar(
    comentarios: Comentario[] = [],
    opciones: { soloLectura?: boolean; embebido?: boolean; extra?: Partial<ListadoComentarios> } = {},
  ): Promise<ComponentFixture<ComentariosPublicacion>> {
    const fixture = TestBed.createComponent(ComentariosPublicacion);
    fixture.componentRef.setInput('idPublicacion', 'p1');
    if (opciones.soloLectura) {
      fixture.componentRef.setInput('soloLectura', true);
    }
    if (opciones.embebido) {
      fixture.componentRef.setInput('embebido', true);
    }

    fixture.detectChanges(); // ngOnInit → GET .../comentarios?offset=0&limit=3

    const pedido = http.expectOne((req) => req.url === URL_COMENTARIOS('p1'));
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.params.get('offset')).toBe('0');
    expect(pedido.request.params.get('limit')).toBe('3');
    pedido.flush(unListado(comentarios, opciones.extra));

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function html(fixture: ComponentFixture<ComentariosPublicacion>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(fixture: ComponentFixture<ComentariosPublicacion>): string {
    return html(fixture).textContent ?? '';
  }

  function botonPorTexto(
    fixture: ComponentFixture<ComentariosPublicacion>,
    etiqueta: string,
  ): HTMLButtonElement | undefined {
    return Array.from(html(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
      (boton) => boton.textContent?.trim() === etiqueta,
    );
  }

  it('pide la primera página y lista los comentarios con autor y usuario', async () => {
    const fixture = await montar([unComentario('c1'), comentarioAjeno('c2')]);

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(2);
    expect(texto(fixture)).toContain('¡Qué lindo avistaje!');
    expect(texto(fixture)).toContain('Ana Moreno');
    expect(texto(fixture)).toContain('@anamoreno');
    expect(texto(fixture)).toContain('Hermosa foto');
    // "2 de 2": el total que informa el backend.
    expect(texto(fixture)).toContain('2 de 2');
  });

  it('muestra un mensaje cuando no hay comentarios', async () => {
    const fixture = await montar();

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(0);
    expect(texto(fixture)).toContain('Todavía no hay comentarios');
  });

  it('en el detalle conserva la caja propia (sin la clase embebida)', async () => {
    const fixture = await montar([unComentario('c1')]);

    const seccion = html(fixture).querySelector('.comentarios');
    expect(seccion?.classList.contains('comentarios--embebido')).toBe(false);
  });

  it('con embebido se muestra plano, para ir dentro de la tarjeta del perfil', async () => {
    const fixture = await montar([unComentario('c1')], { soloLectura: true, embebido: true });

    const seccion = html(fixture).querySelector('.comentarios');
    expect(seccion?.classList.contains('comentarios--embebido')).toBe(true);
    // El título y los comentarios se siguen viendo: sólo cambia el recuadro.
    expect(texto(fixture)).toContain('Comentarios');
    expect(html(fixture).querySelectorAll('.comentario').length).toBe(1);
  });

  it('pide la página siguiente al cargar más y deja de ofrecerlo al final', async () => {
    const fixture = await montar(
      [unComentario('c1'), unComentario('c2'), unComentario('c3')],
      { extra: { total: 4, hayMas: true } },
    );

    const mas = html(fixture).querySelector('.comentarios__mas') as HTMLButtonElement;
    expect(mas).not.toBeNull();
    mas.click();
    fixture.detectChanges();

    const siguiente = http.expectOne((req) => req.url === URL_COMENTARIOS('p1'));
    expect(siguiente.request.params.get('offset')).toBe('3');
    expect(siguiente.request.params.get('limit')).toBe('3');
    siguiente.flush(
      unListado([unComentario('c4')], { total: 4, offset: 3, hayMas: false }),
    );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(4);
    expect(texto(fixture)).toContain('4 de 4');
    expect(html(fixture).querySelector('.comentarios__mas')).toBeNull();
  });

  it('no ofrece cargar más cuando hay una sola página', async () => {
    const fixture = await montar([unComentario('c1')]);

    expect(html(fixture).querySelector('.comentarios__mas')).toBeNull();
  });

  it('marca con "editado" los comentarios que ya se editaron', async () => {
    const fixture = await montar([
      unComentario('c1'),
      unComentario('c2', { editado: true, fechaEdicion: '2026-10-31T09:00:00.000Z' }),
    ]);

    const badges = html(fixture).querySelectorAll('.comentario__editado');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent?.trim()).toBe('editado');
  });

  it('sólo el autor ve el botón de editar', async () => {
    const fixture = await montar([unComentario('c1'), comentarioAjeno('c2')]);

    // Dos comentarios, pero sólo uno es de la sesión.
    expect(html(fixture).querySelectorAll('.comentario').length).toBe(2);
    expect(html(fixture).querySelectorAll('.enlace-accion').length).toBe(1);
  });

  it('edita con PATCH y muestra el texto nuevo con el badge', async () => {
    const fixture = await montar([unComentario('c1', { texto: 'Texto viejo' })]);

    (html(fixture).querySelector('.enlace-accion') as HTMLButtonElement).click();
    fixture.detectChanges();

    const campo = html(fixture).querySelector(
      '.comentario__edicion .comentarios__input',
    ) as HTMLTextAreaElement;
    expect(campo.value).toBe('Texto viejo');

    campo.value = '  Texto corregido  ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const guardar = botonPorTexto(fixture, 'Guardar') as HTMLButtonElement;
    expect(guardar.disabled).toBe(false);
    guardar.click();
    fixture.detectChanges();

    const pedido = http.expectOne(URL_COMENTARIO('c1'));
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ texto: 'Texto corregido' });
    pedido.flush(
      unComentario('c1', {
        texto: 'Texto corregido',
        editado: true,
        fechaEdicion: '2026-10-31T09:00:00.000Z',
      }),
    );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Texto corregido');
    expect(texto(fixture)).not.toContain('Texto viejo');
    expect(html(fixture).querySelector('.comentario__editado')).not.toBeNull();
    // El editor se cerró.
    expect(html(fixture).querySelector('.comentario__edicion')).toBeNull();
  });

  it('cancelar la edición no llama al backend y deja el texto original', async () => {
    const fixture = await montar([unComentario('c1', { texto: 'Texto viejo' })]);

    (html(fixture).querySelector('.enlace-accion') as HTMLButtonElement).click();
    fixture.detectChanges();

    const campo = html(fixture).querySelector(
      '.comentario__edicion .comentarios__input',
    ) as HTMLTextAreaElement;
    campo.value = 'Otro texto';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (botonPorTexto(fixture, 'Cancelar') as HTMLButtonElement).click();
    fixture.detectChanges();

    http.expectNone((req) => req.method === 'PATCH');
    expect(texto(fixture)).toContain('Texto viejo');
    expect(html(fixture).querySelector('.comentario__edicion')).toBeNull();
  });

  it('no envía nada si se guarda sin cambios', async () => {
    const fixture = await montar([unComentario('c1', { texto: 'Igual' })]);

    (html(fixture).querySelector('.enlace-accion') as HTMLButtonElement).click();
    fixture.detectChanges();

    (botonPorTexto(fixture, 'Guardar') as HTMLButtonElement).click();
    fixture.detectChanges();

    http.expectNone((req) => req.method === 'PATCH');
    expect(html(fixture).querySelector('.comentario__edicion')).toBeNull();
  });

  it('muestra el mensaje del backend si la edición es rechazada', async () => {
    const fixture = await montar([unComentario('c1', { texto: 'Texto viejo' })]);

    (html(fixture).querySelector('.enlace-accion') as HTMLButtonElement).click();
    fixture.detectChanges();

    const campo = html(fixture).querySelector(
      '.comentario__edicion .comentarios__input',
    ) as HTMLTextAreaElement;
    campo.value = 'Texto nuevo';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (botonPorTexto(fixture, 'Guardar') as HTMLButtonElement).click();
    fixture.detectChanges();

    http
      .expectOne(URL_COMENTARIO('c1'))
      .flush(
        { statusCode: 403, message: 'No podés editar un comentario ajeno' },
        { status: 403, statusText: 'Forbidden' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No podés editar un comentario ajeno');
    // Sigue en modo edición para no perder lo escrito.
    expect(html(fixture).querySelector('.comentario__edicion')).not.toBeNull();
  });

  it('borra el comentario con DELETE y lo saca de la lista', async () => {
    const fixture = await montar([unComentario('c1'), unComentario('c2')]);

    (html(fixture).querySelector('.comentario .enlace-eliminar') as HTMLButtonElement).click();
    fixture.detectChanges();

    const pedido = http.expectOne(URL_COMENTARIO('c1'));
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush({ id: 'c1', eliminado: true });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(1);
    expect(texto(fixture)).toContain('1 de 1');
  });

  it('un administrador puede borrar comentarios ajenos', async () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion({ perfil: 'administrador' })));

    const fixture = await montar([comentarioAjeno('c9')]);

    const eliminar = html(fixture).querySelector('.comentario .enlace-eliminar') as HTMLButtonElement;
    expect(eliminar).not.toBeNull();
    eliminar.click();
    fixture.detectChanges();

    const pedido = http.expectOne(URL_COMENTARIO('c9'));
    expect(pedido.request.method).toBe('DELETE');
    pedido.flush({ id: 'c9', eliminado: true });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(0);
  });

  it('muestra el mensaje del backend si el borrado falla', async () => {
    const fixture = await montar([unComentario('c1')]);

    (html(fixture).querySelector('.comentario .enlace-eliminar') as HTMLButtonElement).click();
    fixture.detectChanges();

    http
      .expectOne(URL_COMENTARIO('c1'))
      .flush(
        { statusCode: 403, message: 'No podés eliminar un comentario ajeno' },
        { status: 403, statusText: 'Forbidden' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No podés eliminar un comentario ajeno');
    // El comentario sigue en la lista.
    expect(html(fixture).querySelectorAll('.comentario').length).toBe(1);
  });

  it('comenta con POST, agrega el comentario y limpia el textarea', async () => {
    const fixture = await montar();

    expect(texto(fixture)).toContain('Todavía no hay comentarios');

    const campo = html(fixture).querySelector('.comentarios__input') as HTMLTextAreaElement;
    campo.value = '  Hermosa foto  ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const boton = html(fixture).querySelector('.comentarios__form .boton') as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
    boton.click();
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_COMENTARIOS('p1'));
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({ texto: 'Hermosa foto' });
    pedido.flush(unComentario('c1', { texto: 'Hermosa foto' }), {
      status: 201,
      statusText: 'Created',
    });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(1);
    expect(texto(fixture)).toContain('Hermosa foto');
    expect(
      (html(fixture).querySelector('.comentarios__input') as HTMLTextAreaElement).value,
    ).toBe('');
  });

  it('mantiene deshabilitado el botón de comentar con el texto vacío', async () => {
    const fixture = await montar();
    const boton = html(fixture).querySelector('.comentarios__form .boton') as HTMLButtonElement;

    expect(boton.disabled).toBe(true);
  });

  it('muestra el mensaje del backend si el comentario es rechazado', async () => {
    const fixture = await montar();

    const campo = html(fixture).querySelector('.comentarios__input') as HTMLTextAreaElement;
    campo.value = 'Hola';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (html(fixture).querySelector('.comentarios__form .boton') as HTMLButtonElement).click();
    fixture.detectChanges();

    http
      .expectOne((req) => req.url === URL_COMENTARIOS('p1'))
      .flush(
        { statusCode: 400, message: 'El comentario no puede estar vacío' },
        { status: 400, statusText: 'Bad Request' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('El comentario no puede estar vacío');
    expect(html(fixture).querySelectorAll('.comentario').length).toBe(0);
  });

  it('en el perfil (sólo lectura) no hay formulario ni acciones, pero sí paginación', async () => {
    const fixture = await montar([unComentario('c1'), comentarioAjeno('c2')], {
      soloLectura: true,
      extra: { total: 5, hayMas: true },
    });

    expect(html(fixture).querySelector('.comentarios__form')).toBeNull();
    expect(html(fixture).querySelector('.comentarios__input')).toBeNull();
    expect(html(fixture).querySelectorAll('.enlace-accion').length).toBe(0);
    expect(html(fixture).querySelectorAll('.enlace-eliminar').length).toBe(0);

    // La lista y la paginación sí funcionan.
    expect(html(fixture).querySelectorAll('.comentario').length).toBe(2);
    expect(html(fixture).querySelector('.comentarios__mas')).not.toBeNull();
  });

  it('avisa si no se pudieron cargar los comentarios y permite reintentar', async () => {
    const fixture = TestBed.createComponent(ComentariosPublicacion);
    fixture.componentRef.setInput('idPublicacion', 'p1');
    fixture.detectChanges();

    http
      .expectOne((req) => req.url === URL_COMENTARIOS('p1'))
      .flush(
        { statusCode: 500, message: 'No se pudieron cargar los comentarios' },
        { status: 500, statusText: 'Server Error' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No se pudieron cargar los comentarios');
    // Con el error a la vista no corresponde decir además "no hay comentarios".
    expect(texto(fixture)).not.toContain('Todavía no hay comentarios');

    const reintentar = botonPorTexto(fixture, 'Reintentar');
    expect(reintentar).toBeDefined();

    reintentar?.click();
    fixture.detectChanges();

    http
      .expectOne((req) => req.url === URL_COMENTARIOS('p1'))
      .flush(unListado([unComentario('c1')]));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(html(fixture).querySelectorAll('.comentario').length).toBe(1);
    expect(texto(fixture)).not.toContain('No se pudieron cargar los comentarios');
  });
});

