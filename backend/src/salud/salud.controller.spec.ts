import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { Connection } from 'mongoose';
import { SaludController } from './salud.controller';

const crearResponse = () => {
  const status = jest.fn();
  return { status } as unknown as Response & { status: jest.Mock };
};

const crearConexion = (readyState: number, name = 'redsocial') =>
  ({ readyState, name }) as unknown as Connection;

describe('SaludController', () => {
  const crearControlador = async (
    conexion: Connection,
  ): Promise<SaludController> => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaludController],
      providers: [{ provide: getConnectionToken(), useValue: conexion }],
    }).compile();

    return module.get<SaludController>(SaludController);
  };

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('responde 200 y ok: true cuando Mongo está conectado', async () => {
    const controller = await crearControlador(crearConexion(1));
    const response = crearResponse();

    const estado = controller.estado(response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(estado.ok).toBe(true);
    expect(estado.mongo).toBe('conectado');
    expect(estado.baseDeDatos).toBe('redsocial');
  });

  it('responde 503 y ok: false cuando la conexión está caída', async () => {
    const controller = await crearControlador(crearConexion(0));
    const response = crearResponse();

    const estado = controller.estado(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(estado.ok).toBe(false);
    expect(estado.mongo).toBe('desconectado');
  });

  it('informa si las variables de entorno están cargadas, sin exponer sus valores', async () => {
    process.env.JWT_SECRET = 'secreto-que-no-debe-salir';
    const controller = await crearControlador(crearConexion(1));

    const estado = controller.estado(crearResponse());

    expect(estado.variablesDeEntorno['JWT_SECRET']).toBe(true);
    expect(JSON.stringify(estado)).not.toContain('secreto-que-no-debe-salir');
  });
});
