import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Comentario,
  ComentarioDocument,
} from '../comentarios/schemas/comentario.schema';
import {
  Publicacion,
  PublicacionDocument,
} from '../publicaciones/schemas/publicacion.schema';
import { Usuario, UsuarioDocument } from '../usuarios/schemas/usuario.schema';
import {
  ConsultarEstadisticasDto,
  DIAS_MAXIMOS,
  DIAS_POR_DEFECTO,
} from './dto/consultar-estadisticas.dto';
import {
  Agrupacion,
  armarPeriodos,
  completarSerie,
  diaEnArgentina,
  diasDelRango,
  FORMATOS_MONGO,
  finDelDia,
  inicioDelDia,
  normalizarDia,
  PuntoSerie,
  sumarDias,
  ZONA_HORARIA,
} from './utils/periodos.util';

/** Filtro común a las tres métricas: sólo documentos vigentes del rango. */
type FiltroEstadisticas = {
  eliminado: false;
  createdAt: { $gte: Date; $lte: Date };
};

/** Fila cruda que devuelve un `$group` (clave + cantidad). */
type GrupoCrudo<TClave> = { _id: TClave; total: number };

/** Top de usuarios por publicaciones (gráfico de torta). */
export interface PublicacionesPorUsuario {
  usuarioId: string;
  nombre: string;
  nombreUsuario: string;
  total: number;
}

/** Serie temporal de comentarios (gráfico de líneas). */
export type ComentariosPorPeriodo = PuntoSerie;

/** Top de publicaciones por comentarios (gráfico de barras). */
export interface ComentariosPorPublicacion {
  publicacionId: string;
  titulo: string;
  autor: string;
  /** La publicación se dio de baja después de recibir los comentarios. */
  eliminada: boolean;
  total: number;
}

/** Números del encabezado del dashboard. */
export interface TotalesEstadisticas {
  publicaciones: number;
  usuariosConPublicaciones: number;
  comentarios: number;
  publicacionesConComentarios: number;
}

/** Respuesta completa de `GET /estadisticas`. */
export interface EstadisticasResponse {
  rango: {
    /** ISO con el primer instante del rango (hora argentina). */
    desde: string;
    /** ISO con el último instante del rango. */
    hasta: string;
    agrupacion: Agrupacion;
    limite: number;
  };
  totales: TotalesEstadisticas;
  publicacionesPorUsuario: PublicacionesPorUsuario[];
  comentariosPorPeriodo: ComentariosPorPeriodo[];
  comentariosPorPublicacion: ComentariosPorPublicacion[];
}

/** Lo que devuelve el `populate('usuario', 'nombreUsuario')` de las publicaciones. */
type AutorPopulado = { nombreUsuario?: string } | null;

/**
 * Estadísticas del dashboard (Sprint 5).
 *
 * Las tres métricas se resuelven con agregaciones sobre las colecciones que ya
 * existen (no hay colección ni índice nuevos):
 *
 * - publicaciones por usuario → `$group` por `usuario`,
 * - comentarios en el tiempo → `$group` por día/semana/mes con `$dateToString`,
 * - comentarios por publicación → `$group` por `publicacion`.
 *
 * El ranking se corta en el servicio (`slice`) y no con `$limit` porque
 * necesitamos el total de cada métrica para el encabezado: agrupar por usuario
 * o por publicación devuelve, como mucho, tantas filas como documentos distintos
 * haya, y con el volumen de este TP eso entra tranquilamente en memoria.
 */
@Injectable()
export class EstadisticasService {
  private readonly logger = new Logger(EstadisticasService.name);

