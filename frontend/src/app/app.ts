import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, finalize, forkJoin, of, timer } from 'rxjs';
import { environment } from '../environments/environment';
import { ModalSesion } from './compartidos/modal-sesion/modal-sesion';
import { AuthService } from './core/services/auth.service';
import { urlAvatar } from './core/models/usuario.model';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ModalSesion],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Splash de arranque (Sprint 4): sólo aparece si hay una sesión guardada,
   * porque es lo único que hay para validar. Mientras el backend confirma el
   * token (`GET /auth/autorizar`) se ve la pantalla de carga, con un mínimo de
   * `environment.cargaMinimaMs` para que no sea un parpadeo.
   */
  protected readonly cargandoInicial = signal(this.auth.estaLogueado());

  // El avatar puede venir vacío si el backend no encontró la imagen subida.
  protected readonly avatar = (): string => urlAvatar(this.auth.usuarioActual());

  constructor() {
    if (!this.cargandoInicial()) {
      return;
    }

    // forkJoin espera las dos cosas: la validación y el tiempo mínimo. El
    // catchError deja que el 401 lo resuelva el interceptor (cierra la sesión
    // y navega al login) sin soltar una excepción; el finalize apaga el splash
    // también si falla, para que la app nunca quede tapada.
    forkJoin([
      this.auth.validarSesion().pipe(catchError(() => of(null))),
      timer(environment.cargaMinimaMs),
    ])
      .pipe(finalize(() => this.cargandoInicial.set(false)))
      .subscribe();
  }

  protected salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigate(['/login']);
  }
}
