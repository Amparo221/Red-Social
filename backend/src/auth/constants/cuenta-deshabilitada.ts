/**
 * Mensaje único para las cuentas dadas de baja (Sprint 4).
 *
 * Se usa en el login, en `autorizar`/`refrescar` y en el `JwtAuthGuard`, para
 * que el usuario lea siempre lo mismo sin importar por dónde lo frenó la API.
 */
export const CUENTA_DESHABILITADA =
  'Tu cuenta está deshabilitada. Contactá a un administrador.';

/**
 * Marca que viaja en el cuerpo del error (campo `motivo`) cuando el 401 se debe
 * a una baja lógica y no a un token vencido.
 *
 * El frontend lo usa para mandar al login con el aviso correcto: si no
 * distinguiéramos los dos casos, a un usuario deshabilitado le diríamos "tu
 * sesión expiró", que no explica nada.
 */
export const MOTIVO_CUENTA_DESHABILITADA = 'CUENTA_DESHABILITADA';
