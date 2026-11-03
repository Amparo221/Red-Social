/**
 * Formato de fechas para el feed.
 * En las tarjetas alcanza con "hace 5 min"; a partir de la semana se muestra la
 * fecha corta para no perder la referencia.
 */

const MILISEGUNDOS_POR_MINUTO = 60 * 1000;
const MILISEGUNDOS_POR_HORA = 60 * MILISEGUNDOS_POR_MINUTO;
const MILISEGUNDOS_POR_DIA = 24 * MILISEGUNDOS_POR_HORA;
const DIAS_PARA_FECHA_CORTA = 7;

/**
 * `ahora` se puede pasar para testear (por defecto es la hora del navegador).
 * Devuelve '' si la fecha no es válida, así la tarjeta no muestra "Invalid Date".
 */
export function fechaRelativa(valor: string | null | undefined, ahora: number = Date.now()): string {
  if (!valor) {
    return '';
  }

  const fecha = new Date(valor);
  const tiempo = fecha.getTime();
  if (Number.isNaN(tiempo)) {
    return '';
  }

  // Un reloj adelantado puede dar negativo: se trata como "recién".
  const diferencia = Math.max(0, ahora - tiempo);

  if (diferencia < MILISEGUNDOS_POR_MINUTO) {
    return 'recién';
  }
  if (diferencia < MILISEGUNDOS_POR_HORA) {
    return `hace ${Math.floor(diferencia / MILISEGUNDOS_POR_MINUTO)} min`;
  }
  if (diferencia < MILISEGUNDOS_POR_DIA) {
    return `hace ${Math.floor(diferencia / MILISEGUNDOS_POR_HORA)} h`;
  }
  if (diferencia < DIAS_PARA_FECHA_CORTA * MILISEGUNDOS_POR_DIA) {
    const dias = Math.floor(diferencia / MILISEGUNDOS_POR_DIA);
    return dias === 1 ? 'ayer' : `hace ${dias} d`;
  }

  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Fecha completa para el `title` de la tarjeta (accesibilidad). */
export function fechaCompleta(valor: string | null | undefined): string {
  if (!valor) {
    return '';
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
}
