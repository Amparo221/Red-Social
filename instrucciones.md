# Plan de Requisitos - Backend Sprint #1 (Red Social)
**Basado en las clases de NestJS, MongoDB, JWT, Subida de Archivos y Populate.**

El objetivo de este sprint es dejar preparada la arquitectura base del servidor, la conexión con la base de datos en la nube y el flujo de registro de usuarios (incluyendo la subida de su imagen de perfil), tal como el profesor fue construyendo en las clases.

## 1. Inicialización y Arquitectura Base
- **Creación del Proyecto:** El proyecto debe generarse utilizando el CLI de Nest (`nest new`). Según lo visto en clase, se debe seleccionar **npm** como gestor de paquetes y **CommonJS** como sistema de módulos para evitar problemas con las extensiones en las importaciones.
- **Módulos Obligatorios:** La aplicación debe estar organizada de forma modular. Para este sprint, se deben generar los módulos de `Auth`, `Usuarios` y `Publicaciones` (este último quedará preparado para el Sprint 2).
- **Limpieza:** Se deben eliminar los controladores y servicios por defecto (`app.controller.ts`, `app.service.ts`) y desvincularlos del `AppModule`, para evitar código residual.

## 2. Conexión a la Base de Datos (MongoDB Atlas)
- **Configuración en la Nube:** Se debe crear un clúster gratuito en MongoDB Atlas y configurar las credenciales (usuario y contraseña) y los accesos de red (IP).
- **Módulo de Mongoose:** La aplicación debe conectarse a la base de datos importando `MongooseModule.forRoot()` en el `AppModule`.
- **Variables de Entorno:** Siguiendo la buena práctica explicada, el *connection string* no debe quedar expuesto en el código. Se debe utilizar la librería `@nestjs/config` para leer la URI desde un archivo `.env` (el cual estará ignorado en Git).
- **Nota de la clase:** Si se presenta el error de DNS en Windows (`querySrv ECONNREFUSED`), se debe forzar el uso de DNS públicos (ej. Google) en el `main.ts` utilizando `dns.setServers()`.

## 3. Modelado de Datos y Validaciones
- **Esquema de Usuario:** Se debe crear la entidad `Usuario` utilizando los decoradores de Mongoose (`@Schema`, `@Prop`). Los campos requeridos por el TP son: nombre, apellido, correo (único), nombreUsuario (único), password, fechaNacimiento, descripción, imagenPerfilUrl y perfil (con valor por defecto `'usuario'`).
- **Validación en el DTO:** Para el registro, se debe crear un `RegisterDto`. El profesor hizo hincapié en el uso de `class-validator` y `class-transformer`. Es fundamental habilitar el `ValidationPipe` de forma global en el `main.ts` para que las validaciones se apliquen automáticamente.
- **Reglas de Validación:** Se debe validar que la contraseña tenga al menos 8 caracteres, una mayúscula y un número (usando `@Matches`), tal como exige la consigna.

## 4. Manejo de Contraseñas (Seguridad)
- **Hasheo:** El profesor explicó el uso de la librería `bcrypt` para encriptar las contraseñas antes de guardarlas en la base de datos.
- **Lógica en AuthService:** En el método de registro, se debe generar un "salt" y hashear la contraseña recibida. En el método de login, se debe usar el método `compare` de bcrypt para verificar que la contraseña plana coincida con el hash guardado, lanzando un error `Unauthorized` (401) genérico si falla.

## 5. Subida de Imágenes de Perfil (Cloudinary)
- **Librerías:** Se deben instalar `cloudinary` y `buffer-to-stream` (esta última es necesaria para transformar el buffer del archivo en un stream que Cloudinary pueda leer, tal como se explicó en la clase de subida de archivos).
- **Interceptor de Multer:** Para capturar el archivo desde el controlador, se debe usar el decorador `@UseInterceptors(FileInterceptor('imagen'))` de `@nestjs/platform-express`, y recibir el archivo con `@UploadedFile()`.
- **Servicio de Cloudinary:** Se debe configurar el cliente de Cloudinary con las credenciales (idealmente desde el `.env`) y crear un método que reciba el archivo (`Express.Multer.File`), lo suba mediante un stream y retorne la URL segura (`secure_url`).
- **Integración en Registro:** El flujo del registro debe ser: recibir los datos y el archivo, verificar que el usuario no exista, hashear la contraseña, subir la imagen a Cloudinary para obtener la URL, guardar el usuario en la base de datos y devolver el usuario creado (sin el campo password).

## 6. Relación de Documentos (Preparación para el Sprint 2)
Aunque en este sprint solo se registran usuarios, el profesor adelantó el concepto de **Populate** para futuras relaciones (como publicaciones con usuarios):
- Se debe tener en cuenta que las relaciones en Mongoose se hacen guardando el `ObjectId` de la entidad relacionada (ej. en el modelo de Publicación se guardará el ID del Usuario que la creó).
- Para traer los datos completos de esa relación, se utilizará el método `.populate('nombreDelCampo')` en las consultas del servicio.

## 7. Configuración de Red
- **CORS:** Para permitir que el frontend en Angular (que correrá en otro puerto) pueda comunicarse con el backend, se debe habilitar CORS en el archivo `main.ts` usando `app.enableCors()`.