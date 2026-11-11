import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  COMENTARIOS_POR_PAGINA,
  PUBLICACIONES_POR_PAGINA,
  type Comentario,
  type ComentarioEliminado,
  type FiltrosComentarios,
  type FiltrosPublicaciones,
  type ListadoComentarios,
  type ListadoPublicaciones,
  type NuevaPublicacion,
  type Publicacion,
  type PublicacionEliminada,
  type ResultadoLike,
} from '../models/publicacion.model';

const URL_PUBLICACIONES = `${environment.apiUrl}/publicaciones`;

/** DELETE /comentarios/:id no cuelga de /publicaciones, tiene su propio recurso. */
const URL_COMENTARIOS = `${environment.apiUrl}/comentarios`;

/**
 * Acceso HTTP al recurso /publicaciones. No guarda estado: las pantallas son
 * las que tienen los signals con las publicaciones, el orden y la paginación
 * (mismo criterio que Login/Registro con AuthService).
 *
 * El `Authorization: Bearer` lo agrega el authInterceptor, así que acá no se
 * toca ningún header: todas estas rutas exigen sesión.
 */
@Injectable({ providedIn: 'root' })
export class PublicacionesService {
  private readonly http = inject(HttpClient);

  /** GET /publicaciones?offset&limit&orden&usuario */
  listar(filtros: FiltrosPublicaciones = {}): Observable<ListadoPublicaciones> {
    let params = new HttpParams()
      .set('offset', String(filtros.offset ?? 0))
      .set('limit', String(filtros.limit ?? PUBLICACIONES_POR_PAGINA))
      .set('orden', filtros.orden ?? 'fecha');

    if (filtros.usuario) {
      params = params.set('usuario', filtros.usuario);
    }

    return this.http.get<ListadoPublicaciones>(URL_PUBLICACIONES, { params });
  }

  /**
   * POST /publicaciones (multipart por la foto opcional).
   * Igual que en el registro: no se setea Content-Type a mano, el navegador
   * agrega el boundary del multipart.
   */
  crear(datos: NuevaPublicacion, imagen?: File | null): Observable<Publicacion> {
    const cuerpo = new FormData();
    cuerpo.append('titulo', datos.titulo.trim());
    cuerpo.append('descripcion', datos.descripcion.trim());

    const nombreComun = datos.nombreComun?.trim();
    if (nombreComun) {
      cuerpo.append('nombreComun', nombreComun);
    }

    const nombreCientifico = datos.nombreCientifico?.trim();
    if (nombreCientifico) {
      cuerpo.append('nombreCientifico', nombreCientifico);
    }

    if (imagen) {
      cuerpo.append('imagen', imagen);
    }

    return this.http.post<Publicacion>(URL_PUBLICACIONES, cuerpo);
  }

  /** POST /publicaciones/:id/like → 201, o 409 si ya estaba likeada. */
  darLike(id: string): Observable<ResultadoLike> {
    return this.http.post<ResultadoLike>(`${URL_PUBLICACIONES}/${id}/like`, {});
  }

  /** DELETE /publicaciones/:id/like → 200, o 409 si nunca se había likeado. */
  quitarLike(id: string): Observable<ResultadoLike> {
    return this.http.delete<ResultadoLike>(`${URL_PUBLICACIONES}/${id}/like`);
  }

  /** DELETE /publicaciones/:id → baja lógica (autor o administrador). */
  eliminar(id: string): Observable<PublicacionEliminada> {
    return this.http.delete<PublicacionEliminada>(`${URL_PUBLICACIONES}/${id}`);
  }

  /** Sprint 3: GET /publicaciones/:id → detalle de una publicación. */
  obtenerUno(id: string): Observable<Publicacion> {
    return this.http.get<Publicacion>(`${URL_PUBLICACIONES}/${id}`);
  }

  /**
   * GET /publicaciones/:publicacionId/comentarios?offset&limit
   *
   * Paginado desde el Sprint 4: el backend devuelve `{ total, offset, limit,
   * hayMas, comentarios }` y los comentarios vienen del más viejo al más nuevo.
   */
  listarComentarios(
    publicacionId: string,
    filtros: FiltrosComentarios = {},
  ): Observable<ListadoComentarios> {
    const params = new HttpParams()
      .set('offset', String(filtros.offset ?? 0))
      .set('limit', String(filtros.limit ?? COMENTARIOS_POR_PAGINA));

    return this.http.get<ListadoComentarios>(
      `${URL_PUBLICACIONES}/${publicacionId}/comentarios`,
      { params },
    );
  }

  /** POST /publicaciones/:publicacionId/comentarios → 201 con el comentario populado. */
  crearComentario(publicacionId: string, texto: string): Observable<Comentario> {
    return this.http.post<Comentario>(
      `${URL_PUBLICACIONES}/${publicacionId}/comentarios`,
      { texto: texto.trim() },
    );
  }

  /** DELETE /comentarios/:comentarioId → 200 (baja lógica; autor o administrador). */
  eliminarComentario(comentarioId: string): Observable<ComentarioEliminado> {
    return this.http.delete<ComentarioEliminado>(
      `${URL_COMENTARIOS}/${comentarioId}`,
    );
  }

  /**
   * PATCH /comentarios/:comentarioId → 200 con el comentario actualizado.
   * Sólo el autor puede hacerlo; el backend responde 403 al resto.
   */
  editarComentario(comentarioId: string, texto: string): Observable<Comentario> {
    return this.http.patch<Comentario>(`${URL_COMENTARIOS}/${comentarioId}`, {
      texto: texto.trim(),
    });
  }
}

