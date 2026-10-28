# Red Social — Backend (Sprint #1)

API REST de una red social, desarrollada con **NestJS + MongoDB Atlas + Cloudinary**.

Este repositorio implementa el **Sprint #1 del backend**:

- **Registro de usuarios** (`POST /auth/registro`): validación de los datos, foto de perfil
  opcional subida a Cloudinary y contraseña encriptada con bcrypt.
- **Login** (`POST /auth/login`) usando el correo **o** el nombre de usuario.

> ⚠️ El **JWT (token de sesión) no forma parte de este sprint**: se implementa en el Sprint #4 del
> backend y lo consume el Sprint #3 del frontend. En
> [Preparado para los próximos sprints](#preparado-para-los-próximos-sprints) queda documentado
> dónde va a entrar, pero sin implementarse.

---

## Stack

| Tecnología | Para qué se usa en el proyecto |
|---|---|
| **NestJS 12** | Framework del servidor. Arquitectura modular: `controller` (HTTP) → `service` (lógica) → `module` (ensamblado) |
| **TypeScript** | Tipado estático, compilado a **CommonJS** (ver `tsconfig.json`) |
| **MongoDB Atlas + Mongoose** | Base de datos en la nube y ODM (esquemas, modelos, `populate`) |
| **Cloudinary** | Almacenamiento de las imágenes de perfil (con CDN) |
| **bcrypt** | Hash de contraseñas con salt |
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
| `npm test` | Tests unitarios + tests HTTP con mocks (no tocan la base real) |
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

---

## Estructura del proyecto

```
backend/
├── assets/
│   └── perfil_default.png        # imagen por defecto (fuente de verdad; se sube 1 vez a Cloudinary)
├── scripts/
│   └── upload-default-avatar.js  # sube esa imagen a Cloudinary e imprime su URL
├── src/
│   ├── main.ts                   # arranque: DNS, CORS, ValidationPipe, puerto
│   ├── app.module.ts             # módulo raíz: .env + conexión a Mongo + importa los módulos
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts    # rutas HTTP (registro / login)
│   │   ├── auth.service.ts       # lógica: duplicados, bcrypt, Cloudinary, login
│   │   ├── auth.service.spec.ts  # tests unitarios (modelo y Cloudinary mockeados)
│   │   └── dto/
│   │       ├── register.dto.ts   # reglas de validación del registro
│   │       └── login.dto.ts      # reglas de validación del login
│   ├── usuarios/
│   │   ├── usuarios.module.ts    # registra y exporta el modelo de Mongoose
│   │   ├── schemas/usuario.schema.ts
│   │   └── utils/usuario-response.util.ts  # forma pública del usuario (_id → id)
│   ├── cloudinary/
│   │   ├── cloudinary.module.ts
│   │   └── cloudinary.service.ts # sube el buffer a Cloudinary
│   └── publicaciones/            # vacío: se completa en el Sprint #2
└── test/
    └── auth.e2e-spec.ts          # pruebas de la capa HTTP (AuthService mockeado, sin DB)
```

**Responsabilidad de cada módulo**

| Módulo | Responsabilidad |
|---|---|
| `AppModule` | Configuración global: carga el `.env` y la conexión a MongoDB; importa el resto de los módulos |
| `UsuariosModule` | Define el **modelo** `Usuario` (`forFeature`) y lo **exporta** para que otros módulos lo usen |
| `AuthModule` | Rutas de registro/login. Importa `UsuariosModule` (modelo) y `CloudinaryModule` (imágenes) |
| `CloudinaryModule` | Provee `CloudinaryService` (subida de archivos) |
| `PublicacionesModule` | Reservado para el Sprint #2 |

---

## Cómo funciona el código

### 1) Ciclo de vida de un request

```
Cliente (Postman / Angular)
   │  POST /auth/registro   (multipart/form-data)
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
201 Created + JSON
```

### 2) `src/main.ts` — arranque de la aplicación

| Línea | Qué hace y por qué |
|---|---|
| `dns.setServers(['8.8.8.8', '8.8.4.4'])` | Atlas se resuelve por registros **SRV**; en Windows eso falla con el DNS del sistema (`querySrv ECONNREFUSED`). Forzamos los DNS de Google |
| `app.enableCors()` | Sin esto el navegador bloquea las llamadas del front (Angular corre en otro puerto/dominio) |
| `new ValidationPipe({ whitelist, transform })` | `whitelist`: descarta campos no declarados en el DTO (no se puede inyectar `perfil: 'administrador'`). `transform`: convierte el body plano en instancia del DTO, necesario para que `@Transform` recorte espacios y pase el correo a minúsculas |
| `app.listen(process.env.PORT ?? 3000)` | Levanta el servidor HTTP |
| `void bootstrap()` | El `void` marca la promesa como "ignorada a propósito": evita el error de lint `no-floating-promises` |

### 3) `src/app.module.ts` — configuración global

```ts
ConfigModule.forRoot({ isGlobal: true }),

MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    uri: configService.getOrThrow<string>('MONGODB_URI'),
    dbName: configService.get<string>('MONGODB_DB') ?? 'redsocial',
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
- Todas las imágenes se guardan en la carpeta `red-social/perfiles`.
- Si Cloudinary falla, el error se loguea y se responde **500** (nunca 200).

### 8) Errores y códigos HTTP

| Situación | Código | Respuesta |
|---|---|---|
| Registro correcto | **201** | Usuario creado (sin contraseña) |
| Login correcto | **200** | Datos del usuario (`@HttpCode(HttpStatus.OK)`: un POST devolvería 201 por defecto) |
| Dato faltante o inválido (DTO) | **400** | Detalle por campo (`ValidationPipe`) |
| Archivo que no es imagen | **400** | `La imagen debe ser JPG, PNG, WEBP o GIF` (`fileFilter`) |
| Imagen de más de 5 MB | **413** | Multer corta la subida antes de llegar al service |
| Correo / usuario repetido | **409** | `El correo ya está registrado` / `El nombre de usuario ya está en uso` |
| Credenciales incorrectas | **401** | `Usuario/correo o contraseña incorrectos` |
| Falla Cloudinary o la base | **500** | Mensaje genérico; el detalle queda en el log del servidor |

---

## Endpoints

### `POST /auth/registro`

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
  "updatedAt": "2026-10-28T12:00:00.000Z"
}
```

### `POST /auth/login`

`Content-Type: application/json`

```json
{
  "identificador": "anamoreno",
  "password": "Segura123"
}
```

`identificador` acepta el **nombre de usuario** o el **correo**.
Respuesta **200**: el mismo objeto público del registro (sin `password`).

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
| **Testing** | `auth.service.spec.ts` (unitario con mocks) y `test/auth.e2e-spec.ts` (capa HTTP, sin base real) |

---

## Pruebas manuales

> En PowerShell, `curl` es un alias de `Invoke-WebRequest`. Usá `curl.exe` o Postman.

**1. Registro sin imagen → 201** (debe traer `DEFAULT_AVATAR_URL`)

```bash
curl -X POST http://localhost:3000/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=ana@correo.com" \
  -F "nombreUsuario=anamoreno" -F "password=Segura123" \
  -F "fechaNacimiento=1998-05-20" -F "descripcion=Hola!"
```

**2. Registro con imagen → 201** (la URL debe ser de Cloudinary)

```bash
curl -X POST http://localhost:3000/auth/registro \
  -F "nombre=Beto" -F "apellido=Díaz" -F "correo=beto@correo.com" \
  -F "nombreUsuario=betodiaz" -F "password=Segura123" \
  -F "fechaNacimiento=1995-01-10" -F "imagen=@C:/ruta/foto.jpg"
```

**3. Correo o usuario repetido → 409**

```bash
curl -X POST http://localhost:3000/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=ana@correo.com" \
  -F "nombreUsuario=otro" -F "password=Segura123" -F "fechaNacimiento=1998-05-20"
```

**4. Datos inválidos → 400** (mensajes por campo: contraseña débil, correo inválido, fecha mal formada)

```bash
curl -X POST http://localhost:3000/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=no-es-correo" \
  -F "nombreUsuario=ana" -F "password=debil" -F "fechaNacimiento=ayer"
```

**5. Archivo que no es imagen → 400**

```bash
curl -X POST http://localhost:3000/auth/registro \
  -F "nombre=Ana" -F "apellido=Moreno" -F "correo=ana2@correo.com" \
  -F "nombreUsuario=ana2" -F "password=Segura123" -F "fechaNacimiento=1998-05-20" \
  -F "imagen=@C:/ruta/documento.pdf"
```

**6. Login con nombre de usuario / con correo → 200**

```bash
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"identificador":"anamoreno","password":"Segura123"}'

curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"identificador":"ana@correo.com","password":"Segura123"}'
```

**7. Contraseña incorrecta o usuario inexistente → 401**

```bash
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"identificador":"anamoreno","password":"Incorrecta1"}'
```

**8. En Atlas:** la base `redsocial` aparece sola en el cluster (Mongo la crea al insertar el primer
documento), dentro de la colección `usuarios`, con `password` guardado como hash `$2b$10$...`.

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

- **Sprint #2 — Publicaciones:** `PublicacionesModule` ya está importado en `AppModule` (vacío). Solo
  hay que agregar el esquema `Publicacion` con `@Prop({ type: Types.ObjectId, ref: 'Usuario' })`
  y el `timestamps: true` que ya tienen los usuarios para ordenar por fecha.
- **Sprint #3 — Frontend (Angular):** CORS habilitado y respuestas con `id` (no `_id`), así el front
  puede tipar `Usuario { id: string; ... }` y mostrar `imagenPerfilUrl` directamente.
- **Sprint #4 — JWT (backend):** el login de este sprint devuelve los datos del usuario; en el #4 se
  agrega `JwtModule` y el `AuthService.login()` devuelve además `access_token` (payload
  `{ sub: id, perfil }`), con un `AuthGuard` para proteger las rutas. **No se implementa acá** porque
  el enunciado lo ubica más adelante.

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
- [ ] JWT → Sprint #4 (backend)
- [ ] Publicaciones → Sprint #2 (backend)
