import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Sin provideHttpClient el injector no puede resolver HttpClient y la app
    // explota al abrir la pantalla de login. `withFetch` usa la Fetch API.
    provideHttpClient(withFetch()),
  ],
};
