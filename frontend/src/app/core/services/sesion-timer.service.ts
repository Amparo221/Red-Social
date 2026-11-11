import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { POLITICA_SESION_POR_DEFECTO } from '../models/usuario.model';
import { vencimientoDelToken } from '../utils/jwt.util';
import { AuthService } from './auth.service';

/**
 * Reloj de la sesión (Sprint 4).
 *
 * El tiempo restante se **deriva del `exp` del JWT**, no de un contador
 * propio: así un F5, otra pestaña o un token renovado dan siempre el valor
 * correcto. Cuando quedan `avisoSegundos` (los manda el backend en
 * `GET /auth/sesion`) aparece el modal para extender la sesión; si nadie lo
 * extiende, al llegar a cero se cierra la sesión y se vuelve al login.
 */
@Injectable({ providedIn: 'root' })
export class SesionTimerService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly restantes = signal(0);
  private readonly aviso = signal(POLITICA_SESION_POR_DEFECTO.avisoSegundos);
  private readonly extendiendo = signal(false);

  /** Segundos que le quedan a la sesión. */
  readonly segundosRestantes = this.restantes.asReadonly();

  /** true mientras se pide el token nuevo (deshabilita el botón). */
  readonly extendiendoSesion = this.extendiendo.asReadonly();

  /** true cuando ya corresponde mostrar el modal de aviso. */
  readonly avisando = computed(
    () => this.restantes() > 0 && this.restantes() <= this.aviso(),
  );

  constructor() {
    // El effect se vuelve a ejecutar cuando cambia el token (login, F5,
    // refresco) y su cleanup apaga el reloj anterior: nunca quedan dos
    // intervalos corriendo a la vez.
    effect((onCleanup) => {
      const token = this.auth.tokenActual();

      if (!token) {
        this.restantes.set(0);
        return;
      }

      // Los tiempos del aviso los manda el backend: si cambian en el .env,
      // el front se entera sin recompilar.
      const politica = this.auth
        .politicaSesion()
        .subscribe(({ avisoSegundos }) => this.aviso.set(avisoSegundos));

      const vence = vencimientoDelToken(token);
      if (vence === null) {
        // Token sin `exp` legible: no hay nada que cronometrar (el backend
        // sigue siendo el que rechaza). Se evita desloguear por las dudas.
        onCleanup(() => politica.unsubscribe());
        return;
      }

      const actualizar = () => {
        const quedan = Math.max(0, Math.round((vence - Date.now()) / 1000));
        this.restantes.set(quedan);

        if (quedan === 0) {
          this.expirar();
        }
      };

      actualizar();
      const reloj = setInterval(actualizar, 1000);

      onCleanup(() => {
        politica.unsubscribe();
        clearInterval(reloj);
      });
    });
  }

  /**
   * POST /auth/refrescar: token nuevo, el reloj vuelve a empezar solo (el
   * `effect` reacciona al cambio de `tokenActual()`).
   */
  extender(): void {
    if (this.extendiendo()) {
      return;
    }

    this.extendiendo.set(true);

    this.auth
      .refrescar()
      .pipe(finalize(() => this.extendiendo.set(false)))
      .subscribe({
        // Si el refresco falla (sesión ya vencida, backend caído) se comporta
        // como un vencimiento normal: sesión cerrada y al login.
        error: () => this.expirar(),
      });
  }

  /** Botón "Cerrar sesión" del aviso: el usuario decide salir ya. */
  salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigate(['/login']);
  }

  /** Vencimiento (o refresco fallido): cierra la sesión y avisa en el login. */
  private expirar(): void {
    // Varias pestañas pueden llegar a cero a la vez: sólo la primera navega.
    if (!this.auth.estaLogueado()) {
      return;
    }

    this.auth.cerrarSesion();
    void this.router.navigate(['/login'], { queryParams: { sesion: 'expirada' } });
  }
}
