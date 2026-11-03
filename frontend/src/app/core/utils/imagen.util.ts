/**
 * Validación de imágenes en el navegador: los mismos límites que aplica el
 * backend con el `FileInterceptor('imagen', OPCIONES_IMAGEN)` de Multer
 * (backend/src/common/multer/imagen.multer.ts).
 *
 * Se valida acá para no subir 5 MB al pedo; el backend igual vuelve a validar y
 * sus mensajes son los que se muestran si algo se escapa.
 */

export const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB
export const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Devuelve el mensaje de error, o null si la imagen es válida. */
export function validarImagen(archivo: Pick<File, 'type' | 'size'>): string | null {
  if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
    return 'La imagen debe ser JPG, PNG, WEBP o GIF.';
  }

  if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
    return 'La imagen no puede superar los 5 MB.';
  }

  return null;
}
