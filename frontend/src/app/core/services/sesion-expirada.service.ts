import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/** Cuánto se deja ver el error 401 antes de mandar al login. */
export const DEMORA_REDIRECCION_MS = 5000;

/** Mismo vocabulario que el `?sesion=` que lee la pantalla de login. */
export type MotivoFinSesion = 'expirada' | 'deshabilitada';

/**
 * Aviso de sesión terminada por un 401 (Sprint 5/6).
 *
 * Lo usan los dos caminos que cierran la sesión:
 *  - el `authInterceptor`, cuando el backend responde 401;
 *  - el `SesionTimerService`, cuando el reloj del `exp` llega a cero.
 *
 * La sesión se cierra en el acto (el `AuthService` queda sin token y la
 * cabecera pasa a "Ingresar"), pero la navegación sale `DEMORA_REDIRECCION_MS`
 * después: en el medio se ve el 401 con la cuenta regresiva, así el usuario
 * entiende por qué lo saca en vez de aparecer de golpe en el login.
 */
@Injectable({ providedIn: 'root' })
export class SesionExpiradaService {
  private readonly router = inject(Router);

  private readonly motivo = signal<MotivoFinSesion | null>(null);
  private readonly segundos = signal(DEMORA_REDIRECCION_MS / 1000);
  private reloj: ReturnType<typeof setInterval> | null = null;
  private redireccion: ReturnType<typeof setTimeout> | null = null;

  readonly motivoActual = this.motivo.asReadonly();
  readonly segundosRestantes = this.segundos.asReadonly();
  readonly avisando = computed(() => this.motivo() !== null);

  /** Varias requests pueden volver 401 a la vez: sólo la primera avisa. */
  avisar(motivo: MotivoFinSesion): void {
    if (this.avisando()) {
      return;
    }

    this.motivo.set(motivo);
    this.segundos.set(Math.ceil(DEMORA_REDIRECCION_MS / 1000));

    this.reloj = setInterval(
      () => this.segundos.update((valor) => Math.max(0, valor - 1)),
      1000,
    );
    this.redireccion = setTimeout(() => this.redirigir(), DEMORA_REDIRECCION_MS);
  }

  /** Botón "Ir al login ahora": no espera los 2 s. */
  irAhora(): void {
    this.redirigir();
  }

  private redirigir(): void {
    const motivo = this.motivo();

    if (!motivo) {
      return;
    }

    this.limpiar();
    this.motivo.set(null);
    // El login lee `?sesion=` y arranca con la alerta ya visible.
    void this.router.navigate(['/login'], { queryParams: { sesion: motivo } });
  }

  private limpiar(): void {
    if (this.reloj !== null) {
      clearInterval(this.reloj);
      this.reloj = null;
    }

    if (this.redireccion !== null) {
      clearTimeout(this.redireccion);
      this.redireccion = null;
    }
  }
}
