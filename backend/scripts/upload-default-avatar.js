/**
 * Sube la imagen de perfil por defecto (assets/perfil_default.png) a Cloudinary
 * una única vez e imprime la URL pública.
 *
 * Uso:
 *   node scripts/upload-default-avatar.js
 *
 * Después, copiá la URL que imprime en DEFAULT_AVATAR_URL dentro de .env:
 * es la imagen que se guarda cuando un usuario se registra sin subir foto.
 *
 * El script corre fuera de Nest (no necesita levantar la API), así que lee el
 * .env a mano en lugar de usar ConfigService.
 */
const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

const rutaEnv = path.join(__dirname, '..', '.env');
const rutaImagen = path.join(__dirname, '..', 'assets', 'perfil_default.png');

const variables = {};
for (const linea of fs.readFileSync(rutaEnv, 'utf8').split(/\r?\n/)) {
  const limpia = linea.trim();
  if (!limpia || limpia.startsWith('#')) continue;
  const separador = limpia.indexOf('=');
  if (separador === -1) continue;
  variables[limpia.slice(0, separador).trim()] = limpia.slice(separador + 1).trim();
}

cloudinary.config({
  cloud_name: variables.CLOUD_NAME,
  api_key: variables.API_KEY,
  api_secret: variables.API_SECRET,
});

cloudinary.uploader.upload(
  rutaImagen,
  {
    folder: 'red-social/perfiles',
    public_id: 'default',
    overwrite: true,
    invalidate: true,
  },
  (error, resultado) => {
    if (error || !resultado) {
      console.error('No se pudo subir la imagen por defecto:', error);
      process.exit(1);
    }
    console.log('DEFAULT_AVATAR_URL=' + resultado.secure_url);
  },
);
