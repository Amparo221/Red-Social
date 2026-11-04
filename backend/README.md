# Red Social — Backend (Sprints #1 y #2)

API REST de una red social, desarrollada con **NestJS + MongoDB Atlas + Cloudinary**.

Este repositorio implementa los **Sprints #1 y #2 del backend**:

- **Sprint #1 — Usuarios**
  - **Registro de usuarios** (`POST /api/auth/registro`): validación de los datos, foto de perfil
    opcional subida a Cloudinary y contraseña encriptada con bcrypt.
  - **Login** (`POST /api/auth/login`) usando el correo **o** el nombre de usuario.
- **Sprint #2 — Publicaciones**
  - **Alta de publicación** (`POST /api/publicaciones`) con imagen opcional (Cloudinary) y datos del
    ave: `nombreComun` / `nombreCientifico`.
  - **Feed** (`GET /api/publicaciones`) con paginación (`offset`/`limit`), orden por **fecha** o por
    **cantidad de me gusta**, filtro por autor y `populate` del usuario.
  - **Me gusta**: `POST /api/publicaciones/:id/like` y `DELETE /api/publicaciones/:id/like`.
  - **Baja lógica** (`DELETE /api/publicaciones/:id`) sólo para el autor o un administrador.

> 🔐 **JWT (alcance de este sprint):** los likes y la baja necesitan saber *quién* hace el request, así
> que el login ya devuelve un `token` y las rutas de publicaciones exigen `Authorization: Bearer ...`.
> Es el mínimo indispensable; el Sprint #4 del backend completa el resto (refresh, roles, etc.).


---

## Stack

| Tecnología | Para qué se usa en el proyecto |
|---|---|
| **NestJS 12** | Framework del servidor. Arquitectura modular: `controller` (HTTP) → `service` (lógica) → `module` (ensamblado) |
| **TypeScript** | Tipado estático, compilado a **CommonJS** (ver `tsconfig.json`) |
| **MongoDB Atlas + Mongoose** | Base de datos en la nube y ODM (esquemas, modelos, `populate`) |
| **Cloudinary** | Almacenamiento de las imágenes de perfil (con CDN) |
| **bcrypt** | Hash de contraseñas con salt |
| **@nestjs/jwt** | Firma y verificación del token de sesión (`JwtModule` + `JwtService`) |
| **class-validator + class-transformer** | Validación y normalización de los datos que llegan |
| **Multer** (`@nestjs/platform-express`) | Recepción del archivo en `multipart/form-data` (en memoria) |

---

## Puesta en marcha

```bash
npm install

# 1) Copiar el ejemplo y completar con las credenciales reales
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env

# 2) Levantar en modo desarrollo (watch)
npm run start:dev           # API en http://localhost:3000
```

> **Windows / PowerShell:** si `npm` da error de "script no firmado", usá `npm.cmd`
> (`npm.cmd run start:dev`). La API ya fuerza los DNS de Google en `src/main.ts`
> (`dns.setServers`) porque en Windows la resolución SRV de Atlas falla con `querySrv ECONNREFUSED`.

### Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Servidor en modo watch (desarrollo) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run start:prod` | Ejecuta la versión compilada (`node dist/main`) |
| `npm run lint` | Linter (`oxlint`) sobre `src/` y `test/` |
| `npm run typecheck` | Chequeo de tipos de **todo** el proyecto, specs incluidos (`tsc --noEmit`) |
| `npm test` | Tests unitarios + tests HTTP con mocks (no tocan la base real) |
| `npm run test:e2e` | Sólo los e2e de `test/` (capa HTTP, con `supertest`) |
| `node scripts/upload-default-avatar.js` | Sube la imagen de perfil por defecto a Cloudinary e imprime su URL |

---

## Variables de entorno

Archivo `.env` en la raíz del backend (**no se sube al repositorio**, está en `.gitignore`).
`.env.example` documenta las mismas claves con valores de ejemplo.

| Variable | Ejemplo | Para qué sirve |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://usuario:clave@cluster0.xxxx.mongodb.net/` | Cadena de conexión a Atlas (**sin** el nombre de la base) |
| `MONGODB_DB` | `redsocial` | Nombre de la base. Si falta, se usa `redsocial` (sin esto Mongoose usaría `test`) |
| `CLOUD_NAME` | `nxux17x7` | Cuenta de Cloudinary |
| `API_KEY` | `852173512456593` | Credencial de Cloudinary |
| `API_SECRET` | `F4p-Bk2-...` | Credencial secreta de Cloudinary (nunca se sube al repo) |
| `PORT` | `3000` | Puerto del servidor |
| `DEFAULT_AVATAR_URL` | `https://res.cloudinary.com/.../default.jpg` | Imagen que se guarda cuando el usuario se registra sin foto |
| `JWT_SECRET` | `9f2c...` (96 hex) | Secret con el que se **firman** los tokens. Debe ser largo, aleatorio y el mismo en todos los entornos: si cambia, todos los tokens emitidos dejan de valer. Se genera con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `900` | Vencimiento del token **en segundos** (900 = 15 minutos). Si se omite se usa ese mismo valor |

### En Vercel

El `.env` no viaja al deploy: las mismas variables se cargan una sola vez en
**Project → Settings → Environment Variables**. No hace falta definir `PORT`
(la plataforma lo inyecta y `main.ts` ya usa `process.env.PORT`), y `dns.setServers`
sólo se aplica fuera de Vercel (`if (!process.env.VERCEL)`), porque ahí el
resolver lo administra la plataforma. La API se publica en `/api/...`: el
`vercel.json` de la raíz reescribe `/api/(.*)` al servicio `backend`.

> ⚠️ **`JWT_SECRET` es obligatorio también en Vercel.** Se lee con `getOrThrow()`, así que si falta
> el deploy falla al arrancar (y el login devolvería 500). Cargalo en *Environment Variables* y volvé
> a desplegar; si además querés conservar las sesiones abiertas en local y en producción, usá el
> **mismo** secret en los dos lados.

#### Si algo responde 500 en el deploy

Casi siempre es **un fallo de arranque**, no de una ruta: si falta `MONGODB_URI` o `JWT_SECRET`,
o si el clúster de Atlas no acepta la IP, la app no levanta y **todas** las rutas devuelven 500.

1. **`GET /api/salud`** (público) es el primer chequeo: dice si la API arrancó, si la conexión a
   Mongo está establecida, cuál es el nombre de la base y **qué variables de entorno llegaron**
   (sólo `true`/`false`, nunca los valores).
2. **Runtime Logs** (Deployments → el deployment → *Logs*, o `vercel logs <url>`) muestran el stack
   completo: `"JWT_SECRET" is not defined`, `MongooseServerSelectionError` (IP no habilitada),
   `bad auth` (usuario/contraseña), `MongoParseError` (URI con comillas o cortada).
3. **Atlas → Network Access** tiene que permitir `0.0.0.0/0`: las funciones de Vercel salen por IPs
   dinámicas. Si sólo está tu IP, en local funciona y en el deploy no.
4. **Redeploy** después de tocar variables: un deployment ya creado no toma las nuevas.

---

## Estructura del proyecto

