import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { esAdministrador } from '../models/usuario.model';
import { AuthService } from '../services/auth.service';

/**
 * Deja pasar sólo a los administradores a las pantallas del dashboard
 * (Sprint 4). Es la misma idea que `sesionGuard`, pero mirando el perfil.
 *
 * Un usuario común que escriba la URL a mano vuelve al feed con `?denegado=1`
 * para que se le explique por qué no entró. La seguridad real la sigue haciendo
 * el backend: `RolesGuard` responde 403 en /usuarios aunque alguien saltee esto.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaLogueado()) {
    return router.createUrlTree(['/login']);
  }

  return esAdministrador(auth.usuarioActual())
    ? true
    : router.createUrlTree(['/publicaciones'], { queryParams: { denegado: 1 } });
};
