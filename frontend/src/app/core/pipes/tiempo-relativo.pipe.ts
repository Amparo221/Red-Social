import { Pipe, type PipeTransform } from '@angular/core';
import { fechaRelativa } from '../utils/fecha.util';

/**
 * "hace 5 min", "ayer", "01/10/2026"… a partir de una fecha ISO.
 *
 * Envuelve `fechaRelativa()` de `core/utils/fecha.util.ts` para poder usarla en
 * las plantillas sin exponer la función como método del componente. Al ser un
 * pipe puro, sólo se recalcula cuando cambia la fecha.
 *
 * Uso: `{{ publicacion().createdAt | tiempoRelativo }}`
 */
@Pipe({
  name: 'tiempoRelativo',
})
export class TiempoRelativoPipe implements PipeTransform {
  /** `ahora` es opcional y existe para los tests: en la app se usa el reloj real. */
  transform(valor: string | null | undefined, ahora?: number): string {
    return fechaRelativa(valor, ahora);
  }
}
