/**
 * Configuración para el build de producción (`ng build`).
 * Se cambia por la URL real del backend cuando se despliega; para el TP
 * alcanza con el backend local.
 */
export const environment = {
  produccion: true,
  apiUrl: 'http://localhost:3000',
};
