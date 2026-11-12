import type { ChartConfiguration } from 'chart.js';
import type {
  ComentariosPorPeriodo,
  ComentariosPorPublicacion,
  PublicacionesPorUsuario,
} from '../models/estadisticas.model';

/**
 * Configuración de los tres gráficos (Chart.js 4 vía ng2-charts).
 *
 * Todo esto es puro: recibe las filas del backend y devuelve el objeto
 * `ChartConfiguration`. Así los tests pueden verificar la forma de los datos sin
 * canvas (jsdom no implementa `getContext('2d')`).
 */

/**
 * La paleta de `styles.css`. Chart.js pinta sobre `<canvas>`, donde `var(--…)`
 * no existe: los colores tienen que ir como literales.
 */
export const PALETA_GRAFICOS = [
  '#0ea5e9', // cielo-500
  '#22c55e', // verde-500
  '#0369a1', // cielo-700
  '#7dd3fc', // cielo-300
  '#15803d', // verde-700
  '#38bdf8', // cielo-400
  '#0284c7', // cielo-600
  '#86efac', // verde claro
  '#0c4a6e', // marino-900
  '#bae6fd', // cielo-200
];

const COLOR_TEXTO = '#155e75';
const COLOR_REJILLA = 'rgba(186, 230, 253, 0.7)';
const COLOR_LINEA = '#0ea5e9';
const COLOR_RELLENO = 'rgba(14, 165, 233, 0.18)';

/** Porcentaje redondeado de `valor` sobre `total` (0 si no hay datos). */
export function porcentaje(valor: number, total: number): number {
  return total > 0 ? Math.round((valor / total) * 100) : 0;
}

/** Color de la rebanada `indice`, ciclando la paleta. */
export function colorDeRebanada(indice: number): string {
  return PALETA_GRAFICOS[indice % PALETA_GRAFICOS.length];
}

/**
 * Líneas: comentarios en el tiempo.
 *
 * La serie llega cero-rellenada desde el backend, así que la línea nunca
 * "saltea" un día sin actividad.
 */
export function configuracionLinea(
  serie: readonly ComentariosPorPeriodo[],
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: serie.map((punto) => punto.etiqueta),
      datasets: [
        {
          label: 'Comentarios',
          data: serie.map((punto) => punto.total),
          borderColor: COLOR_LINEA,
          backgroundColor: COLOR_RELLENO,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: COLOR_LINEA,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (contexto) => {
              const valor = contexto.parsed.y;
              return `${valor} ${valor === 1 ? 'comentario' : 'comentarios'}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: COLOR_TEXTO, maxRotation: 0, autoSkip: true },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          // Con comentarios no hay medias unidades.
          ticks: { color: COLOR_TEXTO, precision: 0 },
          grid: { color: COLOR_REJILLA },
        },
      },
    },
  };
}

/**
 * Barras horizontales: comentarios por publicación.
 *
 * Horizontales porque los títulos son largos: en vertical se pisarían entre sí.
 */
export function configuracionBarras(
  filas: readonly ComentariosPorPublicacion[],
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: filas.map((fila) => (fila.eliminada ? `${fila.titulo} (baja)` : fila.titulo)),
      datasets: [
        {
          label: 'Comentarios',
          data: filas.map((fila) => fila.total),
          backgroundColor: filas.map((_, indice) => colorDeRebanada(indice)),
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const indice = items[0]?.dataIndex ?? 0;
              const fila = filas[indice];
              return fila ? `${fila.titulo} · @${fila.autor}` : '';
            },
            label: (contexto) => {
              const valor = contexto.parsed.x;
              return `${valor} ${valor === 1 ? 'comentario' : 'comentarios'}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: COLOR_TEXTO, precision: 0 },
          grid: { color: COLOR_REJILLA },
        },
        y: {
          ticks: {
            color: COLOR_TEXTO,
            autoSkip: false,
            callback: (valor) => {
              const etiqueta = String(valor);
              return etiqueta.length > 26 ? `${etiqueta.slice(0, 25)}…` : etiqueta;
            },
          },
          grid: { display: false },
        },
      },
    },
  };
}

/**
 * Torta: publicaciones por usuario.
 *
 * Se usa cuando importa la proporción de cada autor sobre el total, que es lo
 * que no se ve en una tabla.
 */
export function configuracionTorta(
  filas: readonly PublicacionesPorUsuario[],
): ChartConfiguration<'doughnut'> {
  const total = filas.reduce((suma, fila) => suma + fila.total, 0);

  return {
    type: 'doughnut',
    data: {
      labels: filas.map((fila) => `@${fila.nombreUsuario}`),
      datasets: [
        {
          data: filas.map((fila) => fila.total),
          backgroundColor: filas.map((_, indice) => colorDeRebanada(indice)),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: COLOR_TEXTO, usePointStyle: true, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: (contexto) => {
              const valor = Number(contexto.parsed);
              const sustantivo = valor === 1 ? 'publicación' : 'publicaciones';
              return `${contexto.label}: ${valor} ${sustantivo} (${porcentaje(valor, total)}%)`;
            },
          },
        },
      },
    },
  };
}
