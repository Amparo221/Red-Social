import { HttpErrorResponse } from '@angular/common/http';
import type { ErrorNest } from '../models/usuario.model';

const SIN_CONEXION =
  'No pudimos conectarnos con el servidor. Verificá que el backend esté corriendo en http://localhost:3000.';
const IMAGEN_DEMASIADO_GRANDE = 'La imagen no puede superar los 5 MB.';
const CREDENCIALES_INVALIDAS = 'Usuario/correo o contraseña incorrectos.';
const ERROR_GENERICO = 'Ocurrió un error inesperado. Intentá nuevamente.';

/**
 * Traduce un error HTTP del backend a la lista de mensajes que se muestran en
 * la pantalla. El ValidationPipe de Nest devuelve `message` como array cuando
 * fallan varias validaciones y como string en los casos 401/409.
 */
export function mensajesDeError(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [ERROR_GENERICO];
  }

  // status 0 = el navegador no llegó al servidor (backend apagado, CORS, red).
  if (error.status === 0) {
    return [SIN_CONEXION];
  }

  // Multer corta la subida antes de que llegue al DTO y responde en inglés.
  if (error.status === 413) {
    return [IMAGEN_DEMASIADO_GRANDE];
  }

  const mensajesDelBackend = leerMensajes(error.error);
  if (mensajesDelBackend.length > 0) {
    return mensajesDelBackend;
  }

  if (error.status === 401) {
    return [CREDENCIALES_INVALIDAS];
  }

  return [`${ERROR_GENERICO} (código ${error.status})`];
}

/** Primer mensaje, útil cuando la alerta muestra una sola línea. */
export function mensajeDeError(error: unknown): string {
  return mensajesDeError(error)[0] ?? ERROR_GENERICO;
}

function leerMensajes(cuerpo: unknown): string[] {
  if (typeof cuerpo === 'string') {
    const texto = cuerpo.trim();
    return texto ? [texto] : [];
  }

  if (cuerpo && typeof cuerpo === 'object') {
    const { message } = cuerpo as Partial<ErrorNest>;
    if (Array.isArray(message)) {
      return message.filter((mensaje): mensaje is string => typeof mensaje === 'string' && !!mensaje.trim());
    }
    if (typeof message === 'string' && message.trim()) {
      return [message.trim()];
    }
  }

  return [];
}
