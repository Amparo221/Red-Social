import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import type { EstadisticasResponse } from '../../../core/models/estadisticas.model';
import { rangoDePreset } from '../../../core/models/estadisticas.model';
import { Estadisticas } from './estadisticas';
import { GraficoBarras } from './grafico-barras/grafico-barras';
import { GraficoLineas } from './grafico-lineas/grafico-lineas';
import { GraficoTorta } from './grafico-torta/grafico-torta';

const URL_ESTADISTICAS = `${environment.apiUrl}/estadisticas`;

const RESPUESTA: EstadisticasResponse = {
  rango: {
    desde: '2026-10-13T03:00:00.000Z',
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
  publicacionesPorUsuario: [
    { usuarioId: 'u-1', nombre: 'Ana Moreno', nombreUsuario: 'anamoreno', total: 3 },
    { usuarioId: 'u-2', nombre: 'Beto Pérez', nombreUsuario: 'betoperez', total: 2 },
  ],
  comentariosPorPeriodo: [
    {
      clave: '2026-11-01',
      etiqueta: '1 nov',
      desde: '2026-11-01T03:00:00.000Z',
      hasta: '2026-11-02T02:59:59.999Z',
      total: 0,
    },
    {
      clave: '2026-11-02',
      etiqueta: '2 nov',
      desde: '2026-11-02T03:00:00.000Z',
      hasta: '2026-11-03T02:59:59.999Z',
      total: 4,
    },
  ],
  comentariosPorPublicacion: [
    {
      publicacionId: 'p-1',
      titulo: 'Colibrí garganta rubí',
      autor: 'anamoreno',
      eliminada: false,
      total: 4,
    },
  ],
};

const html = (fixture: ComponentFixture<Estadisticas>) =>
  fixture.nativeElement as HTMLElement;

const boton = (fixture: ComponentFixture<Estadisticas>, texto: string) =>
  Array.from(html(fixture).querySelectorAll('button')).find(
    (elemento) => elemento.textContent?.trim() === texto,
  ) as HTMLButtonElement;

describe('Estadísticas (dashboard)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Estadisticas],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    // jsdom no implementa `getContext('2d')`: en vez de dibujar, los hijos
    // muestran cuántas filas recibieron. La config de Chart.js se testea en
    // core/utils/grafico.util.spec.ts.
    TestBed.overrideComponent(GraficoTorta, {
      set: { template: '<p class="stub">torta {{ filas().length }}</p>' },
    });
    TestBed.overrideComponent(GraficoLineas, {
      set: { template: '<p class="stub">lineas {{ serie().length }}</p>' },
    });
    TestBed.overrideComponent(GraficoBarras, {
      set: { template: '<p class="stub">barras {{ filas().length }}</p>' },
    });

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Crea la pantalla y responde el pedido inicial (30 días por defecto). */
  const montar = (respuesta: EstadisticasResponse = RESPUESTA) => {
    const fixture = TestBed.createComponent(Estadisticas);
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_ESTADISTICAS);
    pedido.flush(respuesta);
    fixture.detectChanges();

    return fixture;
  };

  it('pide los últimos 30 días al entrar y muestra totales y gráficos', () => {
    const fixture = TestBed.createComponent(Estadisticas);
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_ESTADISTICAS);
    const rango = rangoDePreset('30d');
    expect(pedido.request.params.get('desde')).toBe(rango?.desde);
    expect(pedido.request.params.get('hasta')).toBe(rango?.hasta);
    expect(pedido.request.params.get('agrupacion')).toBe('dia');
    expect(pedido.request.params.get('limite')).toBe('10');

    pedido.flush(RESPUESTA);
    fixture.detectChanges();

    const totales = Array.from(
      html(fixture).querySelectorAll('.resumen__valor'),
    ).map((elemento) => elemento.textContent?.trim());
    expect(totales).toEqual(['5', '4']);

    const texto = html(fixture).textContent ?? '';
    expect(texto).toContain('torta 2');
    expect(texto).toContain('lineas 2');
    expect(texto).toContain('barras 1');
  });

  it('el preset de 7 días recalcula el rango y la granularidad', () => {
    const fixture = montar();

    boton(fixture, '7 días').click();
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_ESTADISTICAS);
    const rango = rangoDePreset('7d');
    expect(pedido.request.params.get('desde')).toBe(rango?.desde);
    expect(pedido.request.params.get('agrupacion')).toBe('dia');
    pedido.flush(RESPUESTA);
    fixture.detectChanges();

    // El botón queda marcado para lectores de pantalla.
    expect(boton(fixture, '7 días').getAttribute('aria-pressed')).toBe('true');
  });

  it('cambia la granularidad de los comentarios', () => {
    const fixture = montar();

    const selector = html(fixture).querySelector('#agrupacion') as HTMLSelectElement;
    selector.value = 'mes';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const pedido = http.expectOne((req) => req.url === URL_ESTADISTICAS);
    expect(pedido.request.params.get('agrupacion')).toBe('mes');
    pedido.flush(RESPUESTA);
    fixture.detectChanges();

    expect(html(fixture).textContent).toContain('Comentarios por mes');
  });

  it('muestra el estado vacío de cada gráfico', () => {
    const fixture = montar({
      ...RESPUESTA,
      totales: {
        publicaciones: 0,
        usuariosConPublicaciones: 0,
        comentarios: 0,
        publicacionesConComentarios: 0,
      },
      publicacionesPorUsuario: [],
      comentariosPorPeriodo: [
        {
          clave: '2026-11-01',
          etiqueta: '1 nov',
          desde: '2026-11-01T03:00:00.000Z',
          hasta: '2026-11-02T02:59:59.999Z',
          total: 0,
        },
      ],
      comentariosPorPublicacion: [],
    });

    const texto = html(fixture).textContent ?? '';
    expect(texto).toContain('Nadie publicó en este período');
    expect(texto).toContain('No hubo comentarios en este período');
    expect(texto).toContain('Todavía no hay publicaciones con comentarios');
    expect(texto).not.toContain('torta');
  });

  it('no pide nada si "hasta" es anterior a "desde"', () => {
    const fixture = montar();

    const desde = html(fixture).querySelector('#desde') as HTMLInputElement;
    desde.value = '2027-01-01';
    desde.dispatchEvent(new Event('change'));
    html(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    // No hay pedido pendiente: afterEach lo verificaría con http.verify().
    expect(http.match((req) => req.url === URL_ESTADISTICAS)).toHaveLength(0);
    expect(html(fixture).textContent).toContain(
      'La fecha "Hasta" no puede ser anterior a "Desde"',
    );
  });

  it('descarta la respuesta del rango anterior si llega tarde', () => {
    const fixture = TestBed.createComponent(Estadisticas);
    fixture.detectChanges();
    const primero = http.expectOne((req) => req.url === URL_ESTADISTICAS);

    boton(fixture, '90 días').click();
    fixture.detectChanges();
    const segundo = http.expectOne((req) => req.url === URL_ESTADISTICAS);

    // Llega primero el pedido nuevo y después el viejo: gana el nuevo.
    segundo.flush({ ...RESPUESTA, totales: { ...RESPUESTA.totales, publicaciones: 9 } });
    primero.flush(RESPUESTA);
    fixture.detectChanges();

    const totales = Array.from(
      html(fixture).querySelectorAll('.resumen__valor'),
    ).map((elemento) => elemento.textContent?.trim());
    expect(totales).toEqual(['9', '4']);
  });

  it('muestra el mensaje del backend si la consulta falla', () => {
    const fixture = TestBed.createComponent(Estadisticas);
    fixture.detectChanges();

    http
      .expectOne((req) => req.url === URL_ESTADISTICAS)
      .flush(
        { statusCode: 403, message: 'Sólo un administrador puede realizar esta acción' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(html(fixture).textContent).toContain(
      'Sólo un administrador puede realizar esta acción',
    );
    expect(html(fixture).textContent).toContain('Reintentar');
  });
});
