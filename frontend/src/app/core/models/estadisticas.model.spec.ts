import {
  agrupacionSugerida,
  diaLocal,
  diasDelRango,
  etiquetaDeAgrupacion,
  rangoDePreset,
  sumarDias,
  textoDelRango,
} from './estadisticas.model';

// Miércoles 11/11/2026 en hora local: el día no depende del huso del runner.
const HOY = new Date(2026, 10, 11);

describe('diaLocal', () => {
  it('formatea la fecha local en AAAA-MM-DD', () => {
    expect(diaLocal(HOY)).toBe('2026-11-11');
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('sumarDias', () => {
  it('cruza fin de mes y de año', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('diasDelRango', () => {
  it('cuenta los dos extremos', () => {
    expect(diasDelRango('2026-11-11', '2026-11-11')).toBe(1);
    expect(diasDelRango('2026-11-05', '2026-11-11')).toBe(7);
    expect(diasDelRango('2026-10-13', '2026-11-11')).toBe(30);
  });
});

describe('rangoDePreset', () => {
  it('calcula el rango hacia atrás desde hoy', () => {
    expect(rangoDePreset('7d', HOY)).toEqual({
      desde: '2026-11-05',
      hasta: '2026-11-11',
    });
    expect(rangoDePreset('30d', HOY)).toEqual({
      desde: '2026-10-13',
      hasta: '2026-11-11',
    });
  });

  it('devuelve null para personalizado', () => {
    expect(rangoDePreset('personalizado', HOY)).toBeNull();
  });
});

describe('agrupacionSugerida', () => {
  it('agrupa por día en rangos cortos, por semana en medios y por mes en largos', () => {
    expect(agrupacionSugerida('2026-11-05', '2026-11-11')).toBe('dia');
    expect(agrupacionSugerida('2026-09-01', '2026-11-11')).toBe('semana');
    expect(agrupacionSugerida('2025-11-12', '2026-11-11')).toBe('mes');
  });
});

describe('textoDelRango', () => {
  it('arma el texto del encabezado en dd/mm/aaaa', () => {
    expect(textoDelRango('2026-11-01', '2026-11-03')).toBe(
      'Del 01/11/2026 al 03/11/2026',
    );
  });
});

describe('etiquetaDeAgrupacion', () => {
  it('traduce la granularidad a una etiqueta legible', () => {
    expect(etiquetaDeAgrupacion('dia')).toBe('Por día');
    expect(etiquetaDeAgrupacion('semana')).toBe('Por semana');
    expect(etiquetaDeAgrupacion('mes')).toBe('Por mes');
  });
});