```
backend/
├── assets/
│   ├── perfil_default.png        # imagen por defecto (fuente de verdad; se sube 1 vez a Cloudinary)
│   └── publicaciones/            # 9 fotos de aves para probar las publicaciones a mano
├── scripts/
│   └── upload-default-avatar.js  # sube esa imagen a Cloudinary e imprime su URL
├── src/
│   ├── main.ts                   # arranque: DNS, CORS, ValidationPipe, puerto
│   ├── app.module.ts             # módulo raíz: .env + conexión a Mongo + importa los módulos
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts    # rutas HTTP (registro / login)
│   │   ├── auth.service.ts       # lógica: duplicados, bcrypt, Cloudinary, login, firma del JWT
│   │   ├── auth.service.spec.ts  # tests unitarios (modelo, Cloudinary y JwtService mockeados)
│   │   ├── interfaces/jwt-payload.interface.ts  # qué viaja dentro del token
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts # valida el header Authorization: Bearer <token>
│   │   │   └── jwt-auth.guard.spec.ts
│   │   ├── decorators/usuario-actual.decorator.ts  # @UsuarioActual() → usuario del token
│   │   └── dto/
│   │       ├── register.dto.ts   # reglas de validación del registro
│   │       └── login.dto.ts      # reglas de validación del login
│   ├── usuarios/
│   │   ├── usuarios.module.ts    # registra y exporta el modelo de Mongoose
│   │   ├── schemas/usuario.schema.ts
│   │   └── utils/usuario-response.util.ts  # forma pública del usuario (_id → id)
│   ├── cloudinary/
│   │   ├── cloudinary.module.ts
│   │   └── cloudinary.service.ts # sube el buffer a Cloudinary (perfiles / publicaciones)
│   ├── common/
│   │   ├── filters/all-exceptions.filter.ts  # todo error sale en JSON (con `detalle` y stack en el log)
│   │   ├── multer/imagen.multer.ts   # límite de 5 MB y formatos permitidos (compartido)
│   │   └── pipes/parse-object-id.pipe.ts  # :id inválido → 400 (y no un 500 de Mongo)
│   ├── salud/
│   │   ├── salud.module.ts
│   │   ├── salud.controller.ts       # GET /api/salud: ¿arrancó? ¿Mongo conectado? ¿env vars cargadas?
│   │   └── salud.controller.spec.ts
│   └── publicaciones/
│       ├── publicaciones.module.ts
│       ├── publicaciones.controller.ts   # rutas HTTP del feed
│       ├── publicaciones.service.ts      # lógica: alta, feed, likes, baja lógica
│       ├── publicaciones.service.spec.ts
│       ├── schemas/publicacion.schema.ts
│       ├── dto/
│       │   ├── create-publicacion.dto.ts
│       │   └── listar-publicaciones.dto.ts
│       └── utils/publicacion-response.util.ts  # forma pública + autor populado
└── test/
    ├── auth.e2e-spec.ts          # pruebas de la capa HTTP (AuthService mockeado, sin DB)
    └── publicaciones.e2e-spec.ts # idem para el feed (guard y servicio mockeados)
```

**Responsabilidad de cada módulo**

| Módulo | Responsabilidad |
|---|---|
| `AppModule` | Configuración global: carga el `.env` y la conexión a MongoDB; importa el resto de los módulos |
| `UsuariosModule` | Define el **modelo** `Usuario` (`forFeature`) y lo **exporta** para que otros módulos lo usen |
| `AuthModule` | Rutas de registro/login. Importa `UsuariosModule` (modelo) y `CloudinaryModule` (imágenes) |
| `CloudinaryModule` | Provee `CloudinaryService` (subida de archivos a `red-social/perfiles` y `red-social/publicaciones`) |
| `PublicacionesModule` | Modelo `Publicacion` + rutas del feed. Importa `AuthModule` (para el `JwtAuthGuard`) y `CloudinaryModule` |

---

## Cómo funciona el código

### 1) Ciclo de vida de un request

```
Cliente (Postman / Angular)
   │  POST /api/auth/registro   (multipart/form-data)
   ▼
main.ts ....................... CORS + ValidationPipe global
   ▼
ValidationPipe ................ valida el body contra RegisterDto (class-validator)
                                y lo transforma en instancia (class-transformer: trim, minúsculas)
   ▼
FileInterceptor ............... Multer lee el campo "imagen" a memoria (máx. 5 MB, solo imágenes)
   ▼
AuthController.registro() ..... recibe @Body() registerDto + @UploadedFile() file
   ▼
AuthService.registrar() ....... lógica de negocio
   ├── usuarioModel.exists()  ¿correo / nombreUsuario repetidos? → 409 Conflict
   ├── bcrypt.hash()           contraseña → hash irreversible
   ├── cloudinaryService       sube la imagen (o usa DEFAULT_AVATAR_URL si no mandó foto)
   └── usuarioModel.create()   guarda el documento en Atlas
   ▼
toUsuarioResponse() ........... arma la respuesta pública: { id, nombre, ... } (sin password ni __v)
   ▼
AuthService.conToken() ........ firma el JWT y lo agrega: { ...usuario, token }
   ▼
201 Created + JSON
```

Y el del feed, que pasa por el guard:

```
Cliente (Postman / Angular)
   │  POST /api/publicaciones   (multipart/form-data + Authorization: Bearer <token>)
   ▼
JwtAuthGuard ................. verify(token) → si falla: 401; si no: request.usuario = { id, perfil }
   ▼
ValidationPipe ............... valida el body contra CreatePublicacionDto
   ▼
FileInterceptor .............. Multer lee "imagen" a memoria (opcional, máx. 5 MB)
   ▼
@UsuarioActual() ............. el controller recibe el usuario del token (no del body)
   ▼
PublicacionesService.crear() . sube la imagen a Cloudinary + publicacionModel.create()
   ▼
toPublicacionResponse() ...... arma la respuesta con el autor populado
   ▼
201 Created + JSON
```

### 2) `src/main.ts` — arranque de la aplicación

| Línea | Qué hace y por qué |
|---|---|
| `dns.setServers(['8.8.8.8', '8.8.4.4'])` | Atlas se resuelve por registros **SRV**; en Windows eso falla con el DNS del sistema (`querySrv ECONNREFUSED`). Forzamos los DNS de Google |
| `app.enableCors()` | Sin esto el navegador bloquea las llamadas del front (Angular corre en otro puerto/dominio) |
| `app.useGlobalFilters(new AllExceptionsFilter())` | Cualquier excepción se responde en JSON con un `message` legible; los 5xx agregan `detalle` con la causa y dejan el stack en el log |
| `new ValidationPipe({ whitelist, transform })` | `whitelist`: descarta campos no declarados en el DTO (no se puede inyectar `perfil: 'administrador'`). `transform`: convierte el body plano en instancia del DTO, necesario para que `@Transform` recorte espacios y pase el correo a minúsculas |
| `app.listen(process.env.PORT ?? 3000)` | Levanta el servidor HTTP |
| `void bootstrap()` | El `void` marca la promesa como "ignorada a propósito": evita el error de lint `no-floating-promises` |
| `bootstrap().catch(...)` | Si el arranque falla (falta una variable, Atlas no responde) la API no atiende **ningún** request: el `catch` loguea qué revisar y corta el proceso con código 1 |

