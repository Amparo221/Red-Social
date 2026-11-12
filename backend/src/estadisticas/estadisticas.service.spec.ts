import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Comentario } from '../comentarios/schemas/comentario.schema';
import { Publicacion } from '../publicaciones/schemas/publicacion.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { ConsultarEstadisticasDto } from './dto/consultar-estadisticas.dto';
import { EstadisticasService } from './estadisticas.service';
import {
  diaEnArgentina,
  finDelDia,
  inicioDelDia,
  sumarDias,
} from './utils/periodos.util';

const ID_ANA = '507f1f77bcf86cd799439011';
const ID_BETO = '507f1f77bcf86cd799439012';
const ID_PUBLICACION = '507f1f77bcf86cd799439021';
const ID_OTRA_PUBLICACION = '507f1f77bcf86cd799439022';

/** Etapa de una pipeline de agregación (lo único que miran los tests). */
interface EtapaPipeline {
  $match?: Record<string, unknown>;
  $group?: { _id?: unknown; total?: unknown };
}

const oid = (id: string) => new Types.ObjectId(id);

/** DTO con un rango fijo de tres días; cada test lo ajusta si lo necesita. */
const rangoDto = (extra: Partial<ConsultarEstadisticasDto> = {}) =>
  Object.assign(new ConsultarEstadisticasDto(), {
    desde: '2026-11-01',
    hasta: '2026-11-03',
    agrupacion: 'dia' as const,
    limite: 10,
    ...extra,
  });

/** Simula `aggregate(...).exec()`. */
const cadenaAggregate = (filas: unknown[]) => ({
  exec: jest.fn().mockResolvedValue(filas),
});

/** Simula `find().select().populate().exec()`. */
const cadenaFind = (resultado: unknown[]) => {
  const cadena = {
    select: jest.fn(),
    populate: jest.fn(),
    exec: jest.fn().mockResolvedValue(resultado),
  };
  cadena.select.mockReturnValue(cadena);
  cadena.populate.mockReturnValue(cadena);

  return cadena;
};

/** true si la pipeline agrupa por fecha (la métrica de la serie temporal). */
const esPorPeriodo = (pipeline: EtapaPipeline[]): boolean => {
  const id = pipeline[1]?.$group?._id;
  return typeof id === 'object' && id !== null && '$dateToString' in id;
};

