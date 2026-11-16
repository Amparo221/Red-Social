import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Sin provideHttpClient el injector no puede resolver HttpClient y la app
    // explota al abrir la pantalla de login. `withFetch` usa la Fetch API y
    // `withInterceptors` engancha el Bearer del JWT (las rutas del feed lo exigen).
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // PWA (Sprint 6): el service worker cachea el shell y las fotos de
    // Cloudinary para que la app abra sin conexión. En desarrollo queda apagado
    // (`environment.produccion` es false) para no servir versiones viejas
    // mientras se trabaja con `ng serve`.
    //
    // Chart.js no se registra acá: se registra en `Estadisticas`, que es una
    // ruta diferida (ver pages/dashboard/estadisticas/graficos.ts).
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.produccion,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