### 3) `src/app.module.ts` — configuración global

```ts
ConfigModule.forRoot({ isGlobal: true }),

MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    uri: configService.getOrThrow<string>('MONGODB_URI'),
    dbName: configService.get<string>('MONGODB_DB') ?? 'redsocial',
    serverSelectionTimeoutMS: 5000, // si Atlas no contesta, falla en 5 s con log claro
    retryAttempts: 2,
    retryDelay: 1000,
  }),
}),
```

- `ConfigModule.forRoot({ isGlobal: true })` lee el `.env` y deja `ConfigService` disponible en
  **todos** los módulos sin reimportarlo.
- **Por qué `forRootAsync` y no `forRoot`:** con `forRoot(process.env.MONGODB_URI)` el valor se lee
  *antes* de que el `.env` esté cargado (depende del orden de importación) → conexión con `undefined`.
  Con `forRootAsync` Nest espera a que `ConfigService` esté listo e inyecta la configuración.
- `getOrThrow()` corta el arranque con un error claro si falta la variable.
- `dbName`: si la URI no termina en el nombre de la base, Mongoose usaría la base `test`.
- `serverSelectionTimeoutMS: 5000` + `retryAttempts: 2`: en Vercel la función tiene un tiempo máximo
  por request; conviene un error a los ~5 s (que queda en los Runtime Logs) antes que un arranque
  colgado que la plataforma corta sin explicación.

### 4) `usuarios/` — el esquema de Mongoose

```ts
@Schema({ timestamps: true })
export class Usuario {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  correo: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: PERFILES, default: 'usuario' })
  perfil: Perfil;
  // ...nombre, apellido, nombreUsuario, fechaNacimiento, descripcion, imagenPerfilUrl
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
```

| Detalle | Para qué |
|---|---|
| `@Schema({ timestamps: true })` | Mongoose agrega `createdAt` / `updatedAt` solo. Los usa el Sprint #2 para ordenar publicaciones por fecha |
| `unique: true` | Crea un **índice único** en Mongo: aunque el código falle, la base no permite dos correos iguales |
| `lowercase` / `trim` | Normaliza antes de guardar (el correo siempre queda en minúsculas, sin espacios) |
| `select: false` en `password` | El hash **no** se trae en las consultas por defecto: evita filtrarlo en listados o `populate`. El login lo pide con `.select('+password')` |
| `enum: PERFILES` | Solo acepta `usuario` o `administrador` (validación en la base) |
| `default: 'usuario'` | Nadie se registra como administrador desde la API |
| `HydratedDocument<Usuario>` | Tipo del documento que devuelve Mongo (incluye métodos como `.save()`) |

```ts
// usuarios.module.ts
MongooseModule.forFeature([{ name: Usuario.name, schema: UsuarioSchema }]),
exports: [MongooseModule], // AuthService puede usar @InjectModel(Usuario.name)
```

`forFeature` **registra el modelo**; `exports` lo deja disponible para `AuthModule`.
Sin ese `export`, Nest no puede resolver `@InjectModel(Usuario.name)` en `AuthService`.

### 5) DTOs + `ValidationPipe`

`register.dto.ts` define **qué** se acepta y **cómo** se valida:

| Campo | Reglas |
|---|---|
| `nombre`, `apellido` | `@IsString` + `@IsNotEmpty` + `@MaxLength(50)` + `@Transform` (trim) |
| `correo` | `@IsEmail` + `@Transform` (trim + minúsculas) |
| `nombreUsuario` | `@IsString` + `@MinLength(3)` + `@MaxLength(30)` + `@Matches(/^\S+$/)` (sin espacios) + `@Transform` (trim + minúsculas) |
| `password` | `@MinLength(8)` + `@Matches(/(?=.*[A-Z])(?=.*\d)/)` (al menos una mayúscula y un número) + `@Transform` (trim) |
| `fechaNacimiento` | `@IsDateString` (formato `AAAA-MM-DD`) |
| `descripcion` | **opcional** (`@IsOptional`) + `@MaxLength(200)` |
| `imagen` | No va en el DTO: llega como archivo y la recibe Multer (`@UploadedFile`) |

`login.dto.ts` valida `identificador` (correo **o** nombre de usuario) y `password`.

Puntos clave:

- El registro llega como `multipart/form-data`, así que **todos los valores son strings**
  (por eso `fechaNacimiento` se modela como string ISO y no como `Date`).
- `@Transform` (class-transformer) normaliza **antes** de validar: `" ANA@Correo.COM "` se valida
  como `ana@correo.com`. Esto funciona porque el `ValidationPipe` global usa `transform: true`.
- `password` también se recorta (`trim`) **en el registro y en el login**: un espacio o un **tab**
  invisible —típico de copiar y pegar desde una tabla— cambiaría el hash y el login devolvería 401
  sin motivo aparente. Recortando en los dos lados la comparación es siempre la misma.
- `correo` y `nombreUsuario` se guardan en **minúsculas** (DTO + `lowercase: true` en el esquema) y
  el login normaliza el `identificador`, así que `AnaMoreno`, `anamoreno` o `ANA@CORREO.COM` entran
  igual. La **unicidad** del nombre de usuario no cambia.
- Si una regla falla, Nest responde **400** con el detalle de cada campo; el `AuthService` nunca se
  ejecuta.

### 6) `AuthService.registrar()` — paso a paso

```ts
const { password, ...datos } = registerDto;

await this.verificarDisponibilidad(datos.correo, datos.nombreUsuario); // 1
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);         // 2
const imagenPerfilUrl = file
  ? await this.cloudinaryService.uploadImage(file)                     // 3a
  : (this.configService.get<string>('DEFAULT_AVATAR_URL') ?? '');      // 3b

const usuario = await this.usuarioModel.create({ ... });               // 4
return toUsuarioResponse(usuario);                                     // 5
```

1. **Duplicados:** pregunta primero con `exists()` para poder decir *qué* campo está ocupado
   (`409 El correo ya está registrado` / `El nombre de usuario ya está en uso`). Además, si dos
   registros entran al mismo tiempo, el índice `unique` frena al segundo con el error `11000`, que
   el `catch` traduce también a **409**.
2. **Contraseña:** `bcrypt.hash(password, 10)`. El salt se genera internamente y queda *dentro* del
   hash: por eso alcanza con guardar un solo string (`$2b$10$...`) y comparar después con
   `bcrypt.compare`. Es **irreversible**: nadie (ni la base) puede recuperar la contraseña.
3. **Imagen:** si el usuario adjuntó un archivo, se sube a Cloudinary; si no, se usa
   `DEFAULT_AVATAR_URL` (la imagen por defecto, ver más abajo).
4. **Guardado campo por campo** (no `...registerDto`): evita el *mass assignment*, es decir que el
   cliente mande `perfil: 'administrador'` o `imagenPerfilUrl` y se guarde tal cual.
5. **Respuesta:** `toUsuarioResponse()` devuelve solo los campos públicos, con `id` en lugar de
   `_id`, sin `__v` y **sin `password`**.
