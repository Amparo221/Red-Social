import { Pipe, type PipeTransform } from '@angular/core';

/** Formato local: 1234 → "1.234". Se crea una sola vez (es lo caro de Intl). */
const FORMATO_NUMERO = new Intl.NumberFormat('es-AR');

/**
 * Contadores y totales con separador de miles.
 *
 * Los contadores de me gusta y de comentarios son chicos, pero los totales del
 * dashboard sí pueden pasar el millar: `1234` se lee mejor como `1.234`.
 *
 * Uso: `{{ publicacion().cantidadLikes | numero }}`
 */
@Pipe({
  name: 'numero',
})
export class NumeroPipe implements PipeTransform {
  /** Devuelve '' si no hay número, para no mostrar "NaN" en la tarjeta. */
  transform(valor: number | null | undefined, opciones?: Intl.NumberFormatOptions): string {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
      return '';
    }

    const formateador = opciones ? new Intl.NumberFormat('es-AR', opciones) : FORMATO_NUMERO;
    return formateador.format(valor);
  }
}
