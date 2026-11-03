import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Sin provideHttpClient el injector no puede resolver HttpClient y la app
    // explota al abrir la pantalla de login. `withFetch` usa la Fetch API y
    // `withInterceptors` engancha el Bearer del JWT (las rutas del feed lo exigen).
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