6. **Try/catch que cubre los cinco pasos** (no sólo `create()`): si falla la conexión a Atlas, una
   consulta, `bcrypt` o Cloudinary, el cliente recibe **500** con `message: 'No se pudo crear el
   usuario'` y `detalle` con la causa real, el stack queda en el log y los `409` de duplicados se
   propagan sin convertirse en 500. Antes, una caída de Cloudinary o de Mongo salía como un 500
   **sin cuerpo**, y el frontend sólo podía mostrar "ocurrió un error inesperado".

```ts
// login
const identificadorNormalizado = identificador.trim().toLowerCase();

const usuario = await this.usuarioModel
  .findOne({
    $or: [
      { correo: identificadorNormalizado },
      { nombreUsuario: identificadorNormalizado },
    ],
  })
  .select('+password');

if (!usuario) throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
const coincide = await bcrypt.compare(passwordPlano, usuario.password);
if (!coincide) throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
return toUsuarioResponse(usuario);
```

- Un solo campo (`identificador`) busca en **correo o nombre de usuario** (`$or`), y se compara
  normalizado (sin espacios y en minúsculas) porque los dos se guardan así.
- `.select('+password')` es obligatorio porque el esquema oculta el hash (`select: false`).
- El mismo mensaje de error para "no existe" y "contraseña incorrecta": no le confirmamos a un
  atacante qué dato existe. Ambos casos son **401**.

### 7) `CloudinaryService` — subida de la imagen

```ts
constructor(private readonly configService: ConfigService) {
  cloudinary.config({
    cloud_name: this.configService.get<string>('CLOUD_NAME'),
    api_key: this.configService.get<string>('API_KEY'),
    api_secret: this.configService.get<string>('API_SECRET'),
  });
}
```

- Se configuran las credenciales con **`ConfigService`** (no `process.env`): así el servicio se puede
  testear inyectando un mock y las claves quedan en un solo lugar.
- Multer guarda el archivo en **memoria** (`file.buffer`), por eso no se escribe nada en disco.
- Cloudinary no acepta un `Buffer`: `buffer-to-stream` lo convierte en un stream que se conecta con
  `cloudinary.uploader.upload_stream(...)`. Cuando termina, se devuelve `result.secure_url`
  (la URL `https://` que se guarda en la base).
- Las imágenes se guardan en Cloudinary en la carpeta que recibe `uploadImage(file, publicId?, carpeta)`:
  `red-social/perfiles` (default, avatares) y `red-social/publicaciones` (fotos del feed).
- Si Cloudinary falla, el error se loguea y se responde **500** (nunca 200).

### 8) JWT — quién hace el request

Los likes y la baja de una publicación **necesitan saber quién** está llamando: sin identidad
cualquiera podría borrar publicaciones ajenas. Por eso el login y el registro devuelven un token.

```ts
// auth.module.ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.getOrThrow<string>('JWT_SECRET'),
    signOptions: { expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN')) || 900 },
  }),
});
```

```ts
// auth.service.ts — el token se AGREGA a la respuesta, no la envuelve
private conToken(usuario: UsuarioResponse): UsuarioConToken {
  const payload: JwtPayload = {
    sub: usuario.id,               // id del usuario (convención `sub` = subject)
    nombreUsuario: usuario.nombreUsuario,
    perfil: usuario.perfil,
  };

  return { ...usuario, token: this.jwtService.sign(payload) };
}
```

| Pieza | Para qué |
|---|---|
| `JwtModule.registerAsync` | Firma y verifica con `JWT_SECRET`; `expiresIn` en segundos (`900` = 15 min) |
| `JwtPayload` (`interfaces/`) | Tipo de lo que viaja en el token: `sub`, `nombreUsuario`, `perfil` |
| `JwtAuthGuard` (`guards/`) | Exige `Authorization: Bearer <token>`, verifica la firma y el vencimiento, y deja el usuario en `request.usuario` |
| `@UsuarioActual()` (`decorators/`) | Atajo para recibir ese usuario como parámetro del controller |
| `exports: [JwtAuthGuard, JwtModule]` | `PublicacionesModule` importa `AuthModule` y reutiliza el guard sin volver a configurar el secret |

Puntos importantes:

- **`{ ...usuario, token }` en vez de `{ usuario, token }`**: el front del Sprint #3 ya guarda la
  respuesta del login tal cual, así que sumar un campo no rompe nada (cambio **aditivo**).
- El **`sub` del token es la única fuente del id** para likes y bajas. Nunca se toma un `usuarioId`
  del body o del query: ese dato lo podría falsificar cualquiera.
- `verify()` falla tanto con una **firma inválida** como con un token **vencido**; los dos casos se
  traducen a **401**.
- Si falta `JWT_SECRET`, `getOrThrow()` corta el arranque. Es a propósito: es preferible un error
  claro al levantar que emitir tokens firmados con `undefined`.

### 9) Publicaciones — esquema, feed y likes

**Esquema** (`publicaciones/schemas/publicacion.schema.ts`):

| Campo | Tipo | Para qué |
|---|---|---|
| `titulo`, `descripcion` | string (obligatorios) | Contenido de la publicación |
| `nombreComun`, `nombreCientifico` | string (opcional, default `''`) | Datos del ave fotografiada |
| `imagenUrl` | string (default `''`) | URL de Cloudinary o vacío si publicó sólo texto |
| `usuario` | `ObjectId` + `ref: 'Usuario'` | Autor. Se guarda la **referencia** y se resuelve con `populate` |
| `likes` | `ObjectId[]` | Un elemento por usuario: el propio array garantiza un like por persona |
| `cantidadLikes` | number (default `0`) | Espejo de `likes.length` para **ordenar por índice** |
| `eliminado`, `fechaEliminacion` | boolean / Date | Baja **lógica** |

Índices creados:

```ts
PublicacionSchema.index({ eliminado: 1, createdAt: -1 });      // feed por fecha
PublicacionSchema.index({ eliminado: 1, cantidadLikes: -1 });  // feed por likes
PublicacionSchema.index({ usuario: 1, eliminado: 1, createdAt: -1 }); // perfil de un usuario
```

**Me gusta atómico** — `findOneAndUpdate` con el "no existe todavía" dentro del filtro:

```ts
const actualizada = await this.publicacionModel.findOneAndUpdate(
  { _id: id, eliminado: false, likes: { $ne: usuario.id } },   // sólo si NO estaba
  { $addToSet: { likes: usuario.id }, $inc: { cantidadLikes: 1 } },
  { new: true },
);

if (!actualizada) {
  throw await this.errorDeLike(id, 'Ya le diste me gusta a esta publicación');
}
```

- Si el like ya estaba, el filtro **no matchea** y devuelve `null` → **409**. Con un
  "leer → verificar → guardar" dos requests simultáneos podrían pasar los dos y el contador quedaría
  en 2.
- `null` puede significar dos cosas distintas: la publicación no existe (**404**) o el like ya estaba
  (**409**). Una consulta `exists()` extra decide cuál responder.
- Quitar el like es el mismo patrón al revés: filtro `likes: usuario.id` + `$pull`.
- `cantidadLikes` se mueve con `$inc`, nunca se recalcula desde el array.

