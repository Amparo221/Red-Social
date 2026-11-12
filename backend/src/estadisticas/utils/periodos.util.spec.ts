import {
  armarPeriodos,
  claveDe,
  completarSerie,
  diaEnArgentina,
  diasDelRango,
  esDiaIso,
  etiquetaDe,
  finDelDia,
  inicioDelDia,
  lunesDeLaSemana,
  normalizarDia,
  sumarDias,
} from './periodos.util';

/**
 * Estas funciones son las que garantizan que el día en que se cuenta un
 * comentario sea el día en que lo vio el usuario, no el día UTC.
 */
describe('periodos.util', () => {
  describe('diaEnArgentina', () => {
    it('usa la fecha argentina y no la UTC', () => {
      // 02:30 UTC del 11/11 son las 23:30 del 10/11 en Buenos Aires.
      expect(diaEnArgentina(new Date('2026-11-11T02:30:00.000Z'))).toBe(
        '2026-11-10',
      );
      // 03:30 UTC del 11/11 ya son las 00:30 del 11/11.
      expect(diaEnArgentina(new Date('2026-11-11T03:30:00.000Z'))).toBe(
        '2026-11-11',
      );
    });
  });

  describe('normalizarDia', () => {
    it('deja intacto un día sin hora', () => {
      // `new Date('2026-11-11')` es medianoche UTC: convertirlo daría 10/11.
      expect(normalizarDia('2026-11-11')).toBe('2026-11-11');
    });

    it('convierte un ISO completo a la fecha argentina', () => {
      expect(normalizarDia('2026-11-11T02:30:00.000Z')).toBe('2026-11-10');
    });
  });

  it('esDiaIso sólo acepta AAAA-MM-DD', () => {
    expect(esDiaIso('2026-11-11')).toBe(true);
    expect(esDiaIso('2026-11-11T10:00:00.000Z')).toBe(false);
    expect(esDiaIso('11/11/2026')).toBe(false);
  });

  describe('sumarDias', () => {
    it('cruza fin de mes y de año', () => {
      expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
      expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
      expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
    });
  });

  it('diasDelRango cuenta los dos extremos', () => {
    expect(diasDelRango('2026-11-01', '2026-11-01')).toBe(1);
    expect(diasDelRango('2026-11-01', '2026-11-30')).toBe(30);
  });

  it('inicioDelDia y finDelDia caen dentro del día argentino', () => {
    // 00:00 y 23:59:59.999 de Buenos Aires son 03:00 y 02:59:59.999 UTC.
    expect(inicioDelDia('2026-11-11').toISOString()).toBe(
      '2026-11-11T03:00:00.000Z',
    );
    expect(finDelDia('2026-11-11').toISOString()).toBe(
      '2026-11-12T02:59:59.999Z',
    );
  });

  describe('lunesDeLaSemana', () => {
    it('devuelve el lunes de la misma semana', () => {
      // 11/11/2026 es miércoles y 15/11/2026 es domingo.
      expect(lunesDeLaSemana('2026-11-11')).toBe('2026-11-09');
      expect(lunesDeLaSemana('2026-11-15')).toBe('2026-11-09');
      expect(lunesDeLaSemana('2026-11-09')).toBe('2026-11-09');
    });
  });

  describe('claveDe', () => {
    it('devuelve el día, el mes o la semana ISO', () => {
      expect(claveDe('2026-11-11', 'dia')).toBe('2026-11-11');
      expect(claveDe('2026-11-11', 'mes')).toBe('2026-11');
      expect(claveDe('2026-11-11', 'semana')).toBe('2026-W46');
    });

    it('asigna la semana del 31/12 al año ISO que corresponde', () => {
      // La semana del 28/12/2026 al 3/1/2027 es la última de 2026.
      expect(claveDe('2026-12-31', 'semana')).toBe('2026-W53');
      // El 1/1/2027 (viernes) sigue en esa misma semana.
      expect(claveDe('2027-01-01', 'semana')).toBe('2026-W53');
    });
  });

  it('etiquetaDe arma una etiqueta corta por agrupación', () => {
    expect(etiquetaDe('2026-11-11', 'dia')).toBe('11 nov');
    expect(etiquetaDe('2026-11', 'mes')).toBe('nov 2026');
    expect(etiquetaDe('2026-W46', 'semana')).toBe('sem. 46');
  });

  describe('armarPeriodos', () => {
    it('devuelve un período por día, en orden', () => {
      const periodos = armarPeriodos('2026-11-01', '2026-11-03', 'dia');

      expect(periodos.map((periodo) => periodo.clave)).toEqual([
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ]);
      expect(periodos[0].etiqueta).toBe('1 nov');
      expect(periodos[0].desde.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    });

    it('recorta el primer y el último período al rango pedido', () => {
      const periodos = armarPeriodos('2026-10-29', '2026-11-04', 'semana');

      expect(periodos).toHaveLength(2);
      expect(periodos[0].clave).toBe('2026-W44');
      expect(periodos[0].desde.toISOString()).toBe('2026-10-29T03:00:00.000Z');
      expect(periodos[0].hasta.toISOString()).toBe('2026-11-02T02:59:59.999Z');
      expect(periodos[1].clave).toBe('2026-W45');
      expect(periodos[1].hasta.toISOString()).toBe('2026-11-05T02:59:59.999Z');
    });

    it('agrupa por mes sin repetir claves', () => {
      const periodos = armarPeriodos('2026-10-15', '2026-11-02', 'mes');

      expect(periodos.map((periodo) => periodo.clave)).toEqual([
        '2026-10',
        '2026-11',
      ]);
      expect(periodos[0].hasta.toISOString()).toBe('2026-11-01T02:59:59.999Z');
      expect(periodos[1].hasta.toISOString()).toBe('2026-11-03T02:59:59.999Z');
    });
  });

  describe('completarSerie', () => {
    it('rellena con 0 los períodos sin documentos', () => {
      const periodos = armarPeriodos('2026-11-01', '2026-11-04', 'dia');
      const serie = completarSerie(
        periodos,
        new Map([['2026-11-02', 3]]),
      );

      expect(serie.map((punto) => punto.total)).toEqual([0, 3, 0, 0]);
      expect(serie[1]).toEqual({
        clave: '2026-11-02',
        etiqueta: '2 nov',
        desde: '2026-11-02T03:00:00.000Z',
        hasta: '2026-11-03T02:59:59.999Z',
        total: 3,
      });
    });
  });
});
