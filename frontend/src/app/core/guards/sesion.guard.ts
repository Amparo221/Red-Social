import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Deja pasar a /inicio sólo si hay un usuario en sesión.
 * En el Sprint 1 el backend todavía no emite JWT: la "sesión" es el usuario
 * guardado en el navegador, así que esto evita pantallas vacías pero no es
 * seguridad real (el Sprint 2 lo resuelve con el token).
 */
export const sesionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estaLogueado() ? true : router.createUrlTree(['/login']);
};