**Baja lógica**: `eliminado: true` + `fechaEliminacion`, y el feed filtra **siempre**
`{ eliminado: false }`. El documento sigue en la base (no se pierde el historial ni los likes).

**Feed con `populate` y paginación**:

```ts
const [total, documentos] = await Promise.all([
  this.publicacionModel.countDocuments(filtro),
  this.publicacionModel
    .find(filtro)
    .sort(this.armarOrden(listarDto.orden))
    .skip(listarDto.offset)
    .limit(listarDto.limit)
    .populate({ path: 'usuario', select: 'nombre apellido nombreUsuario imagenPerfilUrl' })
    .exec(),
]);
```

- `select` en el `populate`: del usuario se traen **sólo** los datos públicos (nunca `correo` ni el hash).
- `total` + `offset` + `limit` permiten armar `hayMas`, que es lo que el front usa para el scroll infinito.
- El orden por `likes` desempata por `createdAt`: sin eso, dos páginas seguidas pueden repetir o
  saltear publicaciones cuando hay muchos empates.
- La respuesta incluye `likeado` por publicación: el front no tiene que cruzar datos para pintar el
  corazón lleno o vacío.

### 10) Errores y códigos HTTP

| Situación | Código | Respuesta |
|---|---|---|
| Registro correcto | **201** | Usuario creado (sin contraseña) |
| Login correcto | **200** | Datos del usuario (`@HttpCode(HttpStatus.OK)`: un POST devolvería 201 por defecto) |
| Dato faltante o inválido (DTO) | **400** | Detalle por campo (`ValidationPipe`) |
| Archivo que no es imagen | **400** | `La imagen debe ser JPG, PNG, WEBP o GIF` (`fileFilter`) |
| Imagen de más de 5 MB | **413** | Multer corta la subida antes de llegar al service |
| Correo / usuario repetido | **409** | `El correo ya está registrado` / `El nombre de usuario ya está en uso` |
| Credenciales incorrectas | **401** | `Usuario/correo o contraseña incorrectos` |
| Falla Cloudinary o la base | **500** | `message` legible + `detalle` con la causa real (el stack completo queda en el log) |
| Falta el token o está vencido | **401** | `Falta el token de autenticación` / `El token es inválido o expiró` |
| Publicación creada | **201** | La publicación con el autor ya populado |
| Like agregado | **201** | `{ id, cantidadLikes, likeado: true }` |
| Like quitado | **200** | `{ id, cantidadLikes, likeado: false }` |
| Like repetido / like inexistente al quitarlo | **409** | `Ya le diste me gusta a esta publicación` / `No habías dado me gusta...` |
| Baja lógica correcta | **200** | `{ id, eliminado: true, fechaEliminacion }` |
| Baja de una publicación ajena sin ser administrador | **403** | `Solo el autor de la publicación o un administrador pueden eliminarla` |
| Publicación inexistente o ya eliminada | **404** | `La publicación no existe o fue eliminada` |
| `:id` de la ruta con formato inválido | **400** | `El id no tiene un formato válido` (`ParseObjectIdPipe`) |
| `offset`/`limit`/`orden`/`usuario` inválidos | **400** | Detalle por campo (`ListarPublicacionesDto`) |

---

## Endpoints

> Todas las rutas están montadas bajo **`/api`** (`app.setGlobalPrefix('api')` en `src/main.ts`),
> porque en Vercel el rewrite `/api/(.*)` del `vercel.json` raíz entrega la request al servicio
> `backend` **sin recortar el path**. En desarrollo es lo mismo: `http://localhost:3000/api/...`.

### `GET /api/salud`

Diagnóstico del deploy. **No requiere token** (sirve justamente cuando el login no funciona).

```json
{
  "ok": true,
  "mongo": "conectado",
  "baseDeDatos": "redsocial",
  "variablesDeEntorno": {
    "MONGODB_URI": true,
    "MONGODB_DB": true,
    "CLOUD_NAME": true,
    "API_KEY": true,
    "API_SECRET": true,
    "DEFAULT_AVATAR_URL": true,
    "JWT_SECRET": true,
    "JWT_EXPIRES_IN": true
  },
  "plataforma": "vercel",
  "uptimeEnSegundos": 12,
  "fecha": "2026-11-04T12:00:00.000Z"
}
```

- **200** + `ok: true`: la API arrancó y la base está conectada.
- **503** + `ok: false` con `mongo: "desconectado"`: la API vive pero perdió la conexión (o el
  `readyState` todavía es `conectando`).
- `variablesDeEntorno` informa **existencia**, no valores: un `false` es exactamente la variable que
  hay que cargar en Vercel y volver a desplegar.

### `POST /api/auth/registro`

`Content-Type: multipart/form-data` (porque puede incluir el archivo `imagen`).

| Campo | Tipo | ¿Obligatorio? | Ejemplo |
|---|---|---|---|
| `nombre` | texto | sí | `Ana` |
| `apellido` | texto | sí | `Moreno` |
| `correo` | texto | sí | `ana@correo.com` |
| `nombreUsuario` | texto | sí | `anamoreno` |
| `password` | texto | sí | `Segura123` |
| `fechaNacimiento` | texto ISO | sí | `1998-05-20` |
| `descripcion` | texto | no | `Amante de la fotografía` |
| `imagen` | archivo | no | `foto.jpg` (JPG/PNG/WEBP/GIF, máx. 5 MB) |

Respuesta **201**:

```json
{
  "id": "6712f3c9a8b4d5e6f7a8b9c0",
  "nombre": "Ana",
  "apellido": "Moreno",
  "correo": "ana@correo.com",
  "nombreUsuario": "anamoreno",
  "fechaNacimiento": "1998-05-20",
  "descripcion": "Amante de la fotografía",
  "imagenPerfilUrl": "https://res.cloudinary.com/nxux17x7/image/upload/red-social/perfiles/abc123.jpg",
  "perfil": "usuario",
  "createdAt": "2026-10-28T12:00:00.000Z",
  "updatedAt": "2026-10-28T12:00:00.000Z",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzEyZjNjOS4uLiJ9.abc123"
}
```

El campo **`token`** (JWT) se agregó en el Sprint #2: se manda en las rutas del feed como
`Authorization: Bearer <token>`.

### `POST /api/auth/login`

`Content-Type: application/json`

```json
{
  "identificador": "anamoreno",
  "password": "Segura123"
}
```

`identificador` acepta el **nombre de usuario** o el **correo**.
Respuesta **200**: el mismo objeto público del registro (sin `password`, con `token`).

### Rutas de publicaciones (todas requieren `Authorization: Bearer <token>`)

> Sin el header, cualquiera de estas rutas responde **401**.

#### `POST /api/publicaciones`

`Content-Type: multipart/form-data` (la imagen es un archivo, todo lo demás texto).

| Campo | Tipo | ¿Obligatorio? | Ejemplo |
|---|---|---|---|
| `titulo` | texto | sí (máx. 100) | `Colibrí en el jardín` |
| `descripcion` | texto | sí (máx. 500) | `Lo vi a la mañana` |
| `nombreComun` | texto | no (máx. 80) | `Colibrí garganta rubí` |
| `nombreCientifico` | texto | no (máx. 80) | `Archilochus colubris` |
| `imagen` | archivo | no | `ave.jpg` (JPG/PNG/WEBP/GIF, máx. 5 MB) |

