/**
 * Mueve `backend/node_modules` a la raíz del monorepo antes de que Vercel
 * empaquete la función.
 *
 * ¿Por qué?
 * El builder de Vercel para el servicio `backend` (framework `nestjs`) compila
 * con `nest build` y después toma `backend/dist` como salida: aplana su
 * contenido en la RAÍZ de la función (`/var/task/main.js`, `/var/task/app.module.js`, …),
 * pero las dependencias que rastrea con `@vercel/nft` conservan la ruta relativa
 * a la raíz del repo (`/var/task/backend/node_modules/@nestjs/common/…`).
 *
 * Resultado con `node_modules` dentro de `backend/`:
 *   - `/var/task/main.js` hace `require('@nestjs/common')`
 *   - Node busca en `/var/task/node_modules` (no existe) y sube hasta `/node_modules`
 *   - → `Cannot find module '@nestjs/common'` y la función muere al cargar,
 *     devolviendo FUNCTION_INVOCATION_FAILED en TODAS las rutas.
 *
 * Si `node_modules` vive en la raíz del repo, `@vercel/nft` lo rastrea como
 * `node_modules/…` y queda en `/var/task/node_modules/…`, justo donde el handler
 * aplanado lo busca.
 *
 * Notas:
 *  - Sólo se ejecuta en Vercel (`VERCEL=1`): en local no toca nada, así que el
 *    flujo de desarrollo (`cd backend && npm install && npm test`) no cambia.
 *  - Se invoca desde `vercel.json` → `services.backend.buildCommand`, es decir
 *    DESPUÉS de `npm run build` (así `nest build` todavía encuentra sus binarios
 *    en `backend/node_modules/.bin`).
 */
const fs = require('node:fs');
const path = require('node:path');

const origen = path.resolve(__dirname, '..', 'node_modules');
const destino = path.resolve(__dirname, '..', '..', 'node_modules');

const main = () => {
  if (!process.env.VERCEL) {
    console.log('[hoist] Fuera de Vercel: no se mueve node_modules.');
    return;
  }

  if (!fs.existsSync(origen)) {
    console.log('[hoist] No hay backend/node_modules: nada que mover.');
    return;
  }

  // Restos de un build anterior (o un node_modules en la raíz): se descarta
  // para que el movimiento sea "reemplazar", no "anidar".
  fs.rmSync(destino, { recursive: true, force: true });

  try {
    fs.renameSync(origen, destino);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    // Distinto volumen: rename no sirve, hay que copiar y borrar.
    fs.cpSync(origen, destino, { recursive: true });
    fs.rmSync(origen, { recursive: true, force: true });
  }

  console.log(`[hoist] node_modules movido a ${destino}`);
};

main();
