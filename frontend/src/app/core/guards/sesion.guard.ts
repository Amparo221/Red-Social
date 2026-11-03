import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Deja pasar a las pantallas privadas (feed y perfil) sólo si hay sesión.
 *
 * Ojo: esto es comodidad de navegación, no seguridad. La seguridad real la hace
 * el backend con el JwtAuthGuard; si el token venció (dura 15 minutos), el
 * authInterceptor cierra la sesión y vuelve acá con ?sesion=expirada.
 */
export const sesionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estaLogueado() ? true : router.createUrlTree(['/login']);
};
