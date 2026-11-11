# IdentiBird · Frontend (Sprint 2)

Aplicación Angular del trabajo práctico de red social. Consume la API NestJS de
`../backend`: registro, login y el feed de **publicaciones** (crear, listar con
paginación/orden, dar y quitar me gusta, eliminar). No hay datos mockeados.

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

| Ruta             | Pantalla       | Detalle                                                                 |
| ---------------- | -------------- | ----------------------------------------------------------------------- |
| `/publicaciones` | Publicaciones  | **Pantalla principal.** Feed + compositor para publicar. Protegida.     |
| `/publicaciones/:id` | Publicación | **Detalle** de una publicación (Sprint 3) + sección de comentarios. Protegida. |
| `/login`         | Ingresar       | Correo **o** nombre de usuario + contraseña.                            |
| `/registro`      | Crear cuenta   | Formulario completo, con foto de perfil opcional y vista previa.        |
| `/inicio`        | Mi perfil      | Datos del usuario logueado y sus publicaciones con los comentarios en sólo lectura. Protegida por `sesionGuard`. |
| `''` y `**`      | → `/publicaciones` | El guard manda a `/login` si no hay sesión, así que entrar sin cuenta termina siempre en el login. |

Después del login y del registro se entra siempre a `/publicaciones`; el registro
agrega `?bienvenida=1` y el feed muestra ahí el saludo de cuenta creada.

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

### Feed de publicaciones (Sprint 2)

