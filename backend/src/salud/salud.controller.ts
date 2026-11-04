import { Controller, Get, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Response } from 'express';
import { Connection } from 'mongoose';

/** Nombre legible de cada `readyState` de Mongoose. */
const ESTADOS_MONGO: Record<number, string> = {
  0: 'desconectado',
  1: 'conectado',
  2: 'conectando',
  3: 'desconectando',
  99: 'sin inicializar',
};

/**
 * Variables que la API necesita en producción. Acá sólo se informa **si
 * existen** (`true`/`false`), nunca su valor: sirve para detectar en segundos
 * una variable que no se cargó en Vercel.
 */
const VARIABLES_DE_ENTORNO = [
  'MONGODB_URI',
  'MONGODB_DB',
  'CLOUD_NAME',
  'API_KEY',
  'API_SECRET',
  'DEFAULT_AVATAR_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
] as const;

/**
 * `GET /api/salud` — diagnóstico del deploy, público (sin token).
 *
 * Es la primera URL que hay que abrir si el registro o el login responden 500:
 * dice si la API arrancó, si la conexión a Atlas está establecida y si las
 * variables de entorno llegaron al servidor.
 *
 * Responde **503** cuando Mongo no está conectado, pero siempre con un cuerpo
 * JSON (así un monitor externo también lo puede leer).
 */
@Controller('salud')
export class SaludController {
  constructor(@InjectConnection() private readonly conexion: Connection) {}

  @Get()
  estado(@Res({ passthrough: true }) response: Response) {
    const readyState = this.conexion?.readyState ?? 99;
    const conectado = readyState === 1;

    response.status(conectado ? 200 : 503);

    return {
      ok: conectado,
      mongo: ESTADOS_MONGO[readyState] ?? `desconocido (${readyState})`,
      baseDeDatos: this.conexion?.name ?? null,
      variablesDeEntorno: this.variablesCargadas(),
      plataforma: process.env.VERCEL ? 'vercel' : 'local',
      uptimeEnSegundos: Math.round(process.uptime()),
      fecha: new Date().toISOString(),
    };
  }

  /** Sólo `true`/`false` por variable: los valores nunca salen de la API. */
  private variablesCargadas(): Record<string, boolean> {
    const cargadas: Record<string, boolean> = {};

    for (const nombre of VARIABLES_DE_ENTORNO) {
      cargadas[nombre] = Boolean(process.env[nombre]);
    }

    return cargadas;
  }
}
