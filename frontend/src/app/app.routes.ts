import { Routes } from '@angular/router';
import { sesionGuard } from './core/guards/sesion.guard';

export const routes: Routes = [
  // La pantalla principal es el feed. El guard manda al login si no hay sesión,
  // así que entrar a la app sin cuenta termina siempre en /login.
  { path: '', pathMatch: 'full', redirectTo: 'publicaciones' },
  {
    path: 'login',
    title: 'IdentiBird · Ingresar',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'IdentiBird · Crear cuenta',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'publicaciones',
    title: 'IdentiBird · Publicaciones',
    canActivate: [sesionGuard],
    loadComponent: () => import('./pages/publicaciones/publicaciones').then((m) => m.Publicaciones),
  },
  {
    path: 'publicaciones/:id',
    title: 'IdentiBird · Publicación',
    canActivate: [sesionGuard],
    loadComponent: () => import('./pages/publicacion/publicacion').then((m) => m.Publicacion),
  },
  {
    path: 'inicio',
    title: 'IdentiBird · Mi perfil',
    canActivate: [sesionGuard],
    loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio),
  },
  { path: '**', redirectTo: 'publicaciones' },
];
