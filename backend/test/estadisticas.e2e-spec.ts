import {
  BadRequestException,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from './../src/auth/guards/roles.guard';
import { EstadisticasController } from './../src/estadisticas/estadisticas.controller';
import { EstadisticasService } from './../src/estadisticas/estadisticas.service';
import type { UsuarioAutenticado } from './../src/auth/interfaces/jwt-payload.interface';

const ADMIN: UsuarioAutenticado = {
  id: '507f1f77bcf86cd799439011',
  nombreUsuario: 'adaadmin',
  perfil: 'administrador',
};

const USUARIO_COMUN: UsuarioAutenticado = {
  id: '507f1f77bcf86cd799439012',
  nombreUsuario: 'anamoreno',
  perfil: 'usuario',
};

const RESPUESTA = {
  rango: {
    desde: '2026-11-01T03:00:00.000Z',
    hasta: '2026-11-03T02:59:59.999Z',
    agrupacion: 'dia',
    limite: 10,
  },
  totales: {
    publicaciones: 5,
    usuariosConPublicaciones: 2,
    comentarios: 4,
    publicacionesConComentarios: 1,
  },
  publicacionesPorUsuario: [],
  comentariosPorPeriodo: [],
  comentariosPorPublicacion: [],
};

/**
 * Test de la capa HTTP de /estadisticas (routing, ValidationPipe, guards y
 * códigos de estado) sin MongoDB: el servicio y el guard de sesión se
 * reemplazan por dobles. `RolesGuard` se usa real, es lo que prueba el 403.
 */
describe('Estadísticas (e2e)', () => {
  let app: INestApplication<App>;
  let usuarioDelToken: UsuarioAutenticado = ADMIN;

  const estadisticasServiceMock = { obtener: jest.fn() };

  const guardMock = {
    canActivate: (contexto: ExecutionContext): boolean => {
      const peticion = contexto.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        usuario?: unknown;
      }>();

      if (!peticion.headers.authorization?.startsWith('Bearer ')) {
        throw new UnauthorizedException('Falta el token de autenticación');
      }

      peticion.usuario = usuarioDelToken;
      return true;
    },
  };

  const conToken = () => ({ Authorization: 'Bearer token-de-prueba' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EstadisticasController],
      providers: [
        { provide: EstadisticasService, useValue: estadisticasServiceMock },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // Mismo prefijo que src/main.ts y que el rewrite de Vercel.
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuarioDelToken = ADMIN;
  });

  it('devuelve 401 si no viene el token', async () => {
    await request(app.getHttpServer()).get('/api/estadisticas').expect(401);

    expect(estadisticasServiceMock.obtener).not.toHaveBeenCalled();
  });

  it('devuelve 403 a un usuario que no es administrador', async () => {
    usuarioDelToken = USUARIO_COMUN;

    await request(app.getHttpServer())
      .get('/api/estadisticas')
      .set(conToken())
      .expect(403);

    expect(estadisticasServiceMock.obtener).not.toHaveBeenCalled();
  });

  it('devuelve 200 con las tres métricas al administrador', async () => {
    estadisticasServiceMock.obtener.mockResolvedValue(RESPUESTA);

    const respuesta = await request(app.getHttpServer())
      .get('/api/estadisticas')
      .query({
        desde: '2026-11-01',
        hasta: '2026-11-03',
        agrupacion: 'dia',
        limite: '5',
      })
      .set(conToken())
      .expect(200);

    expect(respuesta.body).toEqual(RESPUESTA);
    // El ValidationPipe transforma la query en una instancia del DTO: `limite`
    // llega como número y no como el string de la URL.
    expect(estadisticasServiceMock.obtener).toHaveBeenCalledWith(
      expect.objectContaining({
        desde: '2026-11-01',
        hasta: '2026-11-03',
        agrupacion: 'dia',
        limite: 5,
      }),
    );
  });

  it('aplica los valores por defecto cuando no se manda la query', async () => {
    estadisticasServiceMock.obtener.mockResolvedValue(RESPUESTA);

    await request(app.getHttpServer())
      .get('/api/estadisticas')
      .set(conToken())
      .expect(200);

    expect(estadisticasServiceMock.obtener).toHaveBeenCalledWith(
      expect.objectContaining({ agrupacion: 'dia', limite: 10 }),
    );
  });

  it('devuelve 400 si la agrupación no es válida', async () => {
    await request(app.getHttpServer())
      .get('/api/estadisticas')
      .query({ agrupacion: 'hora' })
      .set(conToken())
      .expect(400);

    expect(estadisticasServiceMock.obtener).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el límite está fuera de rango', async () => {
    await request(app.getHttpServer())
      .get('/api/estadisticas')
      .query({ limite: '2' })
      .set(conToken())
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/estadisticas')
      .query({ limite: '50' })
      .set(conToken())
      .expect(400);

    expect(estadisticasServiceMock.obtener).not.toHaveBeenCalled();
  });

  it('devuelve 400 si una fecha no es válida', async () => {
    await request(app.getHttpServer())
      .get('/api/estadisticas')
      .query({ desde: 'ayer' })
      .set(conToken())
      .expect(400);

    expect(estadisticasServiceMock.obtener).not.toHaveBeenCalled();
  });

  it('propaga el 400 del servicio cuando el rango es inválido', async () => {
    estadisticasServiceMock.obtener.mockRejectedValue(
      new BadRequestException('hasta no puede ser anterior a desde'),
    );

    const respuesta = await request(app.getHttpServer())
      .get('/api/estadisticas')
      .query({ desde: '2026-11-10', hasta: '2026-11-01' })
      .set(conToken())
      .expect(400);

    expect(respuesta.body.message).toBe(
      'hasta no puede ser anterior a desde',
    );
  });
});
