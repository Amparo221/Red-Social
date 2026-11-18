import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { SesionExpiradaService } from '../services/sesion-expirada.service';
import { esCuentaDeshabilitada } from '../utils/error-http.util';

/** Rutas públicas de auth: no llevan token (ni deben cerrar la sesión con un 401). */
const RUTAS_SIN_TOKEN = ['/auth/login', '/auth/registro', '/auth/sesion'];

/**
 * Interceptor funcional (Angular 17+):
 *  1. pega `Authorization: Bearer <token>` en cada request al backend;
 *  2. si una ruta protegida responde 401, cierra la sesión y muestra el error
 *     con el aviso correcto: "sesión expirada" si venció el token (dura 15
 *     minutos) o "cuenta deshabilitada" si un administrador dio de baja la
 *     cuenta (Sprint 4, el backend lo distingue con el campo `motivo`).
 *
 * La navegación al login **no** es inmediata: la hace `SesionExpiradaService`
 * después de `DEMORA_REDIRECCION_MS`, para que el usuario llegue a leer el 401
 * en lugar de aparecer de golpe en el login.
 *
 * El token se lee del AuthService (no de localStorage) para que el estado y lo
 * persistido no se puedan desincronizar.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const avisoSesion = inject(SesionExpiradaService);

  const token = auth.tokenActual();
  const esRutaProtegida = req.url.startsWith(environment.apiUrl) && !RUTAS_SIN_TOKEN.some((ruta) => req.url.includes(ruta));

  // `clone` en vez de mutar: HttpRequest es inmutable.
  const pedido = token && esRutaProtegida ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(pedido).pipe(
    catchError((error: unknown) => {
      // Varias requests del feed pueden volver 401 a la vez: sólo la primera
      // avisa (después de cerrarSesion estaLogueado() ya es false).
      if (esRutaProtegida && auth.estaLogueado() && error instanceof HttpErrorResponse && error.status === 401) {
        const motivo = esCuentaDeshabilitada(error) ? 'deshabilitada' : 'expirada';
        auth.cerrarSesion();
        // El 401 se ve `DEMORA_REDIRECCION_MS` y recién ahí se navega al login.
        avisoSesion.avisar(motivo);
      }
      return throwError(() => error);
    }),
  );
};
