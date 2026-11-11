import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/** Rutas públicas de auth: no llevan token (ni deben cerrar la sesión con un 401). */
const RUTAS_SIN_TOKEN = ['/auth/login', '/auth/registro', '/auth/sesion'];

/**
 * Interceptor funcional (Angular 17+):
 *  1. pega `Authorization: Bearer <token>` en cada request al backend;
 *  2. si una ruta protegida responde 401 (token vencido: dura 15 minutos), cierra
 *     la sesión y manda al login con el aviso de sesión expirada.
 *
 * El token se lee del AuthService (no de localStorage) para que el estado y lo
 * persistido no se puedan desincronizar.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.tokenActual();
  const esRutaProtegida = req.url.startsWith(environment.apiUrl) && !RUTAS_SIN_TOKEN.some((ruta) => req.url.includes(ruta));

  // `clone` en vez de mutar: HttpRequest es inmutable.
  const pedido = token && esRutaProtegida ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(pedido).pipe(
    catchError((error: unknown) => {
      // Varias requests del feed pueden volver 401 a la vez: sólo la primera
      // navega (después de cerrarSesion estaLogueado() ya es false).
      if (esRutaProtegida && auth.estaLogueado() && error instanceof HttpErrorResponse && error.status === 401) {
        auth.cerrarSesion();
        void router.navigate(['/login'], { queryParams: { sesion: 'expirada' } });
      }
      return throwError(() => error);
    }),
  );
};
