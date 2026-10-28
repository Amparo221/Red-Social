import { Routes } from '@angular/router';
import { sesionGuard } from './core/guards/sesion.guard';

export const routes: Routes = [
  // La app arranca en el login: sin sesión no hay nada más para ver.
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Purplegram · Ingresar',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'Purplegram · Crear cuenta',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'inicio',
    title: 'Purplegram · Mi perfil',
    canActivate: [sesionGuard],
    loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio),
  },
  { path: '**', redirectTo: 'login' },
];