Todas estas rutas exigen `Authorization: Bearer <token>` (lo agrega el
`authInterceptor`, ver [Sesión y JWT](#sesión-y-jwt)).

| Acción        | Método y ruta                        | Cuerpo / query                                                                                   | Respuesta |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ | --------- |
| Listar feed   | `GET /api/publicaciones`             | `offset` (0), `limit` (6), `orden` (`fecha` \| `likes`), `usuario` (id del autor)                | `200` + `{ total, offset, limit, orden, hayMas, publicaciones[] }` |
| Crear         | `POST /api/publicaciones`            | `multipart/form-data`: `titulo`, `descripcion`, `nombreComun`, `nombreCientifico` (opcionales), `imagen` (archivo opcional) | `201` + publicación |
| Dar me gusta  | `POST /api/publicaciones/:id/like`   | —                                                                                                | `201` + `{ id, cantidadLikes, likeado: true }` |
| Quitar me gusta | `DELETE /api/publicaciones/:id/like` | —                                                                                              | `200` + `{ id, cantidadLikes, likeado: false }` |
| Eliminar      | `DELETE /api/publicaciones/:id`      | —                                                                                                | `200` + `{ id, eliminado: true, fechaEliminacion }` |

Cada publicación llega con `id`, `titulo`, `descripcion`, `nombreComun`,
`nombreCientifico`, `imagenUrl`, `usuario` (autor populado: `id`, `nombre`,
`apellido`, `nombreUsuario`, `imagenPerfilUrl`), `cantidadLikes`, `likeado`
(calculado para el usuario del token), `eliminado`, `createdAt` y `updatedAt`.

Decisiones del feed:

- **Compositor siempre visible** arriba de la lista, sin modal ni pantalla aparte.
  La publicación creada se inserta al principio sin recargar el feed.
- **"Cargar más"** en vez de scroll infinito: `offset = publicaciones ya
  mostradas`, así no se repiten ni se saltean filas cuando alguien publica o
  borra en el medio (además se deduplica por `id` al agregar la página).
- **Chips de orden**: `Recientes` (`orden=fecha`), `Más gustadas`
  (`orden=likes`) y `Mías` (`usuario=<mi id>`).
- **Me gusta optimista**: la tarjeta cambia al instante y se confirma con la
  respuesta del backend; si falla se revierte. Un `409` (dos pestañas, doble
  request) deja el cambio y muestra el mensaje del backend.
- **Eliminar en dos pasos** dentro de la tarjeta (sin `confirm()` del navegador),
  visible sólo para el autor o para un `perfil: 'administrador'`, que es la misma
  regla que aplica el backend.
- Sin foto la tarjeta se muestra sólo con texto.

Errores que el frontend traduce (`src/app/core/utils/error-http.util.ts`):

| Estado | Qué muestra la pantalla                                                                         |
| ------ | ----------------------------------------------------------------------------------------------- |
| `400`  | La lista de mensajes del `ValidationPipe` (una por campo inválido)                               |
| `401`  | En el login: `Usuario/correo o contraseña incorrectos.` En una pantalla privada: la sesión venció (y el interceptor manda al login) |
| `403`  | El mensaje del backend (`Solo el autor de la publicación o un administrador pueden eliminarla`)  |
| `404`  | El mensaje del backend (`La publicación no existe`)                                              |
| `409`  | El mensaje del backend: `El correo ya está registrado`, `El nombre de usuario ya está en uso`, `Ya le diste me gusta a esta publicación` |
| `413`  | `La imagen no puede superar los 5 MB.`                                                           |
| `500`  | El mensaje del backend (`No se pudo crear el usuario`, `No se pudo subir la imagen`). Si el filtro global agregó `detalle`, esa causa real se ve en DevTools → **Network** → la request → **Response** |
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

### Sesión y JWT

El login y el registro devuelven `{ ...usuario, token }`. El frontend guarda ese
objeto completo en `localStorage` bajo `identibird.sesion` y lo expone como
signal (`AuthService.usuarioActual` y `tokenActual`), así un F5 no cierra la
sesión.

- **`authInterceptor`** (`src/app/core/interceptors/auth.interceptor.ts`) agrega
  `Authorization: Bearer <token>` a toda request que vaya a `environment.apiUrl`,
  salvo las públicas: `/auth/login`, `/auth/registro` y `/auth/sesion`.
- El JWT dura lo que indique `JWT_EXPIRES_IN` del backend (por defecto **900 s =
  15 minutos**). Cambiarlo en el `.env` obliga a reiniciar el backend, y en Vercel
  a cargar la variable y **volver a desplegar** (ver `../backend/README.md`).
  Cuando una ruta protegida responde `401`, el interceptor cierra la sesión y
  navega a `/login?sesion=expirada`; el login arranca mostrando esa alerta.
- El **splash de arranque** valida el token guardado con `GET /auth/autorizar`, y
  un **cronómetro** derivado del `exp` del JWT avisa antes del vencimiento y
  permite extender la sesión (`POST /auth/refrescar`). Los tiempos los manda el
  backend en `GET /auth/sesion`; ver *Splash de arranque y aviso de sesión*.
- Una sesión guardada sin `token` (las del Sprint 1, bajo `identibird.usuario`)
  se descarta al arrancar: esas requests ya no sirven porque el backend exige el
  Bearer.
- `sesionGuard` usa ese mismo signal para no mostrar pantallas privadas sin
  sesión. **No es seguridad real**: la validación la hace el `JwtAuthGuard` del
  backend en cada request.

### Splash de arranque y aviso de sesión (Sprint 4)

El front **no hardcodea** los tiempos: los pide a `GET /auth/sesion`, que
devuelve `{ expiracionSegundos, avisoSegundos }` calculados en el backend desde
`JWT_EXPIRES_IN` y `SESION_AVISO_SEGUNDOS`.

| Pieza | Archivo | Qué hace |
| ----- | ------- | -------- |
| Splash | `app.ts` / `app.html` / `app.css` (`.splash`) | Si hay sesión guardada, tapa la pantalla mientras `GET /auth/autorizar` valida el token. `forkJoin` espera **dos** cosas: la validación y el mínimo de `environment.cargaMinimaMs` (2 s en desarrollo, 0 en producción), y el `finalize` lo apaga incluso si la validación falla. Sin sesión no aparece |
| Cronómetro | `core/services/sesion-timer.service.ts` | Deriva los segundos restantes del **`exp` del JWT** (`core/utils/jwt.util.ts`) con un `setInterval` de 1 s que se reinicia solo cuando cambia el token, así un F5 o un token renovado no lo desincronizan |
| Aviso | `compartidos/modal-sesion/` | Modal (`role="dialog"`, foco en el botón principal) que aparece cuando quedan `avisoSegundos` o menos. **Extender sesión** → `POST /auth/refrescar`; **Cerrar sesión** → logout. Vive en el shell (`app.html`) pero se monta con `@if (!cargandoInicial())`: el reloj no existe hasta que el splash terminó de validar el token, así el modal (z-index 200) no tapa el splash (z-index 100) ni dispara el aviso por un `exp` que el backend todavía no confirmó |
| Vencimiento | `sesion-timer.service.ts` | Al llegar a 0 (o si el refresco falla) cierra la sesión y navega a `/login?sesion=expirada`, el mismo destino que usa el 401 |

`AuthService` suma `validarSesion()`, `refrescar()` y `politicaSesion()` (esta
última cachea la respuesta: los tiempos no cambian en caliente). Si
`/auth/sesion` no responde, se usan `POLITICA_SESION_POR_DEFECTO` (900 s / 300 s),
los mismos defaults del backend.

El splash muestra la marca en **texto** (`Identi` + `Bird`) y usa
`public/feather.png` como spinner: la imagen gira con `@keyframes splash-girar`
(con `prefers-reduced-motion` queda quieta). No lleva el logo de la app.

## Estructura

```
src/
├─ index.html                     favicon (identibird-32.png / identibird.png) y <title>IdentiBird</title>
├─ styles.css                     paleta celeste + verde + clases base (tarjeta, campo, botón…)
├─ environments/                  apiUrl por entorno (fileReplacements en angular.json)
└─ app/
   ├─ app.ts / app.html / app.css shell: header con logo, nav (Publicaciones / Mi perfil / Salir) y footer
   ├─ app.config.ts               provideRouter + provideHttpClient(withFetch(), withInterceptors([authInterceptor]))
   ├─ app.routes.ts               publicaciones (inicial), login, registro, inicio (lazy) + guard
   ├─ core/
   │  ├─ models/usuario.model.ts  tipos del contrato, Sesion (usuario + token), avatar y perfil
   │  ├─ models/publicacion.model.ts tipos del feed + helpers (autorDe, nombreAutor, esAutor) y de comentarios (paginado, editado, permisos)
   │  ├─ services/auth.service.ts registrar(), login(), cerrarSesion(), validarSesion(), refrescar(), politicaSesion()
   │  ├─ services/publicaciones.service.ts listar(), crear(), obtenerUno(), like/unlike, eliminar() + comentarios (listar paginado, crear, editar, eliminar)
   │  ├─ services/sesion-timer.service.ts reloj de la sesión (exp del JWT): aviso, extender, expirar
   │  ├─ interceptors/auth.interceptor.ts Bearer del JWT + 401 → logout
   │  ├─ utils/error-http.util.ts traducción de errores HTTP a mensajes
   │  ├─ utils/fecha.util.ts      "hace 5 min" para las tarjetas
   │  ├─ utils/jwt.util.ts        payload del JWT: vencimiento y segundos restantes
   │  ├─ utils/imagen.util.ts     validación de la foto (tipo y 5 MB) compartida
   │  └─ guards/sesion.guard.ts   protege /publicaciones y /inicio
   ├─ compartidos/modal-sesion/   aviso de sesión por vencer (cuenta regresiva, extender, cerrar)
   └─ pages/
      ├─ publicaciones/          feed: estado, filtros y paginación (+ spec)
      │  ├─ publicacion-card/    tarjeta: autor, foto, me gusta y borrar en dos pasos
      │  ├─ comentarios/         <app-comentarios>: lista paginada, alta, edición y borrado (+ spec)
      │  └─ compositor/          formulario para publicar (texto + foto opcional)
      ├─ publicacion/            detalle: publicación completa, me gusta y borrar (+ spec)
      ├─ login/       formulario de ingreso
      ├─ registro/    formulario de alta + subida de foto
      └─ inicio/      perfil: datos del usuario y sus publicaciones con comentarios (sólo lectura) (+ spec)
```

## Validaciones del compositor de publicaciones

Espejo de `backend/src/publicaciones/dto/create-publicacion.dto.ts`:

| Campo              | Regla                                              |
| ------------------ | -------------------------------------------------- |
| `titulo`           | obligatorio, máximo 100                            |
| `descripcion`      | obligatorio, máximo 500                            |
| `nombreComun`      | opcional, máximo 80                                |
| `nombreCientifico` | opcional, máximo 80                                |
| `imagen`           | opcional, JPG/PNG/WEBP/GIF, hasta 5 MB (con vista previa) |

## Checklist del Sprint 2

- [x] Login y registro guardan el JWT y entran al feed.
- [x] `authInterceptor` con `Authorization: Bearer` y logout automático en 401.
- [x] Feed con paginación (`offset`/`limit`), orden por fecha o me gusta y filtro "Mías".
- [x] Publicar con título, descripción, nombres del ave y foto opcional (multipart).
- [x] Me gusta y "quitar me gusta" con actualización optimista.
- [x] Baja lógica de las publicaciones propias (o de cualquier publicación si sos administrador).
- [x] Estados de carga, vacío, error y avisos de éxito.
- [x] Tests unitarios de servicios, interceptor, utilidades y pantallas (`npm test`).

## Checklist del Sprint 3

- [x] Ruta `/publicaciones/:id` (protegida) con el detalle de la publicación.
- [x] El título de cada tarjeta del feed es un `routerLink` al detalle y **toda la
      tarjeta** también abre el detalle (el like y el borrar quedan afuera).
- [x] `PublicacionesService.obtenerUno(id)` → `GET /publicaciones/:id`.
- [x] Me gusta **optimista** con rollback si el backend falla.
- [x] Borrar en dos pasos (confirmación en la misma pantalla) y vuelta al feed.
- [x] Comentarios: listar, comentar y borrar (propios, o todos si sos administrador).
- [x] Estados de carga, error con el mensaje del backend y botón "Volver al feed".
- [x] Tests de la pantalla (carga, autor, me gusta optimista, borrado, comentarios, 404).

### Comentarios: cómo funcionan

Todo vive en **`pages/publicaciones/comentarios/comentarios-publicacion.ts`**
(`<app-comentarios [idPublicacion] [soloLectura]>`), que se usa en dos pantallas:

- el **detalle** (`pages/publicacion/`) lo monta con `soloLectura` en `false`:
  formulario, edición y borrado habilitados;
- el **perfil** (`pages/inicio/`) lo monta con `soloLectura` y `embebido` en
  `true`: sólo la lista paginada y sin recuadro propio, porque va dentro de la
  tarjeta de la publicación.

`PublicacionesService` llama a las rutas del backend (ninguna está simulada):

| Método del servicio | HTTP | Notas |
| ------------------- | ---- | ----- |
| `listarComentarios(publicacionId, { offset, limit })` | `GET /publicaciones/:id/comentarios` | Paginado: `{ total, offset, limit, hayMas, comentarios }`, del más viejo al más nuevo (`COMENTARIOS_POR_PAGINA = 3`) |
| `crearComentario(publicacionId, texto)` | `POST /publicaciones/:id/comentarios` | Body `{ texto }` recortado, 1–500; responde 201 con el comentario |
| `editarComentario(comentarioId, texto)` | `PATCH /comentarios/:id` | Sólo el autor (403 al resto); responde el comentario con `editado: true` y `fechaEdicion` |
| `eliminarComentario(comentarioId)` | `DELETE /comentarios/:id` | Baja lógica; autor o administrador (403 / 404) |

`PATCH` y `DELETE` cuelgan de `/comentarios` (no de `/publicaciones`), por eso el
servicio tiene una constante aparte, `URL_COMENTARIOS`.

El componente (`<app-comentarios>`) muestra:

- avatar, nombre, `@usuario` y fecha relativa de cada comentario;
- **"3 de 12"** en el título y un botón **Cargar más comentarios** mientras
  `hayMas` sea true. El `offset` avanza con lo que devolvió el servidor (no con lo
  que se ve) y la lista se deduplica por `id`, por si alguien borró un comentario
  mientras se paginaba;
- el badge **editado** (con la fecha de edición en el `title`) cuando el
  comentario se editó alguna vez;
- **Editar** sólo en los comentarios propios (`puedeEditarComentario`: el
  administrador modera, pero no reescribe textos ajenos) y **Eliminar** en los
  propios o en todos si la sesión es de administrador (`esAutorComentario`, que
  espeja la regla del backend);
- la edición en línea con contador de caracteres y **Guardar** / **Cancelar**; si
  el texto no cambió no se llama al backend;
- estados de carga, "Todavía no hay comentarios", error del backend con
  **Reintentar**.

El modelo (`core/models/publicacion.model.ts`) acepta `autor` populado **o** el id
suelto (si el autor se borró de la base), así que los helpers
`autorComentarioDe` / `nombreAutorComentario` / `esAutorComentario` /
`puedeEditarComentario` / `estaEditado` resuelven el nombre, los permisos y el
badge sin romper la vista.

### Perfil (`/inicio`)

- La sección **"Mis publicaciones"** ya no es una tarjeta: sin borde, sombra ni
  fondo, para no anidar una caja dentro de la tarjeta del perfil. Las
  publicaciones que van adentro siguen siendo tarjetas blancas.
- Se sacó el contador de publicaciones y el botón "Cerrar sesión" duplicado (el
  header ya lo tiene).
- Click en una publicación del perfil → abre el detalle.
- Cada publicación del perfil muestra **sus comentarios en sólo lectura**
  (`<app-comentarios [soloLectura]="true" [embebido]="true">`): lista paginada
  con "cargar más", sin formulario ni botones de editar/borrar.
- Los comentarios van **adentro de la tarjeta** de la publicación: se proyectan
  en el `<ng-content>` de `<app-publicacion-card>` (`.publicacion__extra`, con
  `:empty { display: none }` para no dejar hueco en el feed) y con la clase
  `comentarios--embebido` pierden borde, fondo y padding propios, así no parecen
  otra caja. El click en esa zona **no** abre el detalle
  (`$event.stopPropagation()`), para poder leer sin salir del perfil.

## Checklist del Sprint 4

- [x] Componente compartido `ComentariosPublicacion` (`<app-comentarios>`), usado
      por el detalle y por el perfil.
- [x] Comentarios paginados de a 3 (`offset`/`limit`) con botón "Cargar más" y
      contador "N de total".
- [x] Editar el comentario propio (`PATCH /comentarios/:id`) con badge "editado" y
      fecha de edición.
- [x] Borrar comentarios propios, o cualquiera si la sesión es de administrador.
- [x] El perfil muestra los comentarios en sólo lectura, con paginación.
- [x] Tests: servicio (paginado, alta, edición, borrado) y componente (lista,
      paginación, edición, permisos, errores y reintento).


## Checklist del Sprint 4 (UX de sesión)

- [x] Splash de arranque que valida el token guardado con `GET /auth/autorizar`,
      con un mínimo de 2 s en desarrollo (`environment.cargaMinimaMs`).
- [x] Cronómetro de sesión derivado del `exp` del JWT (`jwt.util`), que sobrevive
      a un F5 y se reinicia solo al renovar el token.
- [x] Modal de aviso con cuenta regresiva, **Extender sesión**
      (`POST /auth/refrescar`) y **Cerrar sesión**.
- [x] Sesión vencida (o refresco fallido) → logout y `/login?sesion=expirada`.
- [x] Tiempos configurables sólo desde el `.env` del backend (`GET /auth/sesion`)
      y `SESION_AVISO_SEGUNDOS` documentada en `../backend/README.md`.
- [x] Los comentarios del perfil se muestran **dentro** de la tarjeta de la
      publicación (`[embebido]="true"`), sin bordes ni fondo propios.
- [x] Tests nuevos: `jwt.util`, `sesion-timer.service`, `modal-sesion`, el splash
      en `app.spec` y `auth.service` (`validarSesion`, `refrescar`,
      `politicaSesion`).
- [x] El aviso de sesión no se monta durante el arranque: `app.html` lo envuelve
      en `@if (!cargandoInicial())`, así el reloj arranca recién con la sesión ya
      validada y un F5 con token por vencer muestra el splash **sin** el modal
      encima (`app.spec`: «no muestra el aviso de sesión por encima del splash
      al arrancar»).

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

