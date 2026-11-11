/**
 * Configuración para el build de producción (`ng build`).
 * En Vercel el frontend y el backend comparten dominio (proyecto con varios
 * `services`), así que la URL va relativa a propósito: el rewrite de
 * `/api/(.*)` en `vercel.json` manda esas requests al servicio `backend`.
 */
export const environment = {
  produccion: true,
  apiUrl: '/api',
  // En el deploy nadie espera de más: el splash dura sólo lo que tarde la
  // validación real del token.
  cargaMinimaMs: 0,
};
