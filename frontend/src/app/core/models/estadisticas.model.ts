/**
 * Tipos y reglas del dashboard de estadísticas (Sprint 5).
 * Reflejan el contrato de `GET /api/estadisticas`
 * (backend/src/estadisticas/estadisticas.service.ts).
 */

export type Agrupacion = 'dia' | 'semana' | 'mes';

/** Opciones del selector de granularidad. */
export const AGRUPACIONES: { valor: Agrupacion; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Por día' },
  { valor: 'semana', etiqueta: 'Por semana' },
  { valor: 'mes', etiqueta: 'Por mes' },
];

/** Botones de rango rápido. `personalizado` deja las fechas a mano. */
export type PresetRango = '7d' | '30d' | '90d' | 'anio' | 'personalizado';

export const PRESETS_RANGO: { valor: PresetRango; etiqueta: string; dias: number }[] = [
  { valor: '7d', etiqueta: '7 días', dias: 7 },
  { valor: '30d', etiqueta: '30 días', dias: 30 },
  { valor: '90d', etiqueta: '90 días', dias: 90 },
  { valor: 'anio', etiqueta: 'Último año', dias: 365 },
];

export const RANGO_POR_DEFECTO: PresetRango = '30d';

/** Filas de los rankings (igual que el valor por defecto del backend). */
export const ESTADISTICAS_LIMITE = 10;

/** Techo del backend: un rango más largo se rechaza con 400. */
export const RANGO_MAXIMO_DIAS = 366;

/** Top de usuarios que más publicaron en el rango. */
export interface PublicacionesPorUsuario {
  usuarioId: string;
  nombre: string;
  nombreUsuario: string;
  total: number;
}

/** Un punto de la serie temporal de comentarios. */
export interface ComentariosPorPeriodo {
  clave: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  total: number;
}

/** Top de publicaciones que más comentarios recibieron. */
export interface ComentariosPorPublicacion {
  publicacionId: string;
  titulo: string;
  autor: string;
  /** Se dio de baja después de recibir los comentarios. */
  eliminada: boolean;
  total: number;
}

export interface TotalesEstadisticas {
  publicaciones: number;
  usuariosConPublicaciones: number;
  comentarios: number;
  publicacionesConComentarios: number;
}

export interface EstadisticasResponse {
  rango: {
    desde: string;
    hasta: string;
    agrupacion: Agrupacion;
    limite: number;
  };
  totales: TotalesEstadisticas;
  publicacionesPorUsuario: PublicacionesPorUsuario[];
  comentariosPorPeriodo: ComentariosPorPeriodo[];
  comentariosPorPublicacion: ComentariosPorPublicacion[];
}

/** Parámetros de la consulta. */
export interface ConsultaEstadisticas {
  desde: string;
  hasta: string;
  agrupacion: Agrupacion;
  limite?: number;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Día `AAAA-MM-DD` en la hora local del navegador. */
export function diaLocal(fecha: Date = new Date()): string {
  const anio = String(fecha.getFullYear());
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Fecha local de un `AAAA-MM-DD`.
 *
 * Se arma con el constructor `(año, mes, día)` y no con `new Date('AAAA-MM-DD')`
 * (que es medianoche UTC): así el día no se corre en husos negativos.
 */
export function fechaDeDia(dia: string): Date {
  const [anio, mes, diaMes] = dia.split('-').map(Number);
  return new Date(anio, mes - 1, diaMes);
}

/** Suma (o resta, con `dias` negativo) días a un `AAAA-MM-DD`. */
export function sumarDias(dia: string, dias: number): string {
  const fecha = fechaDeDia(dia);
  fecha.setDate(fecha.getDate() + dias);
  return diaLocal(fecha);
}

/** Cantidad de días del rango, contando los dos extremos. */
export function diasDelRango(desde: string, hasta: string): number {
  const diferencia = fechaDeDia(hasta).getTime() - fechaDeDia(desde).getTime();
  // `round` absorbe el cambio de hora de los husos con horario de verano.
  return Math.round(diferencia / MS_POR_DIA) + 1;
}

/** Rango de un preset; `null` para `personalizado` (lo elige el usuario). */
export function rangoDePreset(
  preset: PresetRango,
  hoy: Date = new Date(),
): { desde: string; hasta: string } | null {
  const elegido = PRESETS_RANGO.find((opcion) => opcion.valor === preset);
  if (!elegido) {
    return null;
  }

  const hasta = diaLocal(hoy);
  return { desde: sumarDias(hasta, -(elegido.dias - 1)), hasta };
}

/**
 * Granularidad que tiene sentido para el rango: con 7 días se lee por día, con
 * un año conviene agrupar por mes. El usuario la puede cambiar igual.
 */
export function agrupacionSugerida(desde: string, hasta: string): Agrupacion {
  const dias = diasDelRango(desde, hasta);
  if (dias <= 31) {
    return 'dia';
  }
  if (dias <= 120) {
    return 'semana';
  }
  return 'mes';
}

/** Etiqueta de un preset (para `aria-pressed` y textos de ayuda). */
export function etiquetaDeAgrupacion(agrupacion: Agrupacion): string {
  return AGRUPACIONES.find((opcion) => opcion.valor === agrupacion)?.etiqueta ?? agrupacion;
}

/** "Del 12/10/2026 al 11/11/2026", para el encabezado del dashboard. */
export function textoDelRango(desde: string, hasta: string): string {
  return `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

function fechaCorta(dia: string): string {
  const [anio, mes, diaMes] = dia.split('-');
  return `${diaMes}/${mes}/${anio}`;
}
