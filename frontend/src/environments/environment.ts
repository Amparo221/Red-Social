/**
 * Configuración para desarrollo (`ng serve`).
 * `apiUrl` es la base del backend NestJS que corre en el puerto 3000. El
 * backend monta sus rutas bajo /api (`app.setGlobalPrefix('api')` en
 * `backend/src/main.ts`), igual que en producción.
 */
export const environment = {
  produccion: false,
  apiUrl: 'http://localhost:3000/api',
};
