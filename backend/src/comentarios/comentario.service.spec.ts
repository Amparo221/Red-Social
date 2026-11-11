import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { Publicacion } from '../publicaciones/schemas/publicacion.schema';
import { ComentarioService } from './comentario.service';
import { Comentario } from './schemas/comentario.schema';

const ID_PUBLICACION = '507f1f77bcf86cd799439011';
const ID_COMENTARIO = '507f1f77bcf86cd799439021';
const ID_AUTOR = '507f1f77bcf86cd799439012';
const ID_OTRO = '507f1f77bcf86cd799439013';

const usuarioAutenticado = (
  extra: Partial<UsuarioAutenticado> = {},
): UsuarioAutenticado => ({
  id: ID_AUTOR,
  nombreUsuario: 'anamoreno',
  perfil: 'usuario',
  ...extra,
});

const autorPopulado = {
  _id: new Types.ObjectId(ID_AUTOR),
  nombre: 'Ana',
  apellido: 'Moreno',
  nombreUsuario: 'anamoreno',
  imagenPerfilUrl:
    'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/ana.png',
};

/** Documento de comentario tal como lo devuelve Mongo (autor populado). */
const comentarioDocumento = (extra: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(ID_COMENTARIO),
  texto: 'Qué lindo registro',
  autor: autorPopulado,
  publicacion: new Types.ObjectId(ID_PUBLICACION),
  eliminado: false,
  fechaEliminacion: null as Date | null,
  editado: false,
  fechaEdicion: null as Date | null,
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  updatedAt: new Date('2026-11-01T10:00:00.000Z'),
  populated: jest.fn().mockReturnValue(new Types.ObjectId(ID_AUTOR)),
  populate: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  ...extra,
});

/** Simula el encadenado find().populate().sort().skip().limit().exec(). */
const cadenaFind = (resultado: unknown[]) => {
  const cadena = {
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    exec: jest.fn().mockResolvedValue(resultado),
  };
  cadena.populate.mockReturnValue(cadena);
  cadena.sort.mockReturnValue(cadena);
  cadena.skip.mockReturnValue(cadena);
  cadena.limit.mockReturnValue(cadena);

  return cadena;
};

/** Simula countDocuments().exec(). */
const cadenaCount = (total: number) => ({
  exec: jest.fn().mockResolvedValue(total),
});

/** Simula findOne().exec() (lo usan la publicación y el comentario). */
const cadenaFindOne = (resultado: unknown) => ({
  exec: jest.fn().mockResolvedValue(resultado),
});