El **autor sale del token**, no del body: no hay campo `usuario` en el formulario.
Respuesta **201**:

```json
{
  "id": "6721a4f0c1d2e3f4a5b6c7d8",
  "titulo": "Colibrí en el jardín",
  "descripcion": "Lo vi a la mañana",
  "nombreComun": "Colibrí garganta rubí",
  "nombreCientifico": "Archilochus colubris",
  "imagenUrl": "https://res.cloudinary.com/nxux17x7/image/upload/red-social/publicaciones/abc123.jpg",
  "usuario": {
    "id": "6712f3c9a8b4d5e6f7a8b9c0",
    "nombre": "Ana",
    "apellido": "Moreno",
    "nombreUsuario": "anamoreno",
    "imagenPerfilUrl": "https://res.cloudinary.com/nxux17x7/image/upload/red-social/perfiles/ana.jpg"
  },
  "cantidadLikes": 0,
  "likeado": false,
  "eliminado": false,
  "createdAt": "2026-11-02T12:00:00.000Z",
  "updatedAt": "2026-11-02T12:00:00.000Z"
}
```

#### `GET /api/publicaciones`

| Query | Default | Reglas |
|---|---|---|
| `offset` | `0` | entero `>= 0` |
| `limit` | `5` | entero entre `1` y `50` |
| `orden` | `fecha` | `fecha` (más nuevas primero) o `likes` (más gustadas primero) |
| `usuario` | — | ObjectId del autor, para ver el feed de un perfil |

Respuesta **200**:

```json
{
  "total": 12,
  "offset": 0,
  "limit": 5,
  "orden": "fecha",
  "hayMas": true,
  "publicaciones": [ /* las claves de arriba, con "likeado" según quién consulta */ ]
}
```

#### `POST /api/publicaciones/:id/like` → **201**

```json
{ "id": "6721a4f0c1d2e3f4a5b6c7d8", "cantidadLikes": 1, "likeado": true }
```

Si el usuario ya había dado me gusta → **409** (no se cuenta dos veces).

#### `DELETE /api/publicaciones/:id/like` → **200**

Mismo cuerpo con `likeado: false`. Si el like no existía → **409**.

#### `DELETE /api/publicaciones/:id` → **200**

Baja **lógica**; sólo el autor o un administrador (**403** si no). Devuelve:

```json
{ "id": "6721a4f0c1d2e3f4a5b6c7d8", "eliminado": true, "fechaEliminacion": "2026-11-02T12:30:00.000Z" }
```

Después de la baja, la publicación **no aparece** en `GET /api/publicaciones`.

---

## Imagen de perfil por defecto

La imagen vive en `assets/perfil_default.png` y se sube a Cloudinary **una sola vez**:

```bash
node scripts/upload-default-avatar.js
# imprime: DEFAULT_AVATAR_URL=https://res.cloudinary.com/.../red-social/perfiles/default.jpg
```

Esa URL se pega en `.env`:

```env
DEFAULT_AVATAR_URL=https://res.cloudinary.com/nxux17x7/image/upload/v1793213658/red-social/perfiles/default.jpg
```

Gracias a eso, `AuthService` puede resolver los dos casos con una sola línea:

- **El usuario subió foto** → se sube a Cloudinary y se guarda esa URL.
- **No subió foto** → se guarda `DEFAULT_AVATAR_URL` (una URL real, siempre accesible).

Así `imagenPerfilUrl` **nunca queda vacío** y el front puede mostrar `<img [src]="usuario.imagenPerfilUrl">`
sin necesitar un `assets/` local. Si se cambia la imagen, se vuelve a correr el script y se actualiza
la variable de entorno: no hay que tocar código.

---

## Conceptos aplicados en el código

| Concepto | Dónde se ve |
|---|---|
| **Arquitectura modular** | `src/*/`: cada carpeta es un módulo con su `*.module.ts` |
| **Controlador (routing)** | `auth.controller.ts`: `@Controller('auth')`, `@Post('registro')`, `@Post('login')` |
| **Servicio (lógica de negocio)** | `auth.service.ts`: lo que el controller delega; no sabe nada de HTTP |
| **Inyección de dependencias** | Los `constructor(...)` con `private readonly`: Nest resuelve `AuthService`, `CloudinaryService`, `ConfigService` y el modelo |
| **Providers / exports** | `CloudinaryModule` provee y exporta `CloudinaryService`; `UsuariosModule` exporta el modelo |
| **DTO + validación** | `dto/register.dto.ts` y `dto/login.dto.ts` con `class-validator` |
| **Pipes** | `ValidationPipe` global en `main.ts` (valida y transforma) |
| **Interceptors / middleware de archivos** | `FileInterceptor` de Multer en `@Post('registro')` |
| **Decoradores de parámetros** | `@Body()`, `@UploadedFile()`, `@InjectModel()` |
| **Configuración por entorno** | `ConfigModule` + `ConfigService` + `.env` |
| **Modelo / esquema** | `usuarios/schemas/usuario.schema.ts` (`@Schema`, `@Prop`, `SchemaFactory`) |
| **Persistencia** | `MongooseModule.forRootAsync` (conexión) + `forFeature` (modelo) |
| **Seguridad básica** | bcrypt, `select: false`, `whitelist: true`, límite de 5 MB y filtro de tipo de archivo |
| **Manejo de errores HTTP** | `ConflictException`, `UnauthorizedException`, `BadRequestException`, `InternalServerErrorException` |
| **CORS** | `app.enableCors()` para el front en otro origen |
| **Testing** | `*.spec.ts` unitarios con mocks y `test/*.e2e-spec.ts` (capa HTTP, sin base real) |
| **Guard** | `JwtAuthGuard`: decide si el request sigue (token válido) o se corta con 401 |
| **Decorador de parámetro propio** | `@UsuarioActual()`: lee `request.usuario` y lo inyecta en el controller |
| **Pipe propio** | `ParseObjectIdPipe`: valida el `:id` de la ruta → 400 en vez de 500 |
| **Autenticación con JWT** | `JwtModule.registerAsync` + `@nestjs/jwt` (firma con secret del `.env`) |
| **Relaciones con `populate`** | `Publicacion.usuario` (`ref: 'Usuario'`) resuelto con `select` acotado |
| **Baja lógica** | `eliminado` + `fechaEliminacion`; el feed siempre filtra `{ eliminado: false }` |
| **Índices** | `PublicacionSchema.index(...)` para los dos órdenes del feed |
| **Operadores atómicos** | `$addToSet`, `$pull`, `$inc` en `findOneAndUpdate` (likes sin condiciones de carrera) |
| **Paginación** | `countDocuments` + `skip`/`limit` + `hayMas` en la respuesta |

---

## Pruebas manuales

> En PowerShell, `curl` es un alias de `Invoke-WebRequest`. Usá `curl.exe` o Postman.

