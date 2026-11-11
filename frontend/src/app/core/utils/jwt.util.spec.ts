import { leerPayload, segundosRestantes, vencimientoDelToken } from './jwt.util';

/**
 * Arma un JWT de mentira con el payload indicado. La firma no importa: el
 * front nunca la valida, sólo decodifica el payload.
 */
function tokenConPayload(payload: unknown): string {
  const base64url = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `cabecera.${base64url}.firma`;
}

describe('jwt.util', () => {
  const EXP = 1_800_000_000;

  it('decodifica el payload del token', () => {
    const payload = {
      sub: 'u1',
      nombreUsuario: 'anamoreno',
      perfil: 'usuario',
      exp: EXP,
      iat: EXP - 900,
    };

    expect(leerPayload(tokenConPayload(payload))).toEqual(payload);
  });

  it('devuelve null si falta el token o no tiene las tres partes', () => {
    expect(leerPayload(null)).toBeNull();
    expect(leerPayload(undefined)).toBeNull();
    expect(leerPayload('')).toBeNull();
    expect(leerPayload('solo-una-parte')).toBeNull();
    expect(leerPayload('dos.partes')).toBeNull();
  });

  it('devuelve null si el payload no es JSON (token manipulado)', () => {
    expect(leerPayload('cabecera.esto-no-es-json.firma')).toBeNull();
  });

  it('pasa el vencimiento de segundos a milisegundos', () => {
    expect(vencimientoDelToken(tokenConPayload({ exp: EXP }))).toBe(EXP * 1000);
    // Sin `exp` no hay vencimiento que leer.
    expect(vencimientoDelToken(tokenConPayload({ sub: 'u1' }))).toBeNull();
  });

  it('calcula los segundos restantes sin devolver negativos', () => {
    const token = tokenConPayload({ exp: EXP });

    expect(segundosRestantes(token, EXP * 1000 - 30_000)).toBe(30);
    expect(segundosRestantes(token, EXP * 1000)).toBe(0);
    // Ya vencido: 0 en vez de un número negativo.
    expect(segundosRestantes(token, EXP * 1000 + 60_000)).toBe(0);
    // Token ilegible: tampoco inventa tiempo.
    expect(segundosRestantes('basura')).toBe(0);
  });
});
