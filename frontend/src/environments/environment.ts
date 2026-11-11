/**
 * Configuración para desarrollo (`ng serve`).
 * `apiUrl` es la base del backend NestJS que corre en el puerto 3000. El
 * backend monta sus rutas bajo /api (`app.setGlobalPrefix('api')` en
 * `backend/src/main.ts`), igual que en producción.
 *
 * `cargaMinimaMs`: cuánto dura como mínimo el splash de arranque mientras se
 * valida el token guardado contra `GET /auth/autorizar`. En desarrollo son
 * 2 segundos para que la pantalla de carga se vea; en producción vale 0.
 */
export const environment = {
  produccion: false,
  apiUrl: 'http://localhost:3000/api',
  cargaMinimaMs: 2000,
};
