import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
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
import { provideCharts } from 'ng2-charts';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';

/**
 * Sólo lo que dibuja el dashboard de estadísticas (Sprint 5). Con
 * `withDefaultRegisterables()` se empaquetan también radar, burbujas y escalas
 * que la app no usa, y el bundle inicial se pasaba del budget de 500 kB.
 *
 * - controllers: doughnut (torta), line (serie) y bar (ranking),
 * - elements: arco, barra, línea y punto,
 * - scales: categorías (eje X) y lineal (eje Y),
 * - plugins: relleno del área bajo la línea, leyenda y tooltips.
 */
const GRAFICOS_USADOS: ChartComponentLike[] = [
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Sin provideHttpClient el injector no puede resolver HttpClient y la app
    // explota al abrir la pantalla de login. `withFetch` usa la Fetch API y
    // `withInterceptors` engancha el Bearer del JWT (las rutas del feed lo exigen).
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Chart.js necesita registrar controladores/escalas antes de crear el
    // primer gráfico. Se registran una sola vez, acá.
    provideCharts({ registerables: GRAFICOS_USADOS }),
  ],
};
