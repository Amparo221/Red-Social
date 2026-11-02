# IdentiBird · Frontend (Sprint 1)

Aplicación Angular del trabajo práctico de red social. Consume la API NestJS de
`../backend` para el registro y el login: no hay datos mockeados, la sesión sale
de un `POST` real al backend.

- **Angular 22** (standalone components, zoneless) + **TypeScript**
- Paleta de azules y celestes con acentos verdes claros, con el colibrí de
  `backend/assets/hummingbird.png` como icono de la app y cabecera celeste para
  que el verde del pájaro resalte
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

La URL base sale de `src/environments/environment.ts` (`apiUrl`). Las rutas del
backend están montadas bajo `/api` (`app.setGlobalPrefix('api')`), así que:

| Entorno | `apiUrl` | URL final de un login |
| ------- | -------------------------- | ------------------------------------ |
| `ng serve` (development) | `http://localhost:3000/api` | `http://localhost:3000/api/auth/login` |
| build de producción | `/api` (relativa) | `/api/auth/login` en el mismo dominio |

En producción **no** se usa un host absoluto: el proyecto de Vercel tiene dos
`services` (`backend` y `frontend`) y el `vercel.json` de la raíz reescribe
`/api/(.*)` al servicio `backend`, manteniendo el path. Al compartir dominio ya
no hay CORS de por medio (en desarrollo sí, `app.enableCors()`).

| Acción   | Método y ruta              | Cuerpo                                                                                                                                                    | Respuesta       |
| -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Registro | `POST /api/auth/registro`  | `multipart/form-data`: `nombre`, `apellido`, `correo`, `nombreUsuario`, `password`, `fechaNacimiento`, `descripcion` (opcional), `imagen` (archivo opcional) | `201` + usuario |
| Login    | `POST /api/auth/login`     | JSON: `{ identificador, password }` (`identificador` = correo o nombre de usuario)                                                                         | `200` + usuario |

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
`identibird.usuario` y lo expone como signal (`AuthService.usuarioActual`), así un
F5 no cierra la sesión.

> `sesionGuard` sólo evita mostrar `/inicio` sin sesión iniciada: **no es
> seguridad real**. Cuando el Sprint 2 agregue el token, el guard pasa a validarlo.

## Estructura

```
src/
├─ index.html                     favicon (identibird-32.png / identibird.png) y <title>IdentiBird</title>
├─ styles.css                     paleta celeste + verde + clases base (tarjeta, campo, botón…)
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

| Token          | Color     | Uso                                         |
| -------------- | --------- | ------------------------------------------- |
| `--cielo-50`   | `#f0f9ff` | fondo (inicio del degradado)                 |
| `--cielo-100`  | `#e0f2fe` | superficies, hover                           |
| `--cielo-200`  | `#bae6fd` | bordes suaves                                |
| `--cielo-300`  | `#7dd3fc` | bordes de inputs, inicio de la cabecera      |
| `--cielo-400`  | `#38bdf8` | acentos, anillo de foco, centro de la cabecera |
| `--cielo-500`  | `#0ea5e9` | botón primario, fin de la cabecera           |
| `--cielo-600`  | `#0284c7` | hover del botón primario, links              |
| `--cielo-700`  | `#0369a1` | títulos y botón primario de la cabecera      |
| `--marino-900` | `#0c4a6e` | texto principal y texto sobre la cabecera    |
| `--verde-100`  | `#dcfce7` | fondo de la etiqueta de perfil, fin del fondo |
| `--verde-500`  | `#22c55e` | verde del colibrí (referencia de la marca)   |
| `--verde-700`  | `#15803d` | texto de éxito, "Bird" de la marca, pie      |

La cabecera usa un degradado `--cielo-300 → --cielo-400 → --cielo-500` con texto
azul marino (blanco sobre celeste no llega al contraste AA) y el colibrí sobre una
chapa blanca, para que el pájaro verde no se pierda contra el fondo.

### Icono

Todos los derivados salen de `backend/assets/hummingbird.png` (512 × 512, PNG con
fondo transparente). Se recorta el margen sobrante, se cuadra el lienzo con un 6 %
de aire y se exportan en `public/`:

| Archivo             | Tamaño  | Uso                                        |
| ------------------- | ------- | ------------------------------------------ |
| `identibird.png`    | 512×512 | header (38 px) y logo de login/registro     |
| `identibird-32.png` | 32×32   | `<link rel="icon">` para navegadores viejos |
| `identibird-180.png`| 180×180 | `apple-touch-icon` (con fondo blanco: iOS pinta de negro la transparencia) |

Para regenerarlos alcanza con volver a exportar el PNG original con esos tres
tamaños (yo usé Pillow con `Image.LANCZOS`).

## Si el login devuelve "credenciales incorrectas"

El backend responde `401` a propósito tanto si el usuario no existe como si la
contraseña está mal. Revisá, en este orden:

1. Que el backend esté levantado y sin errores en su consola.
2. Que la contraseña tenga al menos 8 caracteres, una mayúscula y un número (las
   cuentas creadas antes de la normalización pueden necesitar un registro nuevo).
3. Que no se esté tipeando un espacio al final: el frontend recorta, pero si el
   password original tenía espacios intermedios no van a coincidir.

## Despliegue en Vercel

El repo se despliega como **un solo proyecto de Vercel con dos `services`**
(`vercel.json` en la raíz):

| Servicio   | Root        | Framework | Expuesto en |
| ---------- | ----------- | --------- | ----------- |
| `backend`  | `backend/`  | `nestjs`  | `/api/(.*)` |
| `frontend` | `frontend/` | `angular` | `/(.*)`     |

Ambos comparten dominio, así que el build de producción usa `apiUrl: '/api'`
(relativa) y el rewrite manda esas requests al servicio `backend`. Los dos
servicios son públicos porque el navegador es el que llama a la API; no hay
`bindings` (las bindings sólo existen para código server-side en runtime y este
frontend es una SPA estática, sin SSR).

Para probar el proyecto completo en local hace falta la CLI:

```powershell
npm i -g vercel
vercel dev      # levanta los dos services y aplica los rewrites
```

Las variables de entorno del backend (`MONGODB_URI`, `CLOUD_NAME`, etc.) se
cargan en la configuración del proyecto de Vercel; ver `../backend/README.md`.

