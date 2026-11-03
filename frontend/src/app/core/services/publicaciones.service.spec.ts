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
});