**1. Registro sin imagen → 201** (debe traer `DEFAULT_AVATAR_URL`)

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=ana@correo.com" \
  -F "nombreUsuario=anamoreno" -F "password=Segura123" \
  -F "fechaNacimiento=1998-05-20" -F "descripcion=Hola!"
```

**2. Registro con imagen → 201** (la URL debe ser de Cloudinary)

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -F "nombre=Beto" -F "apellido=Díaz" -F "correo=beto@correo.com" \
  -F "nombreUsuario=betodiaz" -F "password=Segura123" \
  -F "fechaNacimiento=1995-01-10" -F "imagen=@C:/ruta/foto.jpg"
```

**3. Correo o usuario repetido → 409**

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=ana@correo.com" \
  -F "nombreUsuario=otro" -F "password=Segura123" -F "fechaNacimiento=1998-05-20"
```

**4. Datos inválidos → 400** (mensajes por campo: contraseña débil, correo inválido, fecha mal formada)

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=no-es-correo" \
  -F "nombreUsuario=ana" -F "password=debil" -F "fechaNacimiento=ayer"
```

**5. Archivo que no es imagen → 400**

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=ana2@correo.com" \
  -F "nombreUsuario=ana2" -F "password=Segura123" -F "fechaNacimiento=1998-05-20" \
  -F "imagen=@C:/ruta/documento.pdf"
```

**6. Login con nombre de usuario / con correo → 200**

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"identificador":"anamoreno","password":"Segura123"}'

curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"identificador":"ana@correo.com","password":"Segura123"}'
```

**7. Contraseña incorrecta o usuario inexistente → 401**

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"identificador":"anamoreno","password":"Incorrecta1"}'
```

**8. En Atlas:** la base `redsocial` aparece sola en el cluster (Mongo la crea al insertar el primer
documento), dentro de la colección `usuarios`, con `password` guardado como hash `$2b$10$...`.

**9. Guardar el token del login para las pruebas del feed**

```powershell
$login = curl.exe -s -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"identificador\":\"anamoreno\",\"password\":\"Segura123\"}' | ConvertFrom-Json
$TOKEN = $login.token
$TOKEN.Substring(0, 20)   # empieza con eyJhbGciOi...
```

**10. Crear una publicación sin imagen → 201**

```powershell
curl.exe -s -X POST http://localhost:3000/api/publicaciones `
  -H "Authorization: Bearer $TOKEN" `
  -F "titulo=Colibrí en el jardín" -F "descripcion=Lo vi a la mañana" `
  -F "nombreComun=Colibrí garganta rubí" -F "nombreCientifico=Archilochus colubris"
```

**11. Crear una publicación con imagen → 201** (`imagenUrl` debe ser de Cloudinary,
carpeta `red-social/publicaciones`)

```powershell
curl.exe -s -X POST http://localhost:3000/api/publicaciones `
  -H "Authorization: Bearer $TOKEN" `
  -F "titulo=Picaflor verde" -F "descripcion=En el parque" `
  -F "imagen=@C:/ruta/ave.jpg"
