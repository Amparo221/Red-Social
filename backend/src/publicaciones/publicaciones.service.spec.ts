import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UsuarioAutenticado } from '../auth/interfaces/jwt-payload.interface';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PublicacionesService } from './publicaciones.service';
import { Publicacion } from './schemas/publicacion.schema';

const ID_PUBLICACION = '507f1f77bcf86cd799439011';
const ID_AUTOR = '507f1f77bcf86cd799439012';
const ID_OTRO = '507f1f77bcf86cd799439013';
const IMAGEN = 'https://res.cloudinary.com/demo/image/upload/red-social/publicaciones/ave.jpg';

const usuarioAutenticado = (extra: Partial<UsuarioAutenticado> = {}): UsuarioAutenticado => ({
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
  imagenPerfilUrl: 'https://res.cloudinary.com/demo/image/upload/red-social/perfiles/ana.png',
};

// Documento que "devuelve" Mongo, sin tocar la base real.
const documento = (extra: Record<string, unknown> = {}, populado = true) => ({
  _id: new Types.ObjectId(ID_PUBLICACION),
  titulo: 'Colibrí en el jardín',
  descripcion: 'Lo vi a la mañana',
  nombreComun: 'Colibrí garganta rubí',
  nombreCientifico: 'Archilochus colubris',
  imagenUrl: IMAGEN,
  usuario: populado ? autorPopulado : new Types.ObjectId(ID_AUTOR),
  likes: [] as Types.ObjectId[],
  cantidadLikes: 0,
  eliminado: false,
  // El esquema la declara como `Date | null` y el servicio la completa al dar
  // de baja; el mock tiene que declararla para que el tipo del documento
  // simulado coincida con el real (si falta, `tsc` marca TS2339 al leerla).
  fechaEliminacion: null as Date | null,
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
  populated: jest.fn().mockReturnValue(populado ? new Types.ObjectId(ID_AUTOR) : undefined),
  populate: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  ...extra,
});

/** Simula el encadenado find().sort().skip().limit().populate().exec(). */
const cadenaFind = (resultado: unknown[]) => {
  const cadena = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    populate: jest.fn(),
    exec: jest.fn().mockResolvedValue(resultado),
  };
  cadena.sort.mockReturnValue(cadena);
  cadena.skip.mockReturnValue(cadena);
  cadena.limit.mockReturnValue(cadena);
  cadena.populate.mockReturnValue(cadena);

  return cadena;
};

