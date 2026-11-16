import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Largo máximo de la descripción en las tarjetas que además muestran la foto.
 *
 * Con imagen la tarjeta ya ocupa bastante alto, así que el texto se recorta; en
 * el detalle (`/publicaciones/:id`) siempre se lee la descripción completa.
 */
export const LIMITE_DESCRIPCION_CON_IMAGEN = 70;

/**
 * Recorta la descripción de una publicación.
 *
 * Regla del Sprint 6: se trunca **sólo cuando la publicación tiene imagen**. Si
 * el texto entra en el límite se deja tal cual (sin puntos suspensivos), y si
 * hay que cortar se busca el último espacio para no partir una palabra al medio
 * (cuando no hay ningún espacio razonable se corta duro).
 *
 * Uso en la plantilla:
 * `{{ publicacion().descripcion | truncarDescripcion: !!publicacion().imagenUrl }}`
 */
@Pipe({
  name: 'truncarDescripcion',
})
export class TruncarDescripcionPipe implements PipeTransform {
  transform(
    descripcion: string | null | undefined,
    tieneImagen = false,
    limite: number = LIMITE_DESCRIPCION_CON_IMAGEN,
  ): string {
    return truncarDescripcion(descripcion, tieneImagen, limite);
  }
}

/** Lógica pura del pipe, exportada para poder testearla sin montar el pipe. */
export function truncarDescripcion(
  descripcion: string | null | undefined,
  tieneImagen: boolean,
  limite: number = LIMITE_DESCRIPCION_CON_IMAGEN,
): string {
  const texto = (descripcion ?? '').trim();

  // Sin imagen (o sin texto) no se recorta nada: se ve la descripción completa.
  if (!tieneImagen || !texto || limite <= 0 || texto.length <= limite) {
    return texto;
  }

  const recorte = texto.slice(0, limite);
  const ultimoEspacio = recorte.lastIndexOf(' ');
  // Si el primer tramo no tiene espacios (una palabra larguísima) se corta duro.
  const cortado = ultimoEspacio > 0 ? recorte.slice(0, ultimoEspacio) : recorte;
  // Se saca la puntuación que quedó colgando para no mostrar "texto,…".
  const limpio = cortado.replace(/[\s,;:.…-]+$/, '');

  return `${limpio || cortado.trim()}…`;
}
