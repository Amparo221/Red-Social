import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { EstadisticasResponse } from '../models/estadisticas.model';
import { EstadisticasService } from './estadisticas.service';

const URL_ESTADISTICAS = `${environment.apiUrl}/estadisticas`;

const RESPUESTA: EstadisticasResponse = {
  rango: {
    desde: '2026-11-01T03:00:00.000Z',
    hasta: '2026-11-11T02:59:59.999Z',
    agrupacion: 'dia',
    limite: 10,
  },
  totales: {
    publicaciones: 5,
    usuariosConPublicaciones: 2,
    comentarios: 4,
    publicacionesConComentarios: 1,
  },
  publicacionesPorUsuario: [],
  comentariosPorPeriodo: [],
  comentariosPorPublicacion: [],
};

describe('EstadisticasService', () => {
  let servicio: EstadisticasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(EstadisticasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('consulta el rango con la granularidad y el límite por defecto', () => {
    let respuesta: EstadisticasResponse | undefined;

    servicio
      .consultar({
        desde: '2026-11-01',
        hasta: '2026-11-11',
        agrupacion: 'semana',
      })
      .subscribe((datos) => (respuesta = datos));

    const pedido = http.expectOne((req) => req.url === URL_ESTADISTICAS);
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.params.get('desde')).toBe('2026-11-01');
    expect(pedido.request.params.get('hasta')).toBe('2026-11-11');
    expect(pedido.request.params.get('agrupacion')).toBe('semana');
    expect(pedido.request.params.get('limite')).toBe('10');

    pedido.flush(RESPUESTA);

    expect(respuesta).toEqual(RESPUESTA);
  });

  it('respeta el límite pedido', () => {
    servicio
      .consultar({
        desde: '2026-10-01',
        hasta: '2026-11-11',
        agrupacion: 'mes',
        limite: 5,
      })
      .subscribe();

    const pedido = http.expectOne((req) => req.url === URL_ESTADISTICAS);
    expect(pedido.request.params.get('agrupacion')).toBe('mes');
    expect(pedido.request.params.get('limite')).toBe('5');

    pedido.flush(RESPUESTA);
  });
});
