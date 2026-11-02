import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dns from 'dns';
import { AppModule } from './app.module';

// En Windows la resolución de los registros SRV que necesita MongoDB Atlas
// falla con el DNS del sistema (querySrv ECONNREFUSED), así que forzamos los
// DNS públicos de Google antes de crear la aplicación.
// En Vercel el resolver lo administra la plataforma, así que ahí no se toca.
if (!process.env.VERCEL) {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Sin CORS habilitado, el navegador bloquea las llamadas del front (Angular),
  // porque corre en otro puerto/dominio (http://localhost:4200).
  app.enableCors();

  // ValidationPipe global:
  //  - valida cada @Body() contra su DTO usando class-validator,
  //  - `transform` convierte el objeto plano de la request en una instancia
  //    del DTO para que class-transformer aplique @Transform (trim, minúsculas),
  //  - `whitelist` descarta los campos que no están declarados en el DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Vercel enruta `/api/*` al servicio `backend` del vercel.json SIN recortar el
  // path (el destino de un rewrite de services no cambia la ruta que ve el
  // código), así que la API queda montada bajo /api:
  //   /api/auth/registro  y  /api/auth/login
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
