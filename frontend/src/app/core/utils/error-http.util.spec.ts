import { HttpErrorResponse } from '@angular/common/http';
import {
  CUENTA_DESHABILITADA,
  MOTIVO_CUENTA_DESHABILITADA,
  SESION_EXPIRADA,
  avisoDeSesion,
  esCuentaDeshabilitada,
  mensajeDeError,
  mensajesDeError,
  motivoDeError,
} from './error-http.util';

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

  it('en una ruta protegida (contexto sesion) el 401 avisa que la sesión expiró', () => {
    const error = new HttpErrorResponse({
      status: 401,
      error: { statusCode: 401, message: 'Unauthorized' },
    });

    expect(mensajeDeError(error, 'sesion')).toContain('Tu sesión expiró');
  });

  it('conserva el mensaje del backend en un 403 (no sos el autor)', () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { statusCode: 403, message: 'No tenés permiso para eliminar esta publicación' },
    });

    expect(mensajeDeError(error, 'sesion')).toBe('No tenés permiso para eliminar esta publicación');
  });

  it('cae en el mensaje genérico con un error que no es HTTP', () => {
    expect(mensajeDeError(new Error('boom'))).toContain('error inesperado');
  });
});

describe('cuenta deshabilitada (Sprint 4)', () => {
  const errorDeshabilitada = new HttpErrorResponse({
    status: 401,
    error: {
      statusCode: 401,
      message: 'Tu cuenta está deshabilitada. Contactá a un administrador.',
      error: 'Unauthorized',
      motivo: MOTIVO_CUENTA_DESHABILITADA,
    },
  });

  it('lee el motivo que agrega el backend', () => {
    expect(motivoDeError(errorDeshabilitada)).toBe(MOTIVO_CUENTA_DESHABILITADA);
    expect(esCuentaDeshabilitada(errorDeshabilitada)).toBe(true);
  });

  it('devuelve null cuando el error no trae motivo', () => {
    const expirado = new HttpErrorResponse({
      status: 401,
      error: { statusCode: 401, message: 'El token es inválido o expiró' },
    });

    expect(motivoDeError(expirado)).toBeNull();
    expect(esCuentaDeshabilitada(expirado)).toBe(false);
    expect(motivoDeError(new Error('boom'))).toBeNull();
  });

  it('el aviso de cuenta deshabilitada gana sobre el de sesión expirada', () => {
    // Aunque la request haya ido a una ruta protegida, el usuario tiene que
    // leer que lo deshabilitaron, no que "venció la sesión".
    expect(mensajeDeError(errorDeshabilitada, 'sesion')).toBe(CUENTA_DESHABILITADA);
    expect(mensajeDeError(errorDeshabilitada)).toBe(CUENTA_DESHABILITADA);
  });
});

describe('avisoDeSesion', () => {
  it('explica que la sesión expiró con ?sesion=expirada', () => {
    expect(avisoDeSesion('expirada')).toEqual([SESION_EXPIRADA]);
  });

  it('explica que la cuenta está deshabilitada con ?sesion=deshabilitada', () => {
    expect(avisoDeSesion('deshabilitada')).toEqual([CUENTA_DESHABILITADA]);
  });

  it('no muestra nada si no hay motivo', () => {
    expect(avisoDeSesion(null)).toEqual([]);
    expect(avisoDeSesion('otra-cosa')).toEqual([]);
  });
});
