/**
 * Lectura del JWT en el navegador.
 *
 * Ojo: acá **no** se valida la firma (eso lo hace el backend con el secret).
 * Sólo se decodifica el payload para saber cuándo vence el token y poder
 * avisar antes, sin inventar un contador propio que se desincronice.
 */

/** Campos del payload que usa el front (ver backend/auth/interfaces/jwt-payload.interface.ts). */
export interface PayloadJwt {
  sub?: string;
  nombreUsuario?: string;
  perfil?: string;
  /** Vencimiento en segundos desde epoch (estándar JWT). */
  exp?: number;
  /** Emisión en segundos desde epoch. */
  iat?: number;
}

/**
 * Decodifica el payload de un JWT.
 * Devuelve `null` si el token no tiene las tres partes o el payload no es JSON.
 */
export function leerPayload(token: string | null | undefined): PayloadJwt | null {
  if (!token) {
    return null;
  }

  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }

  try {
    // El payload viene en base64url: se pasa a base64, se completa el relleno
    // que saca el estándar y recién ahí atob() lo puede leer.
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(relleno)
        .split('')
        .map((caracter) => `%${caracter.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );

    return JSON.parse(json) as PayloadJwt;
  } catch {
    // Token manipulado o con otro formato: se trata como si no hubiera.
    return null;
  }
}

/**
 * Momento de vencimiento en milisegundos (`exp` viene en segundos).
 * `null` si el token no se puede leer o no trae `exp`.
 */
export function vencimientoDelToken(token: string | null | undefined): number | null {
  const exp = leerPayload(token)?.exp;

  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

/** Segundos que le quedan al token (nunca negativo; 0 si no se puede leer). */
export function segundosRestantes(
  token: string | null | undefined,
  ahora: number = Date.now(),
): number {
  const vence = vencimientoDelToken(token);

  return vence === null ? 0 : Math.max(0, Math.round((vence - ahora) / 1000));
}
