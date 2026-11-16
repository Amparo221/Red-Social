import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartComponentLike,
} from 'chart.js';

/**
 * Sólo lo que dibuja el dashboard de estadísticas (Sprint 5).
 *
 * Con `withDefaultRegisterables()` se empaquetan también radar, burbujas y
 * escalas que la app no usa, y el bundle inicial se pasaba del budget de 500 kB.
 *
 * - controllers: doughnut (torta), line (serie) y bar (ranking),
 * - elements: arco, barra, línea y punto,
 * - scales: categorías (eje X) y lineal (eje Y),
 * - plugins: relleno del área bajo la línea, leyenda y tooltips.
 *
 * Sprint 6: la lista se registra en el propio componente `Estadisticas` (no en
 * `app.config.ts`), así Chart.js queda en el chunk diferido del dashboard y no
 * en el bundle inicial que descarga cualquiera que abre el feed.
 */
export const GRAFICOS_USADOS: ChartComponentLike[] = [
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  DoughnutController,
  LineController,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
];