describe('PublicacionesService', () => {
  let servicio: PublicacionesService;
  let publicacionModel: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    exists: jest.Mock;
  };
  let cloudinaryService: { uploadImage: jest.Mock };

  beforeEach(async () => {
    publicacionModel = {
      // El servicio hace populate() antes de responder: el mock imita eso y
      // devuelve el autor ya populado (los argumentos del create quedan
      // registrados con el ObjectId, así el test puede verificarlos).
      create: jest.fn((datos: Record<string, unknown>) =>
        Promise.resolve(documento({ ...datos, usuario: autorPopulado })),
      ),
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockReturnValue(cadenaFind([])),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      exists: jest.fn().mockResolvedValue(null),
    };
    cloudinaryService = { uploadImage: jest.fn().mockResolvedValue(IMAGEN) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicacionesService,
        { provide: getModelToken(Publicacion.name), useValue: publicacionModel },
        { provide: CloudinaryService, useValue: cloudinaryService },
      ],
    }).compile();

    servicio = module.get<PublicacionesService>(PublicacionesService);
  });

  describe('crear', () => {
    it('guarda la publicación con el autor que viene del token y sin imagen', async () => {
      const resultado = await servicio.crear(
        { titulo: 'Colibrí en el jardín', descripcion: 'Lo vi a la mañana' },
        usuarioAutenticado(),
      );

      const guardado = publicacionModel.create.mock.calls[0][0];
      expect(guardado.titulo).toBe('Colibrí en el jardín');
      expect(guardado.imagenUrl).toBe('');
      expect(guardado.cantidadLikes).toBe(0);
      expect(guardado.eliminado).toBe(false);
      expect(guardado.likes).toEqual([]);
      // El autor sale del token, nunca de un id que mande el cliente.
      expect(guardado.usuario.toString()).toBe(ID_AUTOR);
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();

      expect(resultado.id).toBe(ID_PUBLICACION);
      expect(resultado.usuario).toEqual({
        id: ID_AUTOR,
        nombre: 'Ana',
        apellido: 'Moreno',
        nombreUsuario: 'anamoreno',
        imagenPerfilUrl: autorPopulado.imagenPerfilUrl,
      });
    });

    it('sube la imagen a la carpeta de publicaciones y guarda la URL', async () => {
      const archivo = { buffer: Buffer.from('imagen') } as Express.Multer.File;

      const resultado = await servicio.crear(
        { titulo: 'Colibrí', descripcion: 'Con foto' },
        usuarioAutenticado(),
        archivo,
      );

      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(
        archivo,
        undefined,
        'red-social/publicaciones',
      );
      expect(publicacionModel.create.mock.calls[0][0].imagenUrl).toBe(IMAGEN);
      expect(resultado.imagenUrl).toBe(IMAGEN);
    });

    it('guarda el nombre común y el nombre científico cuando vienen', async () => {
      await servicio.crear(
        {
          titulo: 'Colibrí',
          descripcion: 'Con datos de la especie',
          nombreComun: 'Colibrí garganta rubí',
          nombreCientifico: 'Archilochus colubris',
        },
        usuarioAutenticado(),
      );

      const guardado = publicacionModel.create.mock.calls[0][0];
      expect(guardado.nombreComun).toBe('Colibrí garganta rubí');
      expect(guardado.nombreCientifico).toBe('Archilochus colubris');
    });

    it('traduce un error de Mongo en un 500 en lugar de filtrarlo', async () => {
      publicacionModel.create.mockRejectedValue(new Error('caída de la base'));

      await expect(
        servicio.crear({ titulo: 'x', descripcion: 'y' }, usuarioAutenticado()),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('listar', () => {
    const queryPorDefecto = { offset: 0, limit: 5, orden: 'fecha' as const };

    it('excluye las publicaciones dadas de baja y aplica offset/limit', async () => {
      const cadena = cadenaFind([documento()]);
      publicacionModel.find.mockReturnValue(cadena);
      publicacionModel.countDocuments.mockResolvedValue(10);

      const resultado = await servicio.listar(
        { ...queryPorDefecto, offset: 5, limit: 5 },
        usuarioAutenticado(),
      );

      // La baja es lógica: el filtro por eliminado no puede faltar nunca.
      expect(publicacionModel.find).toHaveBeenCalledWith({ eliminado: false });
      expect(publicacionModel.countDocuments).toHaveBeenCalledWith({ eliminado: false });
      expect(cadena.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(cadena.skip).toHaveBeenCalledWith(5);
      expect(cadena.limit).toHaveBeenCalledWith(5);

      expect(resultado).toMatchObject({ total: 10, offset: 5, limit: 5, orden: 'fecha' });
      expect(resultado.publicaciones).toHaveLength(1);
    });

    it('ordena por cantidad de me gusta, desempatando por fecha', async () => {
      const cadena = cadenaFind([documento()]);
      publicacionModel.find.mockReturnValue(cadena);

      await servicio.listar({ ...queryPorDefecto, orden: 'likes' }, usuarioAutenticado());

      expect(cadena.sort).toHaveBeenCalledWith({ cantidadLikes: -1, createdAt: -1 });
    });

    it('filtra las publicaciones de un usuario puntual', async () => {
      await servicio.listar({ ...queryPorDefecto, usuario: ID_OTRO }, usuarioAutenticado());

      const filtro = publicacionModel.find.mock.calls[0][0];
      expect(filtro.eliminado).toBe(false);
      expect(filtro.usuario.toString()).toBe(ID_OTRO);
    });

    it('marca likeado sólo en las publicaciones que el usuario ya likeó', async () => {
      publicacionModel.find.mockReturnValue(
        cadenaFind([
          documento({ likes: [new Types.ObjectId(ID_AUTOR)], cantidadLikes: 1 }),
          documento({ _id: new Types.ObjectId(ID_OTRO) }),
        ]),
      );

      const resultado = await servicio.listar(queryPorDefecto, usuarioAutenticado());

      expect(resultado.publicaciones[0].likeado).toBe(true);
      expect(resultado.publicaciones[1].likeado).toBe(false);
    });

    it('indica si quedan más páginas', async () => {
      publicacionModel.countDocuments.mockResolvedValue(5);
      publicacionModel.find.mockReturnValue(cadenaFind([documento(), documento()]));

      const primera = await servicio.listar(queryPorDefecto, usuarioAutenticado());
      expect(primera.hayMas).toBe(true);

      publicacionModel.find.mockReturnValue(cadenaFind([documento()]));
      const ultima = await servicio.listar(
        { ...queryPorDefecto, offset: 4 },
        usuarioAutenticado(),
      );
      expect(ultima.hayMas).toBe(false);
    });
  });

  describe('darLike', () => {
    it('agrega el like del usuario en una sola operación atómica', async () => {
      publicacionModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(documento({ cantidadLikes: 3 })),
      });

      const resultado = await servicio.darLike(ID_PUBLICACION, usuarioAutenticado());

      const [filtro, actualizacion, opciones] = publicacionModel.findOneAndUpdate.mock.calls[0];
      // El filtro es la garantía del "un me gusta por usuario": si ya está en
      // likes, la consulta no matchea y no se actualiza nada.
      expect(filtro).toEqual({
        _id: ID_PUBLICACION,
        eliminado: false,
        likes: { $ne: ID_AUTOR },
      });
      expect(actualizacion).toEqual({
        $addToSet: { likes: ID_AUTOR },
        $inc: { cantidadLikes: 1 },
      });
      expect(opciones).toEqual({ new: true });

      expect(resultado).toEqual({ id: ID_PUBLICACION, cantidadLikes: 3, likeado: true });
    });

    it('devuelve 409 si el usuario ya había dado me gusta', async () => {
      publicacionModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      publicacionModel.exists.mockResolvedValue({ _id: ID_PUBLICACION });

      await expect(servicio.darLike(ID_PUBLICACION, usuarioAutenticado())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('devuelve 404 si la publicación no existe o fue eliminada', async () => {
      publicacionModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      publicacionModel.exists.mockResolvedValue(null);

      await expect(servicio.darLike(ID_PUBLICACION, usuarioAutenticado())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('quitarLike', () => {
    it('quita el like del usuario y baja el contador', async () => {
      publicacionModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(documento({ cantidadLikes: 0 })),
      });

      const resultado = await servicio.quitarLike(ID_PUBLICACION, usuarioAutenticado());

      const [filtro, actualizacion] = publicacionModel.findOneAndUpdate.mock.calls[0];
      // Sólo matchea si el like estaba: la consigna pide sacarlo sólo si antes
      // lo había dado.
      expect(filtro).toEqual({
        _id: ID_PUBLICACION,
        eliminado: false,
        likes: ID_AUTOR,
      });
      expect(actualizacion).toEqual({
        $pull: { likes: ID_AUTOR },
        $inc: { cantidadLikes: -1 },
      });

      expect(resultado).toEqual({ id: ID_PUBLICACION, cantidadLikes: 0, likeado: false });
    });

    it('devuelve 409 si el usuario no había dado me gusta', async () => {
      publicacionModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      publicacionModel.exists.mockResolvedValue({ _id: ID_PUBLICACION });

      await expect(
        servicio.quitarLike(ID_PUBLICACION, usuarioAutenticado()),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('eliminar', () => {
    // Guardamos el documento para poder revisar cómo quedó después del save():
    // `mock.results` de un mockResolvedValue devuelve la promesa, no el valor.
    const darPublicacion = (extra: Record<string, unknown> = {}) => {
      const publicacion = documento(extra, false);
      publicacionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(publicacion),
      });

      return publicacion;
    };

    it('hace una baja lógica si el que la pide es el autor', async () => {
      const publicacion = darPublicacion();

      const resultado = await servicio.eliminar(ID_PUBLICACION, usuarioAutenticado());

      expect(publicacionModel.findOne).toHaveBeenCalledWith({
        _id: ID_PUBLICACION,
        eliminado: false,
      });
      // Baja lógica: el documento se marca y se guarda, no se borra.
      expect(publicacion.eliminado).toBe(true);
      expect(publicacion.fechaEliminacion).toBeInstanceOf(Date);
      expect(publicacion.save).toHaveBeenCalled();

      expect(resultado.eliminado).toBe(true);
      expect(resultado.id).toBe(ID_PUBLICACION);
    });

    it('permite la baja a un administrador aunque no sea el autor', async () => {
      const publicacion = darPublicacion();

      await servicio.eliminar(ID_PUBLICACION, usuarioAutenticado({ perfil: 'administrador' }));

      expect(publicacion.save).toHaveBeenCalled();
    });

    it('devuelve 403 si no es el autor ni un administrador', async () => {
      const publicacion = darPublicacion();

      await expect(
        servicio.eliminar(ID_PUBLICACION, usuarioAutenticado({ id: ID_OTRO })),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(publicacion.eliminado).toBe(false);
      expect(publicacion.save).not.toHaveBeenCalled();
    });

    it('devuelve 404 si la publicación no existe o ya fue eliminada', async () => {
      publicacionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        servicio.eliminar(ID_PUBLICACION, usuarioAutenticado()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