  constructor(
    @InjectModel(Publicacion.name)
    private readonly publicacionModel: Model<PublicacionDocument>,
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<ComentarioDocument>,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  /** GET /estadisticas?desde&hasta&agrupacion&limite */
  async obtener(
    dto: ConsultarEstadisticasDto = new ConsultarEstadisticasDto(),
  ): Promise<EstadisticasResponse> {
    const { desdeDia, hastaDia } = this.resolverRango(dto);
    const filtro: FiltroEstadisticas = {
      eliminado: false,
      createdAt: {
        $gte: inicioDelDia(desdeDia),
        $lte: finDelDia(hastaDia),
      },
    };

    try {
      // Las tres métricas son independientes: van en paralelo para que el
      // dashboard tarde lo que tarda la más lenta y no la suma de las tres.
      const [porUsuario, porPeriodo, porPublicacion] = await Promise.all([
        this.agruparPublicacionesPorUsuario(filtro, dto.limite),
        this.agruparComentariosPorPeriodo(filtro, desdeDia, hastaDia, dto.agrupacion),
        this.agruparComentariosPorPublicacion(filtro, dto.limite),
      ]);

      return {
        rango: {
          desde: inicioDelDia(desdeDia).toISOString(),
          hasta: finDelDia(hastaDia).toISOString(),
          agrupacion: dto.agrupacion,
          limite: dto.limite,
        },
        totales: {
          publicaciones: porUsuario.total,
          usuariosConPublicaciones: porUsuario.cantidad,
          // La serie está cero-rellenada, así que su suma es el total exacto de
          // comentarios vigentes del rango.
          comentarios: porPeriodo.reduce((suma, punto) => suma + punto.total, 0),
          publicacionesConComentarios: porPublicacion.cantidad,
        },
        publicacionesPorUsuario: porUsuario.filas,
        comentariosPorPeriodo: porPeriodo,
        comentariosPorPublicacion: porPublicacion.filas,
      };
    } catch (error) {
      this.logger.error(
        'No se pudieron calcular las estadísticas',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No se pudieron calcular las estadísticas',
      );
    }
  }

  /**
   * Traduce la query string a los dos extremos del rango (días `AAAA-MM-DD`).
   *
   * Los valores por defecto dependen de "hoy", por eso esta validación no puede
   * vivir en el DTO: sin `hasta` se usa el día de hoy en Argentina y sin `desde`
   * los `DIAS_POR_DEFECTO` días anteriores (incluyendo hoy).
   */
  private resolverRango(dto: ConsultarEstadisticasDto): {
    desdeDia: string;
    hastaDia: string;
  } {
    const hastaDia = dto.hasta
      ? normalizarDia(dto.hasta)
      : diaEnArgentina(new Date());
    const desdeDia = dto.desde
      ? normalizarDia(dto.desde)
      : sumarDias(hastaDia, -(DIAS_POR_DEFECTO - 1));

    const dias = diasDelRango(desdeDia, hastaDia);
    if (dias < 1) {
      throw new BadRequestException('hasta no puede ser anterior a desde');
    }
    if (dias > DIAS_MAXIMOS) {
      throw new BadRequestException(
        `El rango no puede superar los ${DIAS_MAXIMOS} días`,
      );
    }

    return { desdeDia, hastaDia };
  }

  /**
   * Publicaciones vigentes agrupadas por autor, de mayor a menor.
   *
   * El `find` posterior resuelve nombre y usuario de los autores del top: el
   * `$group` sólo trae el `_id` y no se puede `$lookup` sin complicar la
   * consulta para un puñado de filas.
   */
  private async agruparPublicacionesPorUsuario(
    filtro: FiltroEstadisticas,
    limite: number,
  ): Promise<{
    total: number;
    cantidad: number;
    filas: PublicacionesPorUsuario[];
  }> {
    const grupos = await this.publicacionModel
      .aggregate<GrupoCrudo<Types.ObjectId>>([
        { $match: filtro },
        { $group: { _id: '$usuario', total: { $sum: 1 } } },
        // `_id` como desempate: con la misma cantidad el orden no cambia entre
        // consultas y el gráfico no "salta" al actualizar.
        { $sort: { total: -1, _id: 1 } },
      ])
      .exec();

    const top = grupos.slice(0, limite);
    const usuarios = await this.usuarioModel
      .find({ _id: { $in: top.map((grupo) => grupo._id) } })
      .select('nombre apellido nombreUsuario')
      .exec();
    const porId = new Map(
      usuarios.map((usuario) => [String(usuario._id), usuario]),
    );

    return {
      total: grupos.reduce((suma, grupo) => suma + grupo.total, 0),
      cantidad: grupos.length,
      filas: top.map((grupo) => {
        const usuario = porId.get(String(grupo._id));
        return {
          usuarioId: String(grupo._id),
          // Sólo puede faltar si alguien borró el documento a mano en Atlas:
          // la baja de usuarios es lógica y no toca las publicaciones.
          nombre: usuario
            ? `${usuario.nombre} ${usuario.apellido}`.trim()
            : 'Cuenta no disponible',
          nombreUsuario: usuario?.nombreUsuario ?? 'desconocido',
          total: grupo.total,
        };
      }),
    };
  }

  /**
   * Comentarios vigentes agrupados por día, semana o mes.
   *
   * El cero-relleno lo hace `completarSerie`: Mongo sólo devuelve los períodos
   * con comentarios y el gráfico de líneas necesita el eje completo.
   */
  private async agruparComentariosPorPeriodo(
    filtro: FiltroEstadisticas,
    desdeDia: string,
    hastaDia: string,
    agrupacion: Agrupacion,
  ): Promise<ComentariosPorPeriodo[]> {
    const grupos = await this.comentarioModel
      .aggregate<GrupoCrudo<string>>([
        { $match: filtro },
        {
          $group: {
            _id: {
              $dateToString: {
                date: '$createdAt',
                format: FORMATOS_MONGO[agrupacion],
                // Sin `timezone` Mongo agrupa en UTC y un comentario de las
                // 22:30 en Buenos Aires cae en el día siguiente.
                timezone: ZONA_HORARIA,
              },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .exec();

    const totalesPorClave = new Map(
      grupos.map((grupo) => [grupo._id, grupo.total]),
    );

    return completarSerie(
      armarPeriodos(desdeDia, hastaDia, agrupacion),
      totalesPorClave,
    );
  }

  /**
   * Comentarios vigentes agrupados por publicación, de mayor a menor.
   *
   * Las publicaciones dadas de baja también entran: sus comentarios siguen
   * existiendo y para moderar es útil ver cuáles concentran la conversación.
   */
  private async agruparComentariosPorPublicacion(
    filtro: FiltroEstadisticas,
    limite: number,
  ): Promise<{ cantidad: number; filas: ComentariosPorPublicacion[] }> {
    const grupos = await this.comentarioModel
      .aggregate<GrupoCrudo<Types.ObjectId>>([
        { $match: filtro },
        { $group: { _id: '$publicacion', total: { $sum: 1 } } },
        { $sort: { total: -1, _id: 1 } },
      ])
      .exec();

    const top = grupos.slice(0, limite);
    const publicaciones = await this.publicacionModel
      .find({ _id: { $in: top.map((grupo) => grupo._id) } })
      .select('titulo usuario eliminado')
      .populate('usuario', 'nombreUsuario')
      .exec();
    const porId = new Map(
      publicaciones.map((publicacion) => [String(publicacion._id), publicacion]),
    );

    return {
      cantidad: grupos.length,
      filas: top.map((grupo) => {
        const publicacion = porId.get(String(grupo._id));
        // Mongoose no tipa el resultado del populate sin genéricos: el autor
        // llega como documento con el único campo proyectado.
        const autor = publicacion?.usuario as unknown as AutorPopulado;

        return {
          publicacionId: String(grupo._id),
          titulo: publicacion?.titulo ?? 'Publicación no disponible',
          autor: autor?.nombreUsuario ?? 'desconocido',
          eliminada: publicacion?.eliminado === true,
          total: grupo.total,
        };
      }),
    };
  }
}
