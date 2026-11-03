import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { PublicacionesController } from './../src/publicaciones/publicaciones.controller';
import { PublicacionesService } from './../src/publicaciones/publicaciones.service';

const ID_PUBLICACION = '507f1f77bcf86cd799439011';
const ID_AUTOR = '507f1f77bcf86cd799439012';

const usuarioDelToken = { id: ID_AUTOR, nombreUsuario: 'anamoreno', perfil: 'usuario' };

/**
 * Test de la capa HTTP (routing, ValidationPipe, guard y códigos de estado) sin
 * MongoDB ni Cloudinary: el servicio y el guard se reemplazan por dobles.
 */
describe('Publicaciones (e2e)', () => {
  let app: INestApplication<App>;

  const publicacionesServiceMock = {
    crear: jest.fn(),
    listar: jest.fn(),
    darLike: jest.fn(),
    quitarLike: jest.fn(),
    eliminar: jest.fn(),
  };

  // Guard falso: exige el header Bearer y deja el usuario en el request, igual
  // que el real, pero sin verificar la firma del JWT.
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
      controllers: [PublicacionesController],
      providers: [{ provide: PublicacionesService, useValue: publicacionesServiceMock }],
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
  });

  describe('POST /api/publicaciones', () => {
    it('devuelve 401 si no viene el token', async () => {
      await request(app.getHttpServer())
        .post('/api/publicaciones')
        .field('titulo', 'Colibrí')
        .field('descripcion', 'Lo vi en el jardín')
        .expect(401);

      expect(publicacionesServiceMock.crear).not.toHaveBeenCalled();
    });

    it('devuelve 201 y crea la publicación con el usuario del token', async () => {
      publicacionesServiceMock.crear.mockResolvedValue({ id: ID_PUBLICACION, titulo: 'Colibrí' });

      const respuesta = await request(app.getHttpServer())
        .post('/api/publicaciones')
        .set(conToken())
        .field('titulo', 'Colibrí garganta rubí')
        .field('descripcion', 'Lo vi en el jardín')
        .field('nombreComun', 'Colibrí garganta rubí')
        .field('nombreCientifico', 'Archilochus colubris')
        .expect(201);

      expect(respuesta.body).toEqual({ id: ID_PUBLICACION, titulo: 'Colibrí' });
      expect(publicacionesServiceMock.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Colibrí garganta rubí',
          nombreComun: 'Colibrí garganta rubí',
          nombreCientifico: 'Archilochus colubris',
        }),
        usuarioDelToken,
        undefined,
      );
    });

    it('devuelve 400 si falta el título', async () => {
      await request(app.getHttpServer())
        .post('/api/publicaciones')
        .set(conToken())
        .field('descripcion', 'Sin título')
        .expect(400);

      expect(publicacionesServiceMock.crear).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/publicaciones', () => {
    it('devuelve 200 con la paginación por defecto', async () => {
      publicacionesServiceMock.listar.mockResolvedValue({
        total: 0,
        offset: 0,
        limit: 5,
        orden: 'fecha',
        hayMas: false,
        publicaciones: [],
      });

      await request(app.getHttpServer())
        .get('/api/publicaciones')
        .set(conToken())
        .expect(200);

      // Los defaults del DTO se aplican cuando el query string viene vacío.
      expect(publicacionesServiceMock.listar).toHaveBeenCalledWith(
        { offset: 0, limit: 5, orden: 'fecha' },
        usuarioDelToken,
      );
    });

    it('convierte offset y limit a números y respeta el orden pedido', async () => {
      publicacionesServiceMock.listar.mockResolvedValue({ publicaciones: [] });

      await request(app.getHttpServer())
        .get('/api/publicaciones?offset=10&limit=20&orden=likes')
        .set(conToken())
        .expect(200);

      expect(publicacionesServiceMock.listar).toHaveBeenCalledWith(
        { offset: 10, limit: 20, orden: 'likes' },
        usuarioDelToken,
      );
    });

    it('pasa el filtro por usuario al servicio', async () => {
      publicacionesServiceMock.listar.mockResolvedValue({ publicaciones: [] });

      await request(app.getHttpServer())
        .get(`/api/publicaciones?usuario=${ID_AUTOR}`)
        .set(conToken())
        .expect(200);

      expect(publicacionesServiceMock.listar).toHaveBeenCalledWith(
        expect.objectContaining({ usuario: ID_AUTOR }),
        usuarioDelToken,
      );
    });

    it('devuelve 400 si offset no es un número', async () => {
      await request(app.getHttpServer())
        .get('/api/publicaciones?offset=abc')
        .set(conToken())
        .expect(400);
    });

    it('devuelve 400 si el orden no es fecha ni likes', async () => {
      await request(app.getHttpServer())
        .get('/api/publicaciones?orden=autor')
        .set(conToken())
        .expect(400);
    });

    it('devuelve 400 si limit supera el máximo permitido', async () => {
      await request(app.getHttpServer())
        .get('/api/publicaciones?limit=999')
        .set(conToken())
        .expect(400);
    });

    it('devuelve 400 si el usuario no es un id válido', async () => {
      await request(app.getHttpServer())
        .get('/api/publicaciones?usuario=no-es-un-id')
        .set(conToken())
        .expect(400);
    });
  });

  describe('POST /api/publicaciones/:id/like', () => {
    it('devuelve 201 con el contador actualizado', async () => {
      publicacionesServiceMock.darLike.mockResolvedValue({
        id: ID_PUBLICACION,
        cantidadLikes: 1,
        likeado: true,
      });

      const respuesta = await request(app.getHttpServer())
        .post(`/api/publicaciones/${ID_PUBLICACION}/like`)
        .set(conToken())
        .expect(201);

      expect(respuesta.body).toEqual({ id: ID_PUBLICACION, cantidadLikes: 1, likeado: true });
      expect(publicacionesServiceMock.darLike).toHaveBeenCalledWith(ID_PUBLICACION, usuarioDelToken);
    });

    it('devuelve 400 si el id de la ruta no es un ObjectId', async () => {
      // Sin el pipe, Mongoose lanzaría un CastError y el cliente vería un 500.
      await request(app.getHttpServer())
        .post('/api/publicaciones/123/like')
        .set(conToken())
        .expect(400);

      expect(publicacionesServiceMock.darLike).not.toHaveBeenCalled();
    });

    it('devuelve 409 si el usuario ya había dado me gusta', async () => {
      publicacionesServiceMock.darLike.mockRejectedValue(
        new ConflictException('Ya le diste me gusta a esta publicación'),
      );

      await request(app.getHttpServer())
        .post(`/api/publicaciones/${ID_PUBLICACION}/like`)
        .set(conToken())
        .expect(409);
    });

    it('devuelve 404 si la publicación no existe', async () => {
      publicacionesServiceMock.darLike.mockRejectedValue(
        new NotFoundException('La publicación no existe o fue eliminada'),
      );

      await request(app.getHttpServer())
        .post(`/api/publicaciones/${ID_PUBLICACION}/like`)
        .set(conToken())
        .expect(404);
    });
  });

  describe('DELETE /api/publicaciones/:id/like', () => {
    it('devuelve 200 con el contador actualizado', async () => {
      publicacionesServiceMock.quitarLike.mockResolvedValue({
        id: ID_PUBLICACION,
        cantidadLikes: 0,
        likeado: false,
      });

      const respuesta = await request(app.getHttpServer())
        .delete(`/api/publicaciones/${ID_PUBLICACION}/like`)
        .set(conToken())
        .expect(200);

      expect(respuesta.body).toEqual({ id: ID_PUBLICACION, cantidadLikes: 0, likeado: false });
      expect(publicacionesServiceMock.quitarLike).toHaveBeenCalledWith(
        ID_PUBLICACION,
        usuarioDelToken,
      );
    });

    it('devuelve 409 si el usuario no había dado me gusta', async () => {
      publicacionesServiceMock.quitarLike.mockRejectedValue(
        new ConflictException('No habías dado me gusta a esta publicación'),
      );

      await request(app.getHttpServer())
        .delete(`/api/publicaciones/${ID_PUBLICACION}/like`)
        .set(conToken())
        .expect(409);
    });
  });

  describe('DELETE /api/publicaciones/:id', () => {
    it('devuelve 200 cuando el autor da de baja su publicación', async () => {
      const fechaEliminacion = '2026-11-02T10:00:00.000Z';
      publicacionesServiceMock.eliminar.mockResolvedValue({
        id: ID_PUBLICACION,
        eliminado: true,
        fechaEliminacion,
      });

      const respuesta = await request(app.getHttpServer())
        .delete(`/api/publicaciones/${ID_PUBLICACION}`)
        .set(conToken())
        .expect(200);

      expect(respuesta.body.eliminado).toBe(true);
      expect(publicacionesServiceMock.eliminar).toHaveBeenCalledWith(
        ID_PUBLICACION,
        usuarioDelToken,
      );
    });

    it('devuelve 401 sin token', async () => {
      await request(app.getHttpServer())
        .delete(`/api/publicaciones/${ID_PUBLICACION}`)
        .expect(401);

      expect(publicacionesServiceMock.eliminar).not.toHaveBeenCalled();
    });
  });
});
