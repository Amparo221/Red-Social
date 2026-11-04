import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Cuerpo de error que devuelve la API.
 *
 * El frontend (`core/utils/error-http.util.ts`) lee `message`: si es string lo
 * muestra tal cual y si es un array (ValidationPipe) muestra una línea por
 * mensaje. `detalle` es sólo para 5xx: lleva el mensaje de la excepción original
 * para poder diagnosticar sin acceso a los logs del servidor.
 */
interface CuerpoDeError {
  statusCode: number;
  message: string | string[];
  error: string;
  detalle?: string;
}

/**
 * Filtro global de excepciones (`app.useGlobalFilters` en `main.ts`).
 *
 * Sin este filtro, una excepción que no sea `HttpException` (una caída de la
 * conexión a Mongo, un error de Cloudinary, un bug) llega al cliente como un 500
 * **sin cuerpo**, y el frontend sólo puede mostrar "ocurrió un error inesperado".
 * Acá:
 *
 * 1. se loguea SIEMPRE el stack completo (en Vercel queda en los Runtime Logs),
 * 2. se responde JSON con un `message` legible,
 * 3. en los 5xx se agrega `detalle` con la causa real.
 *
 * Las `HttpException` (400 del ValidationPipe, 401 del guard, 404, 409, 413…)
 * se devuelven con su status y su mensaje intactos.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const request = contexto.getRequest<Request>();
    const response = contexto.getResponse<Response>();

    const { estado, cuerpo } = this.resolver(exception);
    const descripcion = Array.isArray(cuerpo.message)
      ? cuerpo.message.join(' | ')
      : cuerpo.message;
    const traza =
      exception instanceof Error ? exception.stack : String(exception);

    if (estado >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} respondió ${estado}: ${descripcion}`,
        traza,
      );
    } else if (estado >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(
        `${request.method} ${request.url} respondió ${estado}: ${descripcion}`,
      );
    }

    // Si la respuesta ya empezó a salir (por ejemplo, un error al escribir el
    // stream del archivo) no se puede volver a definir el status.
    if (response.headersSent) {
      return;
    }

    response.status(estado).json(cuerpo);
  }

  /** Traduce cualquier excepción al status + cuerpo JSON de la API. */
  private resolver(exception: unknown): {
    estado: number;
    cuerpo: CuerpoDeError;
  } {
    if (exception instanceof HttpException) {
      return this.resolverHttpException(exception);
    }

    const detalle =
      exception instanceof Error ? exception.message : String(exception);

    return {
      estado: HttpStatus.INTERNAL_SERVER_ERROR,
      cuerpo: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        // Mensaje genérico para el usuario; la causa viaja en `detalle`.
        message: 'Internal server error',
        error: 'Internal Server Error',
        detalle,
      },
    };
  }

  private resolverHttpException(exception: HttpException): {
    estado: number;
    cuerpo: CuerpoDeError;
  } {
    const estado = exception.getStatus();
    const respuesta = exception.getResponse();

    // `new UnauthorizedException('texto')` guarda el texto como response.
    if (typeof respuesta === 'string') {
      return {
        estado,
        cuerpo: {
          statusCode: estado,
          message: respuesta,
          error: exception.name,
        },
      };
    }

    // `ValidationPipe` responde `{ statusCode, message: string[], error }` y los
    // servicios pueden sumar `detalle`.
    const datos = respuesta as Record<string, unknown>;

    return {
      estado,
      cuerpo: {
        statusCode: estado,
        message: this.normalizarMensaje(datos['message'], exception.message),
        error:
          typeof datos['error'] === 'string' ? datos['error'] : exception.name,
        ...(typeof datos['detalle'] === 'string'
          ? { detalle: datos['detalle'] }
          : {}),
      },
    };
  }

  /**
   * El `message` de una HttpException es un string o un array de strings (el
   * ValidationPipe manda uno por campo inválido). Cualquier otra cosa cae al
   * mensaje por defecto para no responder "[object Object]".
   */
  private normalizarMensaje(
    valor: unknown,
    porDefecto: string,
  ): string | string[] {
    if (Array.isArray(valor)) {
      const mensajes = valor.filter(
        (item): item is string => typeof item === 'string',
      );
      return mensajes.length > 0 ? mensajes : porDefecto;
    }

    return typeof valor === 'string' && valor.trim() ? valor : porDefecto;
  }
}