describe('ComentarioService', () => {
  let servicio: ComentarioService;
  let comentarioModel: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    countDocuments: jest.Mock;
  };
  let publicacionModel: { findOne: jest.Mock };

  beforeEach(async () => {
    comentarioModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue(cadenaFind([])),
      findOne: jest.fn(),
      countDocuments: jest.fn().mockReturnValue(cadenaCount(0)),
    };
    publicacionModel = {
      findOne: jest.fn().mockReturnValue(cadenaFindOne({ _id: ID_PUBLICACION })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComentarioService,
        {
          provide: getModelToken(Comentario.name),
          useValue: comentarioModel,
        },
        {
          provide: getModelToken(Publicacion.name),
          useValue: publicacionModel,
        },
      ],
    }).compile();

    servicio = module.get(ComentarioService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listarComentarios', () => {
    it('devuelve la página pedida con el autor populado y el total', async () => {
      const cadena = cadenaFind([comentarioDocumento()]);
      comentarioModel.find.mockReturnValue(cadena);
      comentarioModel.countDocuments.mockReturnValue(cadenaCount(5));

      const pagina = await servicio.listarComentarios(ID_PUBLICACION, {
        offset: 0,
        limit: 3,
      });

      // Sólo los comentarios vigentes de esa publicación.
      expect(comentarioModel.find).toHaveBeenCalledWith({
        publicacion: new Types.ObjectId(ID_PUBLICACION),
        eliminado: false,
      });
      expect(cadena.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
      expect(cadena.skip).toHaveBeenCalledWith(0);
      expect(cadena.limit).toHaveBeenCalledWith(3);
      expect(cadena.populate).toHaveBeenCalledWith(
        'autor',
        'nombre apellido nombreUsuario imagenPerfilUrl',
      );

      expect(pagina).toMatchObject({ total: 5, offset: 0, limit: 3, hayMas: true });
      expect(pagina.comentarios).toHaveLength(1);
      expect(pagina.comentarios[0]).toMatchObject({
        id: ID_COMENTARIO,
        texto: 'Qué lindo registro',
        eliminado: false,
        editado: false,
        autor: {
          id: ID_AUTOR,
          nombre: 'Ana',
          apellido: 'Moreno',
          nombreUsuario: 'anamoreno',
        },
      });
    });

    it('avisa que no hay más cuando la página llega al total', async () => {
      comentarioModel.find.mockReturnValue(
        cadenaFind([comentarioDocumento(), comentarioDocumento()]),
      );
      comentarioModel.countDocuments.mockReturnValue(cadenaCount(5));

      const pagina = await servicio.listarComentarios(ID_PUBLICACION, {
        offset: 3,
        limit: 3,
      });

      expect(pagina).toMatchObject({
        total: 5,
        offset: 3,
        limit: 3,
        hayMas: false,
      });
    });

    it('usa la primera página cuando no se envían parámetros', async () => {
      const cadena = cadenaFind([]);
      comentarioModel.find.mockReturnValue(cadena);

      const pagina = await servicio.listarComentarios(ID_PUBLICACION);

      expect(cadena.skip).toHaveBeenCalledWith(0);
      expect(cadena.limit).toHaveBeenCalledWith(10);
      expect(pagina).toMatchObject({ total: 0, hayMas: false });
    });

    it('lanza 404 si la publicación no existe', async () => {
      publicacionModel.findOne.mockReturnValue(cadenaFindOne(null));

      await expect(
        servicio.listarComentarios(ID_PUBLICACION),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(comentarioModel.find).not.toHaveBeenCalled();
    });
  });

  describe('crearComentario', () => {
    it('crea el comentario con el autor de la sesión y lo devuelve populado', async () => {
      comentarioModel.create.mockResolvedValue(comentarioDocumento());

      const comentario = await servicio.crearComentario(
        ID_PUBLICACION,
        'Qué lindo registro',
        usuarioAutenticado(),
      );

      expect(comentarioModel.create).toHaveBeenCalledWith({
        texto: 'Qué lindo registro',
        autor: new Types.ObjectId(ID_AUTOR),
        publicacion: new Types.ObjectId(ID_PUBLICACION),
        eliminado: false,
      });
      expect(comentario).toMatchObject({ id: ID_COMENTARIO });
    });

    it('lanza 404 si la publicación no existe', async () => {
      publicacionModel.findOne.mockReturnValue(cadenaFindOne(null));

      await expect(
        servicio.crearComentario(ID_PUBLICACION, 'Hola', usuarioAutenticado()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(comentarioModel.create).not.toHaveBeenCalled();
    });

    it('envuelve los errores inesperados de Mongo en un 500', async () => {
      comentarioModel.create.mockRejectedValue(new Error('caída de la base'));

      await expect(
        servicio.crearComentario(ID_PUBLICACION, 'Hola', usuarioAutenticado()),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('eliminarComentario', () => {
    it('hace baja lógica si el usuario es el autor', async () => {
      const comentario = comentarioDocumento({
        autor: new Types.ObjectId(ID_AUTOR),
      });
      comentarioModel.findOne.mockReturnValue(cadenaFindOne(comentario));

      const resultado = await servicio.eliminarComentario(
        ID_COMENTARIO,
        usuarioAutenticado(),
      );

      expect(resultado).toEqual({ id: ID_COMENTARIO, eliminado: true });
      expect(comentario.eliminado).toBe(true);
      expect(comentario.fechaEliminacion).toBeInstanceOf(Date);
      expect(comentario.save).toHaveBeenCalled();
    });

    it('permite borrar a un administrador', async () => {
      const comentario = comentarioDocumento({
        autor: new Types.ObjectId(ID_OTRO),
      });
      comentarioModel.findOne.mockReturnValue(cadenaFindOne(comentario));

      await expect(
        servicio.eliminarComentario(
          ID_COMENTARIO,
          usuarioAutenticado({ perfil: 'administrador' }),
        ),
      ).resolves.toEqual({ id: ID_COMENTARIO, eliminado: true });
    });

    it('lanza 403 si no es el autor ni administrador', async () => {
      comentarioModel.findOne.mockReturnValue(
        cadenaFindOne(
          comentarioDocumento({ autor: new Types.ObjectId(ID_OTRO) }),
        ),
      );

      await expect(
        servicio.eliminarComentario(ID_COMENTARIO, usuarioAutenticado()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lanza 404 si el comentario no existe o fue eliminado', async () => {
      comentarioModel.findOne.mockReturnValue(cadenaFindOne(null));

      await expect(
        servicio.eliminarComentario(ID_COMENTARIO, usuarioAutenticado()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('editarComentario', () => {
    it('cambia el texto, marca la edición y devuelve el autor populado', async () => {
      const comentario = comentarioDocumento({
        autor: new Types.ObjectId(ID_AUTOR),
      });
      comentarioModel.findOne.mockReturnValue(cadenaFindOne(comentario));

      const resultado = await servicio.editarComentario(
        ID_COMENTARIO,
        'Texto corregido',
        usuarioAutenticado(),
      );

      expect(comentarioModel.findOne).toHaveBeenCalledWith({
        _id: ID_COMENTARIO,
        eliminado: false,
      });
      expect(comentario.texto).toBe('Texto corregido');
      expect(comentario.editado).toBe(true);
      expect(comentario.fechaEdicion).toBeInstanceOf(Date);
      expect(comentario.save).toHaveBeenCalled();
      // Sin re-popular, la respuesta devolvería el id suelto como autor.
      expect(comentario.populate).toHaveBeenCalledWith(
        'autor',
        'nombre apellido nombreUsuario imagenPerfilUrl',
      );

      expect(resultado).toMatchObject({
        id: ID_COMENTARIO,
        texto: 'Texto corregido',
        editado: true,
      });
      expect(resultado.fechaEdicion).toBeInstanceOf(Date);
    });

    it('lanza 403 si quien edita no es el autor', async () => {
      comentarioModel.findOne.mockReturnValue(
        cadenaFindOne(
          comentarioDocumento({ autor: new Types.ObjectId(ID_OTRO) }),
        ),
      );

      await expect(
        servicio.editarComentario(
          ID_COMENTARIO,
          'No debería poder',
          usuarioAutenticado(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ni el administrador puede editar el texto de otra persona', async () => {
      comentarioModel.findOne.mockReturnValue(
        cadenaFindOne(
          comentarioDocumento({ autor: new Types.ObjectId(ID_OTRO) }),
        ),
      );

      await expect(
        servicio.editarComentario(
          ID_COMENTARIO,
          'Moderación',
          usuarioAutenticado({ perfil: 'administrador' }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lanza 404 si el comentario no existe o fue eliminado', async () => {
      comentarioModel.findOne.mockReturnValue(cadenaFindOne(null));

      await expect(
        servicio.editarComentario(ID_COMENTARIO, 'Hola', usuarioAutenticado()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('envuelve los errores inesperados de Mongo en un 500', async () => {
      const comentario = comentarioDocumento({
        autor: new Types.ObjectId(ID_AUTOR),
      });
      comentario.save.mockRejectedValue(new Error('caída de la base'));
      comentarioModel.findOne.mockReturnValue(cadenaFindOne(comentario));

      await expect(
        servicio.editarComentario(ID_COMENTARIO, 'Hola', usuarioAutenticado()),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});