```

**12. Feed con paginación y orden → 200**

```powershell
curl.exe -s "http://localhost:3000/api/publicaciones?offset=0&limit=5&orden=fecha" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/api/publicaciones?offset=0&limit=5&orden=likes" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/api/publicaciones?usuario=<id-del-usuario>"    -H "Authorization: Bearer $TOKEN"
```

Casos que tienen que dar **400**: `?offset=abc`, `?limit=0`, `?limit=999`, `?orden=autor`,
`?usuario=no-es-un-id`. Y **401** sin el header `Authorization`.

**13. Like → 201, repetido → 409**

```powershell
$ID = "<id-de-la-publicacion>"
curl.exe -s -X POST "http://localhost:3000/api/publicaciones/$ID/like" -H "Authorization: Bearer $TOKEN"
# { "id": "...", "cantidadLikes": 1, "likeado": true }
curl.exe -s -o NUL -w "%{http_code}" -X POST "http://localhost:3000/api/publicaciones/$ID/like" -H "Authorization: Bearer $TOKEN"
# 409
```

**14. Quitar el like → 200, repetido → 409**

```powershell
curl.exe -s -X DELETE "http://localhost:3000/api/publicaciones/$ID/like" -H "Authorization: Bearer $TOKEN"
# { "id": "...", "cantidadLikes": 0, "likeado": false }
curl.exe -s -o NUL -w "%{http_code}" -X DELETE "http://localhost:3000/api/publicaciones/$ID/like" -H "Authorization: Bearer $TOKEN"
# 409
```

**15. Baja lógica:** con el token de **otro** usuario → **403**; con el del autor → **200**; después la
publicación deja de aparecer en el feed (`GET`)

```powershell
curl.exe -s -o NUL -w "%{http_code}" -X DELETE "http://localhost:3000/api/publicaciones/$ID" -H "Authorization: Bearer $TOKEN_OTRO"
# 403
curl.exe -s -X DELETE "http://localhost:3000/api/publicaciones/$ID" -H "Authorization: Bearer $TOKEN"
# { "id": "...", "eliminado": true, "fechaEliminacion": "..." }
```

**16. En Atlas:** la colección `publicaciones` guarda `usuario` y `likes` como `ObjectId`, y
`eliminado` pasa a `true` (el documento **no** se borra).

**Si el login devuelve 401 con datos que parecen correctos**

1. Confirmá en Atlas (`redsocial` → `usuarios`) que el documento existe y mirá el valor **exacto** de
   `correo` y `nombreUsuario` (se guardan en minúsculas).
2. El **401 no distingue** "usuario inexistente" de "contraseña incorrecta" — es a propósito, para no
   filtrar qué datos existen. Para saber cuál es, registrá otro usuario y logueate enseguida con la
   misma contraseña.
3. La causa más común es un **espacio o tab invisible** al pegar la contraseña. El backend ya recorta
   espacios/tabs al registrar **y** al loguear, pero las cuentas creadas antes de ese cambio tienen el
   hash de la contraseña "con el tab": hay que registrarlas de nuevo.
4. Ojo: bcrypt es **irreversible**, así que una contraseña perdida no se puede recuperar; se resetea
   (o se borra el usuario y se registra otra vez).

---

## Preparado para los próximos sprints

- **Sprint #3 — Frontend (Angular):** CORS habilitado, respuestas con `id` (no `_id`) y un contrato ya
  definido para el feed (`total`, `hayMas`, `likeado`), así el front puede tipar
  `Publicacion { id: string; ... }` y armar el scroll infinito sin adaptar nada.
- **Sprint #3 — Comentarios (backend):** `PublicacionesModule` **exporta** `PublicacionesService`, así
  que el módulo de comentarios puede inyectarlo y verificar que la publicación exista y no esté dada
  de baja antes de crear un comentario.
- **Sprint #4 — JWT completo:** el token ya está implementado (`JwtModule`, `JwtAuthGuard`,
  `@UsuarioActual()`), payload `{ sub, nombreUsuario, perfil }` y vencimiento configurable. Queda para
  el #4 lo que no pide este sprint: *refresh tokens*, revocación, y aplicar el guard a las rutas de
  usuarios (`GET/PATCH /usuarios/:id`), que hoy siguen abiertas.
- **Roles:** `JwtAuthGuard` ya expone `perfil`, y la baja de publicaciones acepta `administrador`. Un
  `RolesGuard` con `@Roles('administrador')` sería el paso siguiente para administrar usuarios.

---

## Decisiones técnicas

| # | Decisión | Por qué |
|---|---|---|
| D1 | El login recibe **`identificador`** (correo o nombre de usuario) | El enunciado pide poder entrar con cualquiera de los dos; se resuelve con `$or` |
| D2 | Login → **200**, duplicados → **409** | Coherencia REST: un login no crea un recurso; un conflicto de unicidad es 409 |
| D3 | `password` con `select: false` + `.select('+password')` en el login | Es imposible "olvidarse" de filtrar el hash: por defecto nunca sale de la base |
| D4 | Salida en **CommonJS** (`module: commonjs`) | Es lo que pide el enunciado; con TS 6 se quitó `moduleResolution` porque `node10` está deprecado |
| D5 | Sin prefijo global (`/auth/...`, no `/api/auth/...`) | El front del Sprint #3 consume estas rutas tal cual |
| D6 | `descripcion` opcional, máx. 200, default `''` | No todos completan el perfil; el default evita `undefined` en el front |
| D7 | `fechaNacimiento` como **string ISO** + `@IsDateString` | Llega como texto del `FormData`; se valida el formato `AAAA-MM-DD` |
| D8 | Avatar opcional, máx. **5 MB**, JPG/PNG/WEBP/GIF, si no hay → `DEFAULT_AVATAR_URL` | Evita imágenes gigantes, archivos que no son imagen y perfiles sin foto |
| D9 | Respuesta mapeada (`toUsuarioResponse`) con `id`, sin `_id`/`__v`/`password` | El contrato con el front queda explícito y no se filtra nada interno |
| D10 | Tests: unitario de `AuthService` + HTTP de `AuthController` (mocks, sin Atlas) | Se pueden correr siempre, sin depender de la red ni de la base |
| D11 | `MONGODB_DB=redsocial` + `dbName` en `forRootAsync` | Sin esto Mongoose usaría la base `test`; Mongo crea `redsocial` al primer insert |
| D12 | `timestamps: true` en el esquema | `createdAt` / `updatedAt` gratis, necesarios para el feed del Sprint #2 |
| D13 | Guardado campo por campo (sin `...registerDto`) | Evita *mass assignment*: nadie se auto-asigna `perfil: 'administrador'` |
| D14 | El login/registro devuelven `{ ...usuario, token }` | **Aditivo**: el front del Sprint #1 sigue leyendo el usuario igual, y las rutas nuevas usan el token |
| D15 | El id del usuario para likes y bajas sale **solo del token** | Un `usuarioId` del body/query se puede falsificar; el token está firmado |
| D16 | Likes con endpoints explícitos (`POST`/`DELETE`) | La consigna diferencia "dar" de "quitar" y así cada caso tiene su código: 201 / 200 / 409 |
| D17 | `likes: ObjectId[]` + `cantidadLikes` denormalizado | Un like por usuario garantizado por el array; `cantidadLikes` permite ordenar por índice (con `$size` de agregación Mongo no lo usa) |
| D18 | Like/unlike con `findOneAndUpdate` condicionado | Atómico: dos requests simultáneos no pueden contar el mismo like dos veces |
| D19 | Baja **lógica** (`eliminado` + `fechaEliminacion`) | No se pierde el historial y el feed sólo tiene que filtrar `{ eliminado: false }` |
| D20 | `ParseObjectIdPipe` en los `:id` | Un id mal escrito responde 400 y no el 500 que produce el `CastError` de Mongoose |
| D21 | `limit` con **techo de 50** y default 5 | Evita que un `limit=100000` tumbe el servidor; el default achica el primer render |
| D22 | El feed calcula **`likeado`** por publicación | El front no tiene que cruzar `likes` con el usuario logueado para pintar el corazón |
| D23 | `JWT_EXPIRES_IN` en **segundos** | `expiresIn` de `jsonwebtoken` tipa `number | StringValue`; con segundos el valor del `.env` es siempre válido |
| D24 | **Filtro global** de excepciones (`AllExceptionsFilter`) | Todo error sale en JSON con `message` (y `detalle` en los 5xx): un 500 sin cuerpo deja al front sin nada que mostrar. El stack queda en el log |
| D25 | `GET /api/salud` **público** con `mongoose.connection.readyState` y variables cargadas (`true`/`false`) | Permite diagnosticar un deploy roto desde el navegador, sin exponer credenciales ni depender de los logs |
| D26 | `serverSelectionTimeoutMS: 5000` + `retryAttempts: 2` | En serverless conviene fallar rápido y con un log claro antes que agotar el tiempo de la función |

---

## Estado del Sprint #1

- [x] Proyecto modular (`AuthModule`, `UsuariosModule`, `CloudinaryModule`, `PublicacionesModule`)
- [x] Conexión a MongoDB Atlas con `forRootAsync` y base `redsocial`
- [x] Registro con validación completa y contraseña hasheada con bcrypt
- [x] Subida de imagen a Cloudinary + imagen por defecto
- [x] Login por correo o nombre de usuario, con 200 / 401
- [x] Respuestas sin `password` ni campos internos de Mongo
- [x] Manejo de errores 400 / 401 / 409 / 413 / 500
- [x] CORS habilitado
- [x] `.env.example` y README en español
- [x] Tests unitarios y de la capa HTTP (`npm test`), lint (`npm run lint`) y build (`npm run build`)
- [x] JWT mínimo (token en el login) → se completó en el Sprint #2 porque los likes lo necesitan

## Estado del Sprint #2

- [x] Esquema `Publicacion` con autor referenciado (`populate`), bajas lógicas y tres índices
- [x] `POST /api/publicaciones` con imagen **opcional** a Cloudinary (`red-social/publicaciones`)
- [x] Campos opcionales `nombreComun` y `nombreCientifico`
- [x] `GET /api/publicaciones` con `offset`/`limit`, orden `fecha`/`likes` y filtro por `usuario`
- [x] `likeado` por publicación y `hayMas` para el scroll infinito
- [x] `POST` / `DELETE /api/publicaciones/:id/like` (201 / 200, 409 si se repite)
- [x] `DELETE /api/publicaciones/:id` con baja lógica y permiso de autor o administrador (403 / 404)
- [x] `JwtAuthGuard` protegiendo todas las rutas del feed (401 sin token o vencido)
- [x] `ParseObjectIdPipe`: `:id` inválido → 400
- [x] Validación de query (`ListarPublicacionesDto`) y de body (`CreatePublicacionDto`)
- [x] Tests: unitarios del servicio y del guard + e2e de la capa HTTP (`npm test`, `npm run test:e2e`)
- [x] Lint (`npm run lint`) y build (`npm run build`) sin errores
- [x] Chequeo de tipos de todo el proyecto, specs incluidos (`npm run typecheck`)
- [x] Filtro global de excepciones (`AllExceptionsFilter`) + `GET /api/salud` para diagnosticar el deploy
- [ ] Comentarios → Sprint #3 (backend)