describe('EstadisticasService', () => {
  let servicio: EstadisticasService;
  let publicacionModel: { aggregate: jest.Mock; find: jest.Mock };
  let comentarioModel: { aggregate: jest.Mock };
  let usuarioModel: { find: jest.Mock };

  beforeEach(async () => {
    publicacionModel = { aggregate: jest.fn(), find: jest.fn() };
    comentarioModel = { aggregate: jest.fn() };
    usuarioModel = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadisticasService,
        {
          provide: getModelToken(Publicacion.name),
          useValue: publicacionModel,
        },
        {
          provide: getModelToken(Comentario.name),
          useValue: comentarioModel,
        },
        {
          provide: getModelToken(Usuario.name),
          useValue: usuarioModel,
        },
      ],
    }).compile();

    servicio = module.get(EstadisticasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /** Deja los tres modelos respondiendo "no hay nada" en el rango. */
  const prepararVacio = (): void => {
    publicacionModel.aggregate.mockReturnValue(cadenaAggregate([]));
    publicacionModel.find.mockReturnValue(cadenaFind([]));
    usuarioModel.find.mockReturnValue(cadenaFind([]));
    comentarioModel.aggregate.mockReturnValue(cadenaAggregate([]));
  };

  it('usa los últimos 30 días cuando no se manda el rango', async () => {
    prepararVacio();

    const resultado = await servicio.obtener(new ConsultarEstadisticasDto());
    const hoy = diaEnArgentina(new Date());

    expect(resultado.comentariosPorPeriodo).toHaveLength(30);
    expect(resultado.rango.desde).toBe(
      inicioDelDia(sumarDias(hoy, -29)).toISOString(),
    );
    expect(resultado.rango.hasta).toBe(finDelDia(hoy).toISOString());
  });

  it('filtra por comentarios vigentes y agrupa en hora argentina', async () => {
    prepararVacio();

    await servicio.obtener(rangoDto({ agrupacion: 'semana' }));

    const pipeline: EtapaPipeline[] = comentarioModel.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({
      eliminado: false,
      createdAt: {
        $gte: new Date('2026-11-01T03:00:00.000Z'),
        $lte: new Date('2026-11-04T02:59:59.999Z'),
      },
    });
    expect(pipeline[1].$group?._id).toEqual({
      $dateToString: {
        date: '$createdAt',
        format: '%G-W%V',
        timezone: 'America/Argentina/Buenos_Aires',
      },
    });
  });

  it('agrupa las publicaciones por autor', async () => {
    prepararVacio();

    await servicio.obtener(rangoDto());

    const pipeline: EtapaPipeline[] =
      publicacionModel.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({
      eliminado: false,
      createdAt: {
        $gte: new Date('2026-11-01T03:00:00.000Z'),
        $lte: new Date('2026-11-04T02:59:59.999Z'),
      },
    });
    expect(pipeline[1].$group).toEqual({
      _id: '$usuario',
      total: { $sum: 1 },
    });
  });

  it('recorta el ranking al límite sin perder los totales', async () => {
    prepararVacio();
    publicacionModel.aggregate.mockReturnValue(
      cadenaAggregate([
        { _id: oid(ID_ANA), total: 5 },
        { _id: oid(ID_BETO), total: 4 },
        { _id: oid('507f1f77bcf86cd799439013'), total: 3 },
        { _id: oid('507f1f77bcf86cd799439014'), total: 2 },
        { _id: oid('507f1f77bcf86cd799439015'), total: 1 },
      ]),
    );

    const resultado = await servicio.obtener(rangoDto({ limite: 3 }));

    expect(resultado.publicacionesPorUsuario).toHaveLength(3);
    expect(resultado.totales).toEqual({
      publicaciones: 15,
      usuariosConPublicaciones: 5,
      comentarios: 0,
      publicacionesConComentarios: 0,
    });
  });

  it('marca las publicaciones dadas de baja y las que ya no existen', async () => {
    prepararVacio();
    publicacionModel.find.mockReturnValue(
      cadenaFind([
        {
          _id: oid(ID_PUBLICACION),
          titulo: 'La que se dio de baja',
          eliminado: true,
          usuario: null,
        },
      ]),
    );
    comentarioModel.aggregate.mockImplementation((pipeline: EtapaPipeline[]) =>
      esPorPeriodo(pipeline)
        ? cadenaAggregate([])
        : cadenaAggregate([
            { _id: oid(ID_PUBLICACION), total: 2 },
            { _id: oid(ID_OTRA_PUBLICACION), total: 1 },
          ]),
    );

    const resultado = await servicio.obtener(rangoDto());

    expect(resultado.comentariosPorPublicacion).toEqual([
      {
        publicacionId: ID_PUBLICACION,
        titulo: 'La que se dio de baja',
        autor: 'desconocido',
        eliminada: true,
        total: 2,
      },
      {
        publicacionId: ID_OTRA_PUBLICACION,
        titulo: 'Publicación no disponible',
        autor: 'desconocido',
        eliminada: false,
        total: 1,
      },
    ]);
  });

  it('rechaza un rango con hasta anterior a desde', async () => {
    prepararVacio();

    await expect(
      servicio.obtener(rangoDto({ desde: '2026-11-10', hasta: '2026-11-01' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(publicacionModel.aggregate).not.toHaveBeenCalled();
  });

  it('rechaza un rango de más de 366 días', async () => {
    prepararVacio();

    await expect(
      servicio.obtener(rangoDto({ desde: '2024-01-01', hasta: '2026-11-03' })),
    ).rejects.toThrow('El rango no puede superar los 366 días');
    expect(comentarioModel.aggregate).not.toHaveBeenCalled();
  });

  it('traduce un fallo de Mongo a 500', async () => {
    prepararVacio();
    publicacionModel.aggregate.mockReturnValue({
      exec: jest.fn().mockRejectedValue(new Error('conexión perdida')),
    });

    await expect(servicio.obtener(rangoDto())).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('devuelve las tres métricas y los totales del rango', async () => {
    publicacionModel.aggregate.mockReturnValue(
      cadenaAggregate([
        { _id: oid(ID_ANA), total: 3 },
        { _id: oid(ID_BETO), total: 2 },
      ]),
    );
    usuarioModel.find.mockReturnValue(
      cadenaFind([
        {
          _id: oid(ID_ANA),
          nombre: 'Ana',
          apellido: 'Moreno',
          nombreUsuario: 'anamoreno',
        },
      ]),
    );
    publicacionModel.find.mockReturnValue(
      cadenaFind([
        {
          _id: oid(ID_PUBLICACION),
          titulo: 'Colibrí garganta rubí',
          eliminado: false,
          usuario: { nombreUsuario: 'betoperez' },
        },
      ]),
    );
    comentarioModel.aggregate.mockImplementation((pipeline: EtapaPipeline[]) =>
      esPorPeriodo(pipeline)
        ? cadenaAggregate([{ _id: '2026-11-02', total: 4 }])
        : cadenaAggregate([{ _id: oid(ID_PUBLICACION), total: 4 }]),
    );

    const resultado = await servicio.obtener(rangoDto());

    expect(resultado.rango).toEqual({
      desde: '2026-11-01T03:00:00.000Z',
      // 23:59:59.999 del 3/11 en Buenos Aires ya es el 4/11 en UTC.
      hasta: '2026-11-04T02:59:59.999Z',
      agrupacion: 'dia',
      limite: 10,
    });
    expect(resultado.totales).toEqual({
      publicaciones: 5,
      usuariosConPublicaciones: 2,
      comentarios: 4,
      publicacionesConComentarios: 1,
    });
    expect(resultado.publicacionesPorUsuario).toEqual([
      {
        usuarioId: ID_ANA,
        nombre: 'Ana Moreno',
        nombreUsuario: 'anamoreno',
        total: 3,
      },
      // Beto no vino en el `find` de usuarios: no se inventa un nombre.
      {
        usuarioId: ID_BETO,
        nombre: 'Cuenta no disponible',
        nombreUsuario: 'desconocido',
        total: 2,
      },
    ]);
    // La serie cubre los tres días aunque el 1 y el 3 no tengan comentarios.
    expect(resultado.comentariosPorPeriodo.map((punto) => punto.total)).toEqual([
      0, 4, 0,
    ]);
    expect(resultado.comentariosPorPublicacion).toEqual([
      {
        publicacionId: ID_PUBLICACION,
        titulo: 'Colibrí garganta rubí',
        autor: 'betoperez',
        eliminada: false,
        total: 4,
      },
    ]);
  });
});
