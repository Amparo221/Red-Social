import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

// Host de ArgumentsHost con la respuesta de Express simulada: alcanza con
// `headersSent`, `status()` y `json()`, que es lo que usa el filtro.
const crearContexto = (headersSent = false) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ headersSent, status }),
      getRequest: () => ({ method: 'POST', url: '/api/auth/registro' }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logDeError: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // El filtro loguea a propósito; en los tests no hace falta verlo.
    logDeError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('conserva el status y el array de mensajes del ValidationPipe', () => {
    const { host, status, json } = crearContexto();

    filter.catch(
      new BadRequestException([
        'nombre should not be empty',
        'correo must be an email',
      ]),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['nombre should not be empty', 'correo must be an email'],
      error: 'Bad Request',
    });
  });

  it('mantiene el status y el mensaje de una HttpException simple', () => {
    const { host, json } = crearContexto();

    filter.catch(
      new HttpException('Falla controlada', HttpStatus.BAD_GATEWAY),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_GATEWAY,
      message: 'Falla controlada',
      error: 'HttpException',
    });
  });

  it('agrega el detalle de los 500 que arma la API', () => {
    const { host, status, json } = crearContexto();

    filter.catch(
      new InternalServerErrorException({
        statusCode: 500,
        message: 'No se pudo crear el usuario',
        error: 'Internal Server Error',
        detalle: 'bad auth : authentication failed',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'No se pudo crear el usuario',
      error: 'Internal Server Error',
      detalle: 'bad auth : authentication failed',
    });
  });

  it('convierte un error inesperado en un 500 con el detalle y el stack en el log', () => {
    const { host, status, json } = crearContexto();

    filter.catch(
      new Error('MongooseServerSelectionError: connect ECONNREFUSED'),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      detalle: 'MongooseServerSelectionError: connect ECONNREFUSED',
    });
    expect(logDeError).toHaveBeenCalled();
  });

  it('no vuelve a escribir la respuesta si los headers ya se enviaron', () => {
    const { host, status, json } = crearContexto(true);

    filter.catch(new Error('la respuesta ya había empezado'), host);

    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
