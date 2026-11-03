import { fechaCompleta, fechaRelativa } from './fecha.util';

// Jueves 30/10/2026, 12:00 UTC: `ahora` fijo para que los tests no dependan del reloj.
const AHORA = Date.parse('2026-10-30T12:00:00.000Z');

describe('fechaRelativa', () => {
  it('devuelve una cadena vacía si la fecha falta o es inválida', () => {
    expect(fechaRelativa('', AHORA)).toBe('');
    expect(fechaRelativa(null, AHORA)).toBe('');
    expect(fechaRelativa('no-es-fecha', AHORA)).toBe('');
  });

  it('muestra "recién" en el primer minuto', () => {
    expect(fechaRelativa('2026-10-30T11:59:30.000Z', AHORA)).toBe('recién');
  });

  it('cuenta minutos y horas', () => {
    expect(fechaRelativa('2026-10-30T11:55:00.000Z', AHORA)).toBe('hace 5 min');
    expect(fechaRelativa('2026-10-30T09:00:00.000Z', AHORA)).toBe('hace 3 h');
  });

  it('distingue ayer y el resto de la última semana', () => {
    expect(fechaRelativa('2026-10-29T12:00:00.000Z', AHORA)).toBe('ayer');
    expect(fechaRelativa('2026-10-27T12:00:00.000Z', AHORA)).toBe('hace 3 d');
  });

  it('a partir de la semana muestra la fecha corta', () => {
    expect(fechaRelativa('2026-10-01T12:00:00.000Z', AHORA)).toBe('01/10/2026');
  });

  it('no rompe si el reloj del navegador está adelantado', () => {
    expect(fechaRelativa('2026-10-30T12:05:00.000Z', AHORA)).toBe('recién');
  });
});

describe('fechaCompleta', () => {
  it('devuelve la fecha larga para el tooltip', () => {
    expect(fechaCompleta('2026-10-30T12:00:00.000Z')).toContain('2026');
  });

  it('devuelve vacío si no hay fecha', () => {
    expect(fechaCompleta(undefined)).toBe('');
  });
});
