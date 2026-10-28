import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './../src/auth/auth.controller';
import { AuthService } from './../src/auth/auth.service';

// Test de la capa HTTP (routing + ValidationPipe + códigos de estado) sin
// conectarse a MongoDB Atlas: el AuthService se reemplaza por un mock.
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const authServiceMock = {
    registrar: jest.fn(),
    login: jest.fn(),
  };

  const registroValido = {
    nombre: 'Ana',
    apellido: 'Moreno',
    correo: 'ana@correo.com',
    nombreUsuario: 'anamoreno',
    password: 'Segura123',
    fechaNacimiento: '1998-05-20',
    descripcion: 'Hola!',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/registro', () => {
    it('devuelve 201 cuando los datos son válidos', async () => {
      authServiceMock.registrar.mockResolvedValue({ id: '1', nombreUsuario: 'anamoreno' });

      const respuesta = await request(app.getHttpServer())
        .post('/auth/registro')
        .send(registroValido)
        .expect(201);

      expect(respuesta.body).toEqual({ id: '1', nombreUsuario: 'anamoreno' });
      expect(authServiceMock.registrar).toHaveBeenCalledTimes(1);
    });

    it('devuelve 400 si el correo es inválido o la contraseña es débil', async () => {
      await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ ...registroValido, correo: 'no-es-un-correo', password: 'debil' })
        .expect(400);

      expect(authServiceMock.registrar).not.toHaveBeenCalled();
    });

    it('normaliza el correo a minúsculas y recorta los espacios', async () => {
      authServiceMock.registrar.mockResolvedValue({ id: '2' });

      await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ ...registroValido, correo: '  ANA@Correo.COM ', nombre: '  Ana  ' })
        .expect(201);

      expect(authServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ correo: 'ana@correo.com', nombre: 'Ana' }),
        undefined,
      );
    });

    it('recorta los espacios de la contraseña y guarda el nombre de usuario en minúsculas', async () => {
      authServiceMock.registrar.mockResolvedValue({ id: '3' });

      await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ ...registroValido, nombreUsuario: '  AnaMoreno  ', password: '  Segura123  ' })
        .expect(201);

      // Un tab o un espacio invisible (copiar y pegar) no tiene que llegar al hash.
      expect(authServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ nombreUsuario: 'anamoreno', password: 'Segura123' }),
        undefined,
      );
    });
  });

  describe('POST /auth/login', () => {
    it('devuelve 200 (no 201) con credenciales válidas', async () => {
      authServiceMock.login.mockResolvedValue({ id: '1', nombreUsuario: 'anamoreno' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identificador: 'anamoreno', password: 'Segura123' })
        .expect(200);

      expect(authServiceMock.login).toHaveBeenCalledWith('anamoreno', 'Segura123');
    });

    it('devuelve 400 si falta la contraseña', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identificador: 'anamoreno' })
        .expect(400);

      expect(authServiceMock.login).not.toHaveBeenCalled();
    });

    it('recorta los espacios (incluido el tab del copy/paste) del identificador y la contraseña', async () => {
      authServiceMock.login.mockResolvedValue({ id: '1' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identificador: ' AnaMoreno ', password: '\tSegura123 ' })
        .expect(200);

      // Sin este recorte, el login devolvería 401 comparando " Segura123" contra
      // el hash de "Segura123" (bug real: el tab invisible viaja en el portapapeles).
      expect(authServiceMock.login).toHaveBeenCalledWith('anamoreno', 'Segura123');
    });
  });
});
