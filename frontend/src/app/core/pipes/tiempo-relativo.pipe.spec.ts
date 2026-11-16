import { TiempoRelativoPipe } from './tiempo-relativo.pipe';

// Jueves 30/10/2026, 12:00 UTC: `ahora` fijo para que los tests no dependan del reloj.
const AHORA = Date.parse('2026-10-30T12:00:00.000Z');

describe('TiempoRelativoPipe', () => {
  const pipe = new TiempoRelativoPipe();

  it('delega en fechaRelativa con la hora que se le pasa', () => {
    expect(pipe.transform('2026-10-30T11:55:00.000Z', AHORA)).toBe('hace 5 min');
    expect(pipe.transform('2026-10-29T12:00:00.000Z', AHORA)).toBe('ayer');
  });

  it('devuelve vacío si no hay fecha o es inválida', () => {
    expect(pipe.transform(null, AHORA)).toBe('');
    expect(pipe.transform(undefined, AHORA)).toBe('');
    expect(pipe.transform('no-es-fecha', AHORA)).toBe('');
  });

  it('usa el reloj real cuando no se pasa `ahora`', () => {
    expect(pipe.transform(new Date().toISOString())).toBe('recién');
  });
});
