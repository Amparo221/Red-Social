import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  HostListener,
  Renderer2,
  inject,
  input,
  output,
} from '@angular/core';

/**
 * Avisa cuando el usuario hace click fuera del elemento (Sprint 6).
 *
 * Sirve para cerrar los bloques de confirmación que se abren dentro de la
 * tarjeta y del detalle: antes había que apretar "No", ahora un click en
 * cualquier otro lado (o Escape) los cancela.
 *
 * Se escucha `pointerdown` y no `click` a propósito: el `pointerdown` del click
 * que abrió el bloque ya ocurrió antes de que existiera la directiva, así que
 * nunca se cierra sola en el mismo gesto que la abrió.
 *
 * Uso: `<div (appClicFuera)="cancelar()">…</div>`
 */
@Directive({
  selector: '[appClicFuera]',
})
export class ClicFueraDirective {
  /** Se emite cuando el click (o Escape) ocurre fuera del elemento host. */
  readonly appClicFuera = output<void>();
  /** Escape también cierra. Se puede apagar para bloques que deben quedarse. */
  readonly cerrarConEscape = input(true);

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly documento = inject(DOCUMENT);
  private readonly destruccion = inject(DestroyRef);

  constructor() {
    const quitarEscucha = this.renderer.listen(this.documento, 'pointerdown', (evento: Event) =>
      this.alPresionar(evento),
    );
    this.destruccion.onDestroy(quitarEscucha);
  }

  @HostListener('document:keydown.escape')
  protected alPresionarEscape(): void {
    if (this.cerrarConEscape()) {
      this.appClicFuera.emit();
    }
  }

  private alPresionar(evento: Event): void {
    const destino = evento.target as Node | null;
    // El host puede haberse ido del DOM en el mismo gesto: no hay nada que cerrar.
    if (destino && this.elemento.nativeElement.contains(destino)) {
      return;
    }
    this.appClicFuera.emit();
  }
}
