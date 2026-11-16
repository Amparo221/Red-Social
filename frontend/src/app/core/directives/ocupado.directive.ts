import { Directive, input } from '@angular/core';

/**
 * Deshabilita el control mientras hay una operación en curso (Sprint 6).
 *
 * Reemplaza los `[disabled]="ocupada()"` / `borrando()` / `enviando()` repartidos
 * por las plantillas y agrega `aria-busy`, para que un lector de pantalla
 * anuncie que el botón está esperando al servidor (antes sólo se veía "…").
 *
 * Sólo se usa cuando la señal de "en curso" es la única condición; los botones
 * que además se deshabilitan por validación (texto vacío) siguen con su
 * `[disabled]` propio.
 *
 * Uso: `<button [appOcupado]="enviando()">Comentar</button>`
 */
@Directive({
  selector: '[appOcupado]',
  host: {
    // `attr.disabled` (y no la propiedad) para que funcione igual en <button> y
    // en <textarea> sin pelear con los bindings del template.
    '[attr.disabled]': 'appOcupado() ? "" : null',
    '[attr.aria-busy]': 'appOcupado() ? "true" : null',
  },
})
export class OcupadoDirective {
  /** true mientras la operación está en vuelo. */
  readonly appOcupado = input(false);
}
