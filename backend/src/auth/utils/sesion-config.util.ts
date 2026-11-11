import { ConfigService } from '@nestjs/config';

/**
 * 15 minutos, en segundos. Es el mismo valor que usaba el Sprint 3: si la
 * variable falta, la sesión sigue durando lo de siempre.
 */
export const VENCIMIENTO_POR_DEFECTO = 15 * 60;

/** Cuánto antes del vencimiento se avisa al usuario: 5 minutos. */
export const AVISO_POR_DEFECTO = 5 * 60;

/** Tiempos de la sesión, en segundos. Los consume el front por /auth/sesion. */
export interface PoliticaSesion {
  /** Duración total del JWT. */
  expiracionSegundos: number;
  /** Cuántos segundos antes del vencimiento aparece el aviso. */
  avisoSegundos: number;
}

/**
 * Única fuente de verdad de los tiempos de la sesión.
 *
 * La usan `auth.module.ts` (para el `expiresIn` con el que se firman los
 * tokens), `AuthService.politicaSesion()` (para responder `GET /auth/sesion`)
 * y, del otro lado, el frontend: así el cronómetro, el modal de aviso y el
 * vencimiento real coinciden y se cambian sólo desde el `.env`.
 *
 * @example
 * // backend/.env
 * JWT_EXPIRES_IN=900          // la sesión dura 15 minutos
 * SESION_AVISO_SEGUNDOS=300   // el modal aparece 5 minutos antes
 */
export function leerPoliticaSesion(configService: ConfigService): PoliticaSesion {
  const expiracionSegundos = segundosValidos(
    configService.get<string>('JWT_EXPIRES_IN'),
    VENCIMIENTO_POR_DEFECTO,
  );
  const avisoSegundos = segundosValidos(
    configService.get<string>('SESION_AVISO_SEGUNDOS'),
    AVISO_POR_DEFECTO,
  );

  return {
    expiracionSegundos,
    // Un aviso más largo que la sesión lo mostraría apenas se entra: se
    // recorta a la mitad, que deja tiempo para reaccionar.
    avisoSegundos: Math.min(avisoSegundos, Math.max(1, Math.floor(expiracionSegundos / 2))),
  };
}

/** Un `.env` con `900`, vacío o basura: sólo se acepta un entero positivo. */
function segundosValidos(valor: string | undefined, porDefecto: number): number {
  const segundos = Number(valor);

  return Number.isFinite(segundos) && segundos > 0 ? Math.round(segundos) : porDefecto;
}
