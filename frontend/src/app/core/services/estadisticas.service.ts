import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ESTADISTICAS_LIMITE,
  type ConsultaEstadisticas,
  type EstadisticasResponse,
} from '../models/estadisticas.model';

const URL_ESTADISTICAS = `${environment.apiUrl}/estadisticas`;

/**
 * Acceso HTTP al dashboard de estadísticas (Sprint 5).
 *
 * Es una única llamada: el backend devuelve las tres métricas juntas para que
 * los gráficos se actualicen a la vez. La ruta exige administrador (el
 * `RolesGuard` responde 403 al resto) y el Bearer lo agrega el
 * `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly http = inject(HttpClient);

  /** GET /estadisticas?desde&hasta&agrupacion&limite */
  consultar(consulta: ConsultaEstadisticas): Observable<EstadisticasResponse> {
    const params = new HttpParams()
      .set('desde', consulta.desde)
      .set('hasta', consulta.hasta)
      .set('agrupacion', consulta.agrupacion)
      .set('limite', String(consulta.limite ?? ESTADISTICAS_LIMITE));

    return this.http.get<EstadisticasResponse>(URL_ESTADISTICAS, { params });
  }
}
