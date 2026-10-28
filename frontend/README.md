# Purplegram · Frontend (Sprint 1)

Aplicación Angular del trabajo práctico de red social. Consume la API NestJS de
`../backend` para el registro y el login: no hay datos mockeados, la sesión sale
de un `POST` real al backend.

- **Angular 22** (standalone components, zoneless) + **TypeScript**
- Paleta púrpura clara, con el racimo de uvas de `backend/assets/grape.png` como
  icono de la app
- Estilos globales en `src/styles.css` (variables CSS reutilizadas por todos los
  componentes)
- Tests unitarios con **Vitest** (el runner que trae Angular 22)

## Requisitos

1. Node 20+ y npm.
2. El backend corriendo en `http://localhost:3000` (ver `../backend/README.md`):

   ```powershell
   cd ..\backend
   npm run start:dev
   ```

## Cómo levantar el frontend

```powershell
cd frontend
npm install         # sólo la primera vez
npm start           # ng serve → http://localhost:4200
```

Otros comandos:

| Comando         | Qué hace                                                      |
| --------------- | ------------------------------------------------------------- |
| `npm start`     | servidor de desarrollo con recarga en `http://localhost:4200`  |
| `npm run build` | build de producción en `dist/frontend`                         |
| `npm test`      | tests unitarios con Vitest                                     |

## Pantallas y rutas

| Ruta        | Pantalla                | Detalle                                                          |
| ----------- | ----------------------- | ---------------------------------------------------------------- |
| `/login`    | Ingresar                | Correo **o** nombre de usuario + contraseña. Ruta inicial.        |
| `/registro` | Crear cuenta            | Formulario completo, con foto de perfil opcional y vista previa.  |
| `/inicio`   | Mi perfil               | Datos del usuario logueado. Protegida por `sesionGuard`.          |
| `**`        | redirección a `/login`  | Cualquier ruta desconocida vuelve al login.                       |

## Conexión con el backend

La URL base sale de `src/environments/environment.ts` (`apiUrl`), que apunta a
`http://localhost:3000`. El CORS ya está habilitado en el backend
(`app.enableCors()` en `backend/src/main.ts`), así que no hace falta proxy.

| Acción   | Método y ruta         | Cuerpo                                                                                                                                                    | Respuesta       |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Registro | `POST /auth/registro` | `multipart/form-data`: `nombre`, `apellido`, `correo`, `nombreUsuario`, `password`, `fechaNacimiento`, `descripcion` (opcional), `imagen` (archivo opcional) | `201` + usuario |
| Login    | `POST /auth/login`    | JSON: `{ identificador, password }` (`identificador` = correo o nombre de usuario)                                                                         | `200` + usuario |

Errores que el frontend traduce (`src/app/core/utils/error-http.util.ts`):

| Estado | Qué muestra la pantalla                                                                         |
| ------ | ----------------------------------------------------------------------------------------------- |
| `400`  | La lista de mensajes del `ValidationPipe` (una por campo inválido)                               |
| `401`  | `Usuario/correo o contraseña incorrectos.` (mensaje genérico a propósito)                        |
| `409`  | El mensaje del backend: `El correo ya está registrado` / `El nombre de usuario ya está en uso`   |
| `413`  | `La imagen no puede superar los 5 MB.`                                                           |
| `0`    | `No pudimos conectarnos con el servidor…` (backend apagado)                                      |

### Detalles del contrato que el frontend respeta

- El registro se manda como **multipart**: si se envía JSON, el `FileInterceptor`
  del backend no encuentra el archivo `imagen`.
- No se setea `Content-Type` a mano: lo completa el navegador con el boundary.
- La contraseña y el resto de los textos se recortan (`trim()`) antes de enviarse,
  igual que hace el backend. El correo y el nombre de usuario se guardan en
  minúsculas, así que el login no depende de las mayúsculas.
- `fechaNacimiento` viaja como `AAAA-MM-DD` (lo que devuelve `<input type="date">`).
- La imagen es **opcional**: si no se sube, el backend guarda su avatar por defecto.

