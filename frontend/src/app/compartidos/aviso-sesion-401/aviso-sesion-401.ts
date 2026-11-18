import { Component, computed, inject } from '@angular/core';
import { SesionExpiradaService } from '../../core/services/sesion-expirada.service';
import { CUENTA_DESHABILITADA, SESION_EXPIRADA } from '../../core/utils/error-http.util';

/**
 * Cartel del error 401 (Sprint 5/6). No decide nada: muestra el motivo que dejó
 * `SesionExpiradaService` y deja ver la cuenta regresiva antes del login.
 */
@Component({
  selector: 'app-aviso-sesion-401',
  templateUrl: './aviso-sesion-401.html',
  styleUrl: './aviso-sesion-401.css',
})
export class AvisoSesion401 {
  protected readonly aviso = inject(SesionExpiradaService);

  protected readonly mensaje = computed(() =>
    this.aviso.motivoActual() === 'deshabilitada' ? CUENTA_DESHABILITADA : SESION_EXPIRADA,
  );
}
