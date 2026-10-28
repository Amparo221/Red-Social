import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Credenciales, NuevoUsuario, Usuario } from '../models/usuario.model';

/** Clave con la que se guarda el usuario en el navegador. */
export const CLAVE_SESION = 'purplegram.usuario';

const URL_AUTH = `${environment.apiUrl}/auth`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // signal: Angular 22 es zoneless, así que el header y las pantallas sólo se
  // refrescan si el estado vive en una signal.
  private readonly usuario = signal<Usuario | null>(leerSesionGuardada());

  readonly usuarioActual = this.usuario.asReadonly();
  readonly estaLogueado = computed(() => this.usuario() !== null);

  /**
   * POST /auth/registro
   * El backend espera multipart/form-data (por la foto), no JSON: si se manda
   * como JSON el FileInterceptor no encuentra el archivo `imagen`.
   */
  registrar(datos: NuevoUsuario, imagen?: File | null): Observable<Usuario> {
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
    if (imagen) {
      cuerpo.append('imagen', imagen);
    }

    // Ojo: no se setea Content-Type a mano; el navegador tiene que agregar el
    // boundary del multipart.
    return this.http
      .post<Usuario>(`${URL_AUTH}/registro`, cuerpo)
      .pipe(tap((usuario) => this.guardarSesion(usuario)));
  }

  /** POST /auth/login (JSON). El identificador es correo o nombre de usuario. */
  login(credenciales: Credenciales): Observable<Usuario> {
    const cuerpo: Credenciales = {
      identificador: credenciales.identificador.trim(),
      password: credenciales.password.trim(),
    };

    return this.http
      .post<Usuario>(`${URL_AUTH}/login`, cuerpo)
      .pipe(tap((usuario) => this.guardarSesion(usuario)));
  }

  cerrarSesion(): void {
    this.usuario.set(null);
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Modo privado o storage bloqueado: la sesión queda sólo en memoria.
    }
  }

  private guardarSesion(usuario: Usuario): void {
    this.usuario.set(usuario);
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(usuario));
    } catch {
      // Ídem: si no se puede persistir, la sesión sigue viva en el signal.
    }
  }
}

/** Recupera la sesión guardada para que un F5 no eche al usuario. */
function leerSesionGuardada(): Usuario | null {
  try {
    const guardado = localStorage.getItem(CLAVE_SESION);
    if (!guardado) {
      return null;
    }
    const usuario = JSON.parse(guardado) as Usuario;
    return typeof usuario?.id === 'string' ? usuario : null;
  } catch {
    return null;
  }
}