### Sesión

El backend del Sprint 1 todavía **no emite JWT**: lo que devuelve el login es el
usuario público (`id`, `nombre`, `correo`, `nombreUsuario`, `imagenPerfilUrl`,
`perfil`, …). El frontend guarda ese objeto en `localStorage` bajo la clave
`purplegram.usuario` y lo expone como signal (`AuthService.usuarioActual`), así un
F5 no cierra la sesión.

> `sesionGuard` sólo evita mostrar `/inicio` sin sesión iniciada: **no es
> seguridad real**. Cuando el Sprint 2 agregue el token, el guard pasa a validarlo.

## Estructura

```
src/
├─ index.html                     favicon (grape.png) y <title>Purplegram</title>
├─ styles.css                     paleta púrpura clara + clases base (tarjeta, campo, botón…)
├─ environments/                  apiUrl por entorno (fileReplacements en angular.json)
└─ app/
   ├─ app.ts / app.html / app.css shell: header con logo, nav y footer
   ├─ app.config.ts               provideRouter + provideHttpClient(withFetch())
   ├─ app.routes.ts               login, registro, inicio (lazy) + guard
   ├─ core/
   │  ├─ models/usuario.model.ts  tipos del contrato + fallback de avatar
   │  ├─ services/auth.service.ts registrar(), login(), cerrarSesion(), sesión
   │  ├─ utils/error-http.util.ts traducción de errores HTTP a mensajes
   │  └─ guards/sesion.guard.ts   protege /inicio
   └─ pages/
      ├─ login/       formulario de ingreso
      ├─ registro/    formulario de alta + subida de foto
      └─ inicio/      perfil del usuario logueado
```

## Validaciones del formulario de registro

Espejo de `backend/src/auth/dto/register.dto.ts` (el backend vuelve a validar; sus
mensajes son los que se muestran si algo se escapa del lado del cliente):

| Campo             | Regla                                                     |
| ----------------- | --------------------------------------------------------- |
| `nombre`          | obligatorio, máximo 50                                     |
| `apellido`        | obligatorio, máximo 50                                     |
| `correo`          | obligatorio, formato de email                              |
| `nombreUsuario`   | obligatorio, 3–30, sin espacios                            |
| `password`        | obligatorio, mínimo 8, al menos una mayúscula y un número  |
| `fechaNacimiento` | obligatorio                                                |
| `descripcion`     | opcional, máximo 200                                       |
| `imagen`          | opcional, JPG/PNG/WEBP/GIF, hasta 5 MB (con vista previa)  |

## Paleta

| Token        | Color     | Uso                                  |
| ------------ | --------- | ------------------------------------ |
| `--lila-50`  | `#faf5ff` | fondo (inicio del degradado)          |
| `--lila-100` | `#f3e8ff` | superficies, hover                    |
| `--lila-200` | `#e9d5ff` | bordes suaves                         |
| `--lila-300` | `#d8b4fe` | bordes de inputs                      |
| `--lila-400` | `#c084fc` | acentos y foco                        |
| `--lila-500` | `#a855f7` | botón primario                        |
| `--lila-600` | `#9333ea` | hover del botón primario, links       |
| `--lila-700` | `#7e22ce` | títulos                               |
| `--uva-900`  | `#3b0764` | texto principal                       |
| `--hoja-500` | `#22c55e` | único verde, para mensajes de éxito   |

## Si el login devuelve "credenciales incorrectas"

El backend responde `401` a propósito tanto si el usuario no existe como si la
contraseña está mal. Revisá, en este orden:

1. Que el backend esté levantado y sin errores en su consola.
2. Que la contraseña tenga al menos 8 caracteres, una mayúscula y un número (las
   cuentas creadas antes de la normalización pueden necesitar un registro nuevo).
3. Que no se esté tipeando un espacio al final: el frontend recorta, pero si el
   password original tenía espacios intermedios no van a coincidir.

