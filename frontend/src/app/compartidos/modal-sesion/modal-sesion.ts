import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { SesionTimerService } from '../../core/services/sesion-timer.service';

/**
 * Aviso de sesión por vencer (Sprint 4).
 *
 * No decide nada por su cuenta: sólo muestra lo que dice `SesionTimerService`
 * y delega los botones. Aparece cuando faltan `avisoSegundos` (valor que manda
 * el backend en `GET /auth/sesion`) y desaparece al extender la sesión o al
 * cerrarla.
 */
@Component({
  selector: 'app-modal-sesion',
  templateUrl: './modal-sesion.html',
  styleUrl: './modal-sesion.css',
})
export class ModalSesion {
  protected readonly timer = inject(SesionTimerService);

  private readonly botonExtender = viewChild<ElementRef<HTMLButtonElement>>('botonExtender');

  /** `m:ss` de lo que le queda a la sesión. */
  protected readonly cuenta = computed(() => formatearCuenta(this.timer.segundosRestantes()));

  constructor() {
    // Al aparecer el aviso el foco va al botón principal: se puede extender
    // con Enter sin tener que buscar el mouse.
    effect(() => {
      if (this.timer.avisando()) {
        queueMicrotask(() => this.botonExtender()?.nativeElement.focus());
      }
    });
  }
}

/** 65 → "1:05". El aviso se mueve en minutos, no hace falta más precisión. */
function formatearCuenta(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return `${minutos}:${resto.toString().padStart(2, '0')}`;
}
