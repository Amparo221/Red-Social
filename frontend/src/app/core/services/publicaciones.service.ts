import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PUBLICACIONES_POR_PAGINA,
  type FiltrosPublicaciones,
  type ListadoPublicaciones,
  type NuevaPublicacion,
  type Publicacion,
  type PublicacionEliminada,
  type ResultadoLike,
} from '../models/publicacion.model';

const URL_PUBLICACIONES = `${environment.apiUrl}/publicaciones`;

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
}
