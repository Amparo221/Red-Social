import { HttpErrorResponse } from '@angular/common/http';
import { mensajeDeError, mensajesDeError } from './error-http.util';

describe('mensajesDeError', () => {
  it('avisa cuando el backend no está corriendo (status 0)', () => {
    const error = new HttpErrorResponse({ status: 0 });

    expect(mensajesDeError(error)).toEqual([expect.stringContaining('No pudimos conectarnos')]);
  });

  it('devuelve todos los mensajes del ValidationPipe (400 con array)', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        statusCode: 400,
        message: ['El correo no tiene un formato válido', 'La contraseña debe tener al menos 8 caracteres'],
        error: 'Bad Request',
      },
    });

    expect(mensajesDeError(error)).toEqual([
      'El correo no tiene un formato válido',
      'La contraseña debe tener al menos 8 caracteres',
    ]);
  });

  it('conserva el mensaje del backend en un 409', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { statusCode: 409, message: 'El nombre de usuario ya está en uso' },
    });

    expect(mensajeDeError(error)).toBe('El nombre de usuario ya está en uso');
  });

  it('traduce el 413 de multer a un mensaje propio', () => {
    const error = new HttpErrorResponse({
      status: 413,
      error: { statusCode: 413, message: 'File too large' },
    });

    expect(mensajeDeError(error)).toBe('La imagen no puede superar los 5 MB.');
  });

  it('usa un mensaje genérico para el 401 sin cuerpo', () => {
    const error = new HttpErrorResponse({ status: 401 });

    expect(mensajeDeError(error)).toBe('Usuario/correo o contraseña incorrectos.');
  });

  it('cae en el mensaje genérico con un error que no es HTTP', () => {
    expect(mensajeDeError(new Error('boom'))).toContain('error inesperado');
  });
});
