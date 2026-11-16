import { NumeroPipe } from './numero.pipe';

describe('NumeroPipe', () => {
  const pipe = new NumeroPipe();

  it('deja los contadores chicos como están', () => {
    expect(pipe.transform(0)).toBe('0');
    expect(pipe.transform(7)).toBe('7');
  });

  it('separa los miles al estilo local', () => {
    const mil = pipe.transform(1234);

    expect(mil).not.toBe('1234');
    expect(mil.replace(/\D/g, '')).toBe('1234');
  });

  it('devuelve vacío si no hay número', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(Number.NaN)).toBe('');
  });

  it('acepta opciones de formato', () => {
    expect(pipe.transform(3.14159, { maximumFractionDigits: 1 })).toContain('3');
    expect(pipe.transform(3.14159, { maximumFractionDigits: 1 })).not.toBe(
      pipe.transform(3.14159),
    );
  });
});
