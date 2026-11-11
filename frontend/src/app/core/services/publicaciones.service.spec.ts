import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { Publicacion } from '../models/publicacion.model';
import { PublicacionesService } from './publicaciones.service';

const URL_PUBLICACIONES = `${environment.apiUrl}/publicaciones`;
const ID = '64b7f0c2a1b2c3d4e5f60718';
const ID_AUTOR = '507f1f77bcf86cd799439011';

const PUBLICACION: Publicacion = {
  id: ID,
  titulo: 'Tordo músico',
  descripcion: 'Cantando en el paraíso',
  nombreComun: 'Tordo músico',
  nombreCientifico: 'Agelaioides badius',
  imagenUrl: 'https://res.cloudinary.com/demo/red-social/publicaciones/tordo.jpg',
  usuario: {
    id: ID_AUTOR,
    nombre: 'Ana',
    apellido: 'Moreno',
    nombreUsuario: 'anamoreno',
    imagenPerfilUrl: '',
  },
  cantidadLikes: 3,
  likeado: false,
  eliminado: false,
  createdAt: '2026-10-30T12:00:00.000Z',
  updatedAt: '2026-10-30T12:00:00.000Z',
};

describe('PublicacionesService', () => {
  let servicio: PublicacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(PublicacionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el feed con los defaults del backend (offset 0, limit 6, orden fecha)', () => {
    let total = -1;
    servicio.listar().subscribe((listado) => (total = listado.total));

    const pedido = http.expectOne((req) => req.url === URL_PUBLICACIONES);
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.params.get('offset')).toBe('0');
    expect(pedido.request.params.get('limit')).toBe('6');
    expect(pedido.request.params.get('orden')).toBe('fecha');
    // Sin filtro por autor el parámetro no debe viajar (el DTO lo trata como opcional).
    expect(pedido.request.params.has('usuario')).toBe(false);

    pedido.flush({
      total: 1,
      offset: 0,
      limit: 6,
      orden: 'fecha',
      hayMas: false,
      publicaciones: [PUBLICACION],
    });

    expect(total).toBe(1);
  });

  it('manda offset, limit, orden y el filtro por autor', () => {
    servicio.listar({ offset: 6, limit: 3, orden: 'likes', usuario: ID_AUTOR }).subscribe();

    const pedido = http.expectOne((req) => req.url === URL_PUBLICACIONES);
    expect(pedido.request.params.get('offset')).toBe('6');
    expect(pedido.request.params.get('limit')).toBe('3');
    expect(pedido.request.params.get('orden')).toBe('likes');
    expect(pedido.request.params.get('usuario')).toBe(ID_AUTOR);

    pedido.flush({ total: 0, offset: 6, limit: 3, orden: 'likes', hayMas: false, publicaciones: [] });
  });

  it('crea como multipart con la foto elegida', () => {
    const foto = new File(['foto'], 'tordo.png', { type: 'image/png' });

    servicio
      .crear(
        {
          titulo: '  Tordo músico ',
          descripcion: ' Cantando en el paraíso ',
          nombreComun: ' Tordo músico ',
          nombreCientifico: ' Agelaioides badius ',
        },
        foto,
      )
      .subscribe();

    const pedido = http.expectOne(URL_PUBLICACIONES);
    const cuerpo = pedido.request.body as FormData;

    expect(pedido.request.method).toBe('POST');
    expect(cuerpo instanceof FormData).toBe(true);
    expect(cuerpo.get('titulo')).toBe('Tordo músico');
    expect(cuerpo.get('descripcion')).toBe('Cantando en el paraíso');
    expect(cuerpo.get('nombreComun')).toBe('Tordo músico');
    expect(cuerpo.get('nombreCientifico')).toBe('Agelaioides badius');
    expect(cuerpo.get('imagen')).toBe(foto);

    pedido.flush(PUBLICACION);
  });

  it('no manda nombreComun, nombreCientifico ni imagen cuando quedaron vacíos', () => {
    servicio.crear({ titulo: 'Sin foto', descripcion: 'Sólo texto', nombreComun: '  ' }).subscribe();

    const pedido = http.expectOne(URL_PUBLICACIONES);
    const cuerpo = pedido.request.body as FormData;

    expect(cuerpo.has('nombreComun')).toBe(false);
    expect(cuerpo.has('nombreCientifico')).toBe(false);
    expect(cuerpo.has('imagen')).toBe(false);

    pedido.flush(PUBLICACION);
  });

  it('da me gusta con POST /:id/like', () => {
    let likeado = false;
    servicio.darLike(ID).subscribe((resultado) => (likeado = resultado.likeado));

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/${ID}/like`);
    expect(pedido.request.method).toBe('POST');

    pedido.flush({ id: ID, cantidadLikes: 4, likeado: true }, { status: 201, statusText: 'Created' });

    expect(likeado).toBe(true);
  });

  it('quita el me gusta con DELETE /:id/like', () => {
    servicio.quitarLike(ID).subscribe();

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/${ID}/like`);
    expect(pedido.request.method).toBe('DELETE');

    pedido.flush({ id: ID, cantidadLikes: 2, likeado: false });
  });

  it('elimina con DELETE /:id (baja lógica)', () => {
    let eliminado = false;
    servicio.eliminar(ID).subscribe((resultado) => (eliminado = resultado.eliminado));

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/${ID}`);
    expect(pedido.request.method).toBe('DELETE');

    pedido.flush({ id: ID, eliminado: true });

    expect(eliminado).toBe(true);
  });

  it('pide el detalle con GET /:id', () => {
    let titulo = '';
    servicio.obtenerUno(ID).subscribe((publicacion) => (titulo = publicacion.titulo));

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/${ID}`);
    expect(pedido.request.method).toBe('GET');

    pedido.flush(PUBLICACION);

    expect(titulo).toBe('Tordo músico');
  });

  it('lista los comentarios paginados con GET /:id/comentarios', () => {
    let cantidad = -1;
    let hayMas = false;
    servicio.listarComentarios(ID).subscribe((listado) => {
      cantidad = listado.comentarios.length;
      hayMas = listado.hayMas;
    });

    // Con parámetros de query hay que matchear por URL: expectOne(string) exige
    // la URL exacta, query string incluida.
    const pedido = http.expectOne(
      (req) => req.url === `${URL_PUBLICACIONES}/${ID}/comentarios`,
    );
    expect(pedido.request.method).toBe('GET');
    // Sprint 4: la lista viene paginada, con los mismos defaults que la pantalla.
    expect(pedido.request.params.get('offset')).toBe('0');
    expect(pedido.request.params.get('limit')).toBe('3');

    pedido.flush({
      total: 4,
      offset: 0,
      limit: 3,
      hayMas: true,
      comentarios: [
        {
          id: 'c1',
          texto: '¡Qué lindo avistaje!',
          autor: {
            id: ID_AUTOR,
            nombre: 'Ana',
            apellido: 'Moreno',
            nombreUsuario: 'anamoreno',
            imagenPerfilUrl: '',
          },
          createdAt: '2026-10-30T12:05:00.000Z',
          eliminado: false,
          editado: false,
          fechaEdicion: null,
        },
      ],
    });

    expect(cantidad).toBe(1);
    expect(hayMas).toBe(true);
  });

  it('pide otra página de comentarios con offset y limit', () => {
    servicio.listarComentarios(ID, { offset: 3, limit: 3 }).subscribe();

    const pedido = http.expectOne(
      (req) => req.url === `${URL_PUBLICACIONES}/${ID}/comentarios`,
    );
    expect(pedido.request.params.get('offset')).toBe('3');
    expect(pedido.request.params.get('limit')).toBe('3');

    pedido.flush({ total: 4, offset: 3, limit: 3, hayMas: false, comentarios: [] });
  });

  it('edita un comentario con PATCH y el texto recortado', () => {
    let editado = false;
    servicio
      .editarComentario('c1', '  Texto corregido  ')
      .subscribe((comentario) => (editado = comentario.editado === true));

    const pedido = http.expectOne(`${environment.apiUrl}/comentarios/c1`);
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ texto: 'Texto corregido' });

    pedido.flush({
      id: 'c1',
      texto: 'Texto corregido',
      autor: ID_AUTOR,
      eliminado: false,
      editado: true,
      fechaEdicion: '2026-10-31T09:00:00.000Z',
    });

    expect(editado).toBe(true);
  });

  it('crea un comentario con POST y el texto recortado', () => {
    let texto = '';
    servicio.crearComentario(ID, '  Muy buena foto  ').subscribe((comentario) => (texto = comentario.texto));

    const pedido = http.expectOne(`${URL_PUBLICACIONES}/${ID}/comentarios`);
    expect(pedido.request.method).toBe('POST');
    // El DTO del backend espera `texto`, no `contenido`.
    expect(pedido.request.body).toEqual({ texto: 'Muy buena foto' });

    pedido.flush(
      { id: 'c1', texto: 'Muy buena foto', autor: ID_AUTOR, eliminado: false },
      { status: 201, statusText: 'Created' },
    );

    expect(texto).toBe('Muy buena foto');
  });

  it('elimina un comentario con DELETE /comentarios/:id (otro recurso)', () => {
    let eliminado = false;
    servicio.eliminarComentario('c1').subscribe((resultado) => (eliminado = resultado.eliminado));

    const pedido = http.expectOne(`${environment.apiUrl}/comentarios/c1`);
    expect(pedido.request.method).toBe('DELETE');

    pedido.flush({ id: 'c1', eliminado: true });

    expect(eliminado).toBe(true);
  });
});
