import type { TooltipItem } from 'chart.js';
import type {
  ComentariosPorPeriodo,
  ComentariosPorPublicacion,
  PublicacionesPorUsuario,
} from '../models/estadisticas.model';
import {
  PALETA_GRAFICOS,
  colorDeRebanada,
  configuracionBarras,
  configuracionLinea,
  configuracionTorta,
  porcentaje,
} from './grafico.util';

const POR_USUARIO: PublicacionesPorUsuario[] = [
  { usuarioId: 'u-1', nombre: 'Ana Moreno', nombreUsuario: 'anamoreno', total: 3 },
  { usuarioId: 'u-2', nombre: 'Beto Pérez', nombreUsuario: 'betoperez', total: 2 },
];

const SERIE: ComentariosPorPeriodo[] = [
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
];

const POR_PUBLICACION: ComentariosPorPublicacion[] = [
  {
    publicacionId: 'p-1',
    titulo: 'Colibrí garganta rubí',
    autor: 'anamoreno',
    eliminada: false,
    total: 4,
  },
  {
    publicacionId: 'p-2',
    titulo: 'Garza mora',
    autor: 'betoperez',
    eliminada: true,
    total: 1,
  },
];

describe('porcentaje', () => {
  it('redondea la proporción y no divide por cero', () => {
    expect(porcentaje(3, 5)).toBe(60);
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(0, 0)).toBe(0);
  });
});

describe('colorDeRebanada', () => {
  it('cicla la paleta cuando hay más filas que colores', () => {
    expect(colorDeRebanada(0)).toBe(PALETA_GRAFICOS[0]);
    expect(colorDeRebanada(PALETA_GRAFICOS.length)).toBe(PALETA_GRAFICOS[0]);
  });
});

describe('configuracionTorta', () => {
  it('arma una torta con un color por usuario', () => {
    const configuracion = configuracionTorta(POR_USUARIO);
    const dataset = configuracion.data.datasets[0];

    expect(configuracion.type).toBe('doughnut');
    expect(configuracion.data.labels).toEqual(['@anamoreno', '@betoperez']);
    expect(dataset.data).toEqual([3, 2]);
    expect(dataset.backgroundColor).toEqual([PALETA_GRAFICOS[0], PALETA_GRAFICOS[1]]);
  });

  it('muestra el total y el porcentaje en el tooltip', () => {
    const configuracion = configuracionTorta(POR_USUARIO);
    const etiqueta = configuracion.options?.plugins?.tooltip?.callbacks?.label;
    const contexto = { label: '@anamoreno', parsed: 3 } as unknown as TooltipItem<'doughnut'>;

    expect(typeof etiqueta).toBe('function');
    expect((etiqueta as (item: TooltipItem<'doughnut'>) => string)(contexto)).toBe(
      '@anamoreno: 3 publicaciones (60%)',
    );
  });
});

describe('configuracionLinea', () => {
  it('usa las etiquetas del backend y rellena los ceros', () => {
    const configuracion = configuracionLinea(SERIE);
    const dataset = configuracion.data.datasets[0];

    expect(configuracion.type).toBe('line');
    expect(configuracion.data.labels).toEqual(['1 nov', '2 nov']);
    expect(dataset.data).toEqual([0, 4]);
    expect(dataset.fill).toBe(true);
    // La escala arranca en 0 para que una serie con pocos comentarios no se
    // dibuje "inflada" desde el mínimo.
    const escalaY = configuracion.options?.scales?.['y'] as
      | { beginAtZero?: boolean }
      | undefined;
    expect(escalaY?.beginAtZero).toBe(true);
  });
});

describe('configuracionBarras', () => {
  it('marca las publicaciones dadas de baja y usa barras horizontales', () => {
    const configuracion = configuracionBarras(POR_PUBLICACION);
    const dataset = configuracion.data.datasets[0];

    expect(configuracion.type).toBe('bar');
    expect(configuracion.options?.indexAxis).toBe('y');
    expect(configuracion.data.labels).toEqual([
      'Colibrí garganta rubí',
      'Garza mora (baja)',
    ]);
    expect(dataset.data).toEqual([4, 1]);
  });

  it('no dibuja leyenda: el título de la tarjeta ya explica el gráfico', () => {
    const configuracion = configuracionBarras(POR_PUBLICACION);

    expect(configuracion.options?.plugins?.legend?.display).toBe(false);
  });
});
