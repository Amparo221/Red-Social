/**
 * Fechas y agrupación del dashboard de estadísticas (Sprint 5).
 *
 * Todo lo de acá es puro (sin Mongo ni Nest) para poder testearlo sin levantar
 * la app. La zona horaria es la de Argentina porque el TP se corrige acá: si
 * agrupáramos en UTC, un comentario de las 22:30 del 10/11 caería en el día 11
 * y el gráfico mostraría un pico que no existe.
 */

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/** Argentina no aplica horario de verano: el desfase es siempre -03:00. */
export const DESFASE_ARGENTINA = '-03:00';

export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Granularidades que acepta `GET /estadisticas?agrupacion=`. */
export const AGRUPACIONES = ['dia', 'semana', 'mes'] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number];

/**
 * Formato de `$dateToString` para cada agrupación. Tiene que devolver
 * EXACTAMENTE la misma clave que `claveDe()`, si no el cero-relleno del servicio
 * no encuentra los totales que devuelve Mongo.
 *
 * - `%G`/`%V`: año y semana ISO 8601 (la semana empieza el lunes).
 */
export const FORMATOS_MONGO: Record<Agrupacion, string> = {
  dia: '%Y-%m-%d',
  semana: '%G-W%V',
  mes: '%Y-%m',
};

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const PATRON_DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Un período del eje X: su clave, su etiqueta y el tramo real que abarca. */
export interface Periodo {
  clave: string;
  etiqueta: string;
  desde: Date;
  hasta: Date;
}

/** Punto que consume el gráfico (fechas en ISO para que viaje por JSON). */
export interface PuntoSerie {
  clave: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  total: number;
}

/** true si el string ya es un día `AAAA-MM-DD` (sin hora). */
export function esDiaIso(valor: string): boolean {
  return PATRON_DIA_ISO.test(valor);
}

/**
 * Día `AAAA-MM-DD` de un instante, en hora argentina.
 *
 * `en-CA` es el locale que formatea justo en ese orden; usarlo evita armar el
 * string a mano con `getMonth() + 1` y compañía.
 */
export function diaEnArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/**
 * Lleva lo que llegó por query string a un día `AAAA-MM-DD`.
 *
 * Un `2026-11-11` se toma tal cual: convertirlo con `new Date('2026-11-11')` lo
 * interpretaría como medianoche UTC, que en Argentina todavía es el día 10.
 * Si viene con hora (ISO completo) sí se convierte a la fecha argentina.
 */
export function normalizarDia(valor: string): string {
  const texto = valor.trim();
  return esDiaIso(texto) ? texto : diaEnArgentina(new Date(texto));
}

/** Primer instante del día en Argentina. */
export function inicioDelDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000${DESFASE_ARGENTINA}`);
}

/** Último instante del día en Argentina (el `$lte` del filtro). */
export function finDelDia(dia: string): Date {
  return new Date(`${dia}T23:59:59.999${DESFASE_ARGENTINA}`);
}

/** Suma (o resta, con `dias` negativo) días a un `AAAA-MM-DD`. */
export function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Cantidad de días del rango, contando los dos extremos. */
export function diasDelRango(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00.000Z`).getTime();
  const fin = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Math.round((fin - inicio) / MS_POR_DIA) + 1;
}

/** Lunes de la semana ISO a la que pertenece el día. */
export function lunesDeLaSemana(dia: string): string {
  const fecha = new Date(`${dia}T00:00:00.000Z`);
  // getUTCDay() devuelve 0 para domingo; la semana ISO lo cuenta como día 7.
  const diaSemana = fecha.getUTCDay() || 7;
  fecha.setUTCDate(fecha.getUTCDate() - (diaSemana - 1));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Clave del período al que pertenece un día. Es el contrato con `$dateToString`
 * (ver `FORMATOS_MONGO`): ambas partes tienen que producir lo mismo.
 */
export function claveDe(dia: string, agrupacion: Agrupacion): string {
  if (agrupacion === 'dia') {
    return dia;
  }

  if (agrupacion === 'mes') {
    return dia.slice(0, 7);
  }

  // Semana ISO: el año de la clave es el del lunes (una semana que arranca el
  // 29/12 pertenece al año siguiente).
  const lunes = lunesDeLaSemana(dia);
  const { semana, anio } = semanaIso(lunes);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

/** Etiqueta corta para el eje X. */
export function etiquetaDe(clave: string, agrupacion: Agrupacion): string {
  if (agrupacion === 'dia') {
    const mes = Number(clave.slice(5, 7));
    return `${Number(clave.slice(8, 10))} ${MESES_CORTOS[mes - 1]}`;
  }

  if (agrupacion === 'mes') {
    const mes = Number(clave.slice(5, 7));
    return `${MESES_CORTOS[mes - 1]} ${clave.slice(0, 4)}`;
  }

  return `sem. ${Number(clave.slice(6))}`;
}

/**
 * Arma la lista de períodos del rango, sin huecos y en orden cronológico.
 *
 * Se recorre día por día (el servicio limita el rango a 366 días) y se agrupa
 * por clave. `desde`/`hasta` de cada período quedan recortados al rango pedido:
 * si el rango empieza un miércoles, la primera semana arranca ese miércoles.
 */
export function armarPeriodos(
  desde: string,
  hasta: string,
  agrupacion: Agrupacion,
): Periodo[] {
  const periodos: Periodo[] = [];

  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    const clave = claveDe(dia, agrupacion);
    const ultimo = periodos[periodos.length - 1];

    if (ultimo?.clave === clave) {
      ultimo.hasta = finDelDia(dia);
    } else {
      periodos.push({
        clave,
        etiqueta: etiquetaDe(clave, agrupacion),
        desde: inicioDelDia(dia),
        hasta: finDelDia(dia),
      });
    }
  }

  return periodos;
}

/**
 * Cruza los períodos con lo que devolvió Mongo: los que no tienen documentos
 * quedan en 0. Sin este paso el gráfico de líneas "saltea" los días sin
 * comentarios y la pendiente miente.
 */
export function completarSerie(
  periodos: readonly Periodo[],
  totalesPorClave: ReadonlyMap<string, number>,
): PuntoSerie[] {
  return periodos.map((periodo) => ({
    clave: periodo.clave,
    etiqueta: periodo.etiqueta,
    desde: periodo.desde.toISOString(),
    hasta: periodo.hasta.toISOString(),
    total: totalesPorClave.get(periodo.clave) ?? 0,
  }));
}

/** Año y semana ISO 8601 de un día (necesita ser lunes para el cálculo). */
function semanaIso(lunes: string): { anio: number; semana: number } {
  const fecha = new Date(`${lunes}T00:00:00.000Z`);
  // El jueves de la semana define a qué año ISO pertenece la semana.
  const jueves = new Date(fecha.getTime() + 3 * MS_POR_DIA);
  const anio = jueves.getUTCFullYear();
  const primeroDeAnio = new Date(Date.UTC(anio, 0, 1));
  const semana =
    Math.floor((jueves.getTime() - primeroDeAnio.getTime()) / MS_POR_DIA / 7) + 1;

  return { anio, semana };
}
