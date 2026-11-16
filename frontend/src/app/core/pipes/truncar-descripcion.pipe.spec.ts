import {
  LIMITE_DESCRIPCION_CON_IMAGEN,
  TruncarDescripcionPipe,
  truncarDescripcion,
} from './truncar-descripcion.pipe';

const CORTA = 'Un martín pescador en la reserva.';
const LARGA =
  'Un martín pescador posado en una rama baja, cerca del agua, esperando el momento justo para zambullirse y volver con un pez en el pico.';

describe('truncarDescripcion', () => {
  it('sin imagen devuelve la descripción completa', () => {
    expect(truncarDescripcion(LARGA, false)).toBe(LARGA);
  });

  it('con imagen y texto corto no agrega puntos suspensivos', () => {
    expect(truncarDescripcion(CORTA, true)).toBe(CORTA);
  });

  it('con imagen recorta el texto largo y marca el corte', () => {
    const resultado = truncarDescripcion(LARGA, true);

    expect(LARGA.startsWith(resultado.slice(0, -1))).toBe(true);
    expect(resultado.endsWith('…')).toBe(true);
    expect(resultado.length).toBeLessThanOrEqual(LIMITE_DESCRIPCION_CON_IMAGEN + 1);
  });

  it('corta en un espacio, sin partir palabras', () => {
    const resultado = truncarDescripcion(LARGA, true);
    const sinPuntos = resultado.slice(0, -1);

    // En el original, después del recorte viene un separador (no una letra).
    expect(/[\s,;:.-]/.test(LARGA.charAt(sinPuntos.length))).toBe(true);
    expect(sinPuntos.endsWith(' ')).toBe(false);
  });

  it('respeta un límite distinto al de la tarjeta', () => {
    expect(truncarDescripcion('uno dos tres cuatro', true, 10)).toBe('uno dos…');
  });

  it('saca la puntuación que quedó colgando antes de los puntos suspensivos', () => {
    expect(truncarDescripcion('Hola, mundo cruel', true, 6)).toBe('Hola…');
  });

  it('corta duro si el primer tramo no tiene espacios', () => {
    expect(truncarDescripcion('x'.repeat(100), true)).toBe(`${'x'.repeat(70)}…`);
  });

  it('devuelve vacío si no hay descripción', () => {
    expect(truncarDescripcion(null, true)).toBe('');
    expect(truncarDescripcion(undefined, true)).toBe('');
    expect(truncarDescripcion('   ', true)).toBe('');
  });

  it('limpia los espacios de los extremos', () => {
    expect(truncarDescripcion(`  ${LARGA}  `, false)).toBe(LARGA);
  });
});

describe('TruncarDescripcionPipe', () => {
  const pipe = new TruncarDescripcionPipe();

  it('usa el límite de la tarjeta por defecto', () => {
    expect(pipe.transform(LARGA, true)).toBe(truncarDescripcion(LARGA, true));
  });

  it('sin imagen no recorta', () => {
    expect(pipe.transform(LARGA)).toBe(LARGA);
  });
});
