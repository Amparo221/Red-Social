import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  USUARIOS_POR_PAGINA,
  type EstadoCambiado,
  type FiltrosUsuarios,
  type ListadoUsuarios,
  type NuevoUsuario,
  type Usuario,
} from '../models/usuario.model';

const URL_USUARIOS = `${environment.apiUrl}/usuarios`;

/**
 * Acceso HTTP al recurso /usuarios (Sprint 4).
 *
 * Todas las rutas exigen sesión de administrador: el `JwtAuthGuard` valida el
 * token y el `RolesGuard` del backend responde 403 al resto. El Bearer lo
 * agrega el `authInterceptor`, así que acá no se toca ningún header.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  /** GET /usuarios?offset&limit&busqueda&estado&perfil */
  listar(filtros: FiltrosUsuarios = {}): Observable<ListadoUsuarios> {
    let params = new HttpParams()
      .set('offset', String(filtros.offset ?? 0))
      .set('limit', String(filtros.limit ?? USUARIOS_POR_PAGINA));

    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      params = params.set('busqueda', busqueda);
    }
    if (filtros.estado) {
      params = params.set('estado', filtros.estado);
    }
    if (filtros.perfil) {
      params = params.set('perfil', filtros.perfil);
    }

    return this.http.get<ListadoUsuarios>(URL_USUARIOS, { params });
  }

  /**
   * POST /usuarios (multipart por la foto opcional).
   * Igual que el registro: no se setea Content-Type a mano, el navegador
   * agrega el boundary.
   */
  crear(datos: NuevoUsuario, imagen?: File | null): Observable<Usuario> {
    const cuerpo = new FormData();
    cuerpo.append('nombre', datos.nombre.trim());
    cuerpo.append('apellido', datos.apellido.trim());
    cuerpo.append('correo', datos.correo.trim());
    cuerpo.append('nombreUsuario', datos.nombreUsuario.trim());
    cuerpo.append('password', datos.password.trim());
    cuerpo.append('fechaNacimiento', datos.fechaNacimiento);

    const descripcion = datos.descripcion?.trim();
    if (descripcion) {
      cuerpo.append('descripcion', descripcion);
    }

    // El backend valida el enum: si no se manda, el DTO usa 'usuario'.
    if (datos.perfil) {
      cuerpo.append('perfil', datos.perfil);
    }

    if (imagen) {
      cuerpo.append('imagen', imagen);
    }

    return this.http.post<Usuario>(URL_USUARIOS, cuerpo);
  }

  /** DELETE /usuarios/:id → baja lógica (la cuenta deja de poder ingresar). */
  deshabilitar(id: string): Observable<EstadoCambiado> {
    return this.http.delete<EstadoCambiado>(`${URL_USUARIOS}/${id}`);
  }

  /** PATCH /usuarios/:id/estado → habilita (`true`) o deshabilita (`false`). */
  cambiarEstado(id: string, activo: boolean): Observable<EstadoCambiado> {
    return this.http.patch<EstadoCambiado>(`${URL_USUARIOS}/${id}/estado`, {
      activo,
    });
  }
}
