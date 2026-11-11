import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  USUARIOS_POR_PAGINA,
  estaHabilitado,
  urlAvatar,
  type EstadoUsuario,
  type PerfilUsuario,
  type Usuario,
} from '../../../core/models/usuario.model';
import { AuthService } from '../../../core/services/auth.service';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { mensajesDeError } from '../../../core/utils/error-http.util';
import { fechaRelativa } from '../../../core/utils/fecha.util';
import { FormularioUsuario } from './formulario-usuario/formulario-usuario';

/**
 * Dashboard de usuarios (Sprint 4): listado con búsqueda y filtros, alta y
 * baja/alta lógica. Sólo entra un administrador (lo garantizan `adminGuard` en
 * el router y `RolesGuard` en el backend).
 *
 * Es la dueña del estado del listado; el formulario de alta es un hijo "tonto"
 * que avisa por output y acá se recarga la tabla.
 */
@Component({
  selector: 'app-usuarios',
  imports: [FormularioUsuario],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly auth = inject(AuthService);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly cargando = signal(true);
  protected readonly errores = signal<string[]>([]);
  protected readonly aviso = signal<string | null>(null);
  protected readonly mostrarFormulario = signal(false);

  /** Filtros aplicados (se mandan al backend en cada carga). */
  protected readonly busqueda = signal('');
  protected readonly estado = signal<EstadoUsuario | ''>('');
  protected readonly perfil = signal<PerfilUsuario | ''>('');

  protected readonly limit = USUARIOS_POR_PAGINA;

  /** Usuarios con un cambio de estado en vuelo (se deshabilitan sus botones). */
  private readonly enCurso = signal<ReadonlySet<string>>(new Set());

  protected readonly idActual = computed(() => this.auth.usuarioActual()?.id ?? null);
  protected readonly hayMas = computed(() => this.offset() + this.usuarios().length < this.total());
  protected readonly vacio = computed(
    () => !this.cargando() && this.errores().length === 0 && this.usuarios().length === 0,
  );
  protected readonly desde = computed(() => (this.usuarios().length === 0 ? 0 : this.offset() + 1));
  protected readonly hasta = computed(() => this.offset() + this.usuarios().length);
  protected readonly hayFiltros = computed(
    () => !!this.busqueda().trim() || !!this.estado() || !!this.perfil(),
  );

  ngOnInit(): void {
    this.cargar();
  }

  // ---------- filtros y paginación ----------

  protected buscar(): void {
    this.offset.set(0);
    this.cargar();
  }

  protected alEscribirBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarEstado(evento: Event): void {
    this.estado.set((evento.target as HTMLSelectElement).value as EstadoUsuario | '');
    this.buscar();
  }

  protected alCambiarPerfil(evento: Event): void {
    this.perfil.set((evento.target as HTMLSelectElement).value as PerfilUsuario | '');
    this.buscar();
  }

  /** El botón "Limpiar" del formulario de filtros. */
  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.estado.set('');
    this.perfil.set('');
    this.buscar();
  }

  /** Primera página del listado, con los filtros actuales. */
  protected cargar(): void {
    this.errores.set([]);
    this.cargando.set(true);

    this.usuariosService
      .listar({
        offset: this.offset(),
        limit: this.limit,
        busqueda: this.busqueda(),
        estado: this.estado() || undefined,
        perfil: this.perfil() || undefined,
      })
      .subscribe({
        next: (listado) => {
          this.usuarios.set(listado.usuarios);
          this.total.set(listado.total);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.cargando.set(false);
          this.errores.set(mensajesDeError(error, 'sesion'));
        },
      });
  }

  protected paginaSiguiente(): void {
    if (!this.hayMas() || this.cargando()) {
      return;
    }
    this.offset.update((offset) => offset + this.limit);
    this.cargar();
  }

  protected paginaAnterior(): void {
    if (this.offset() === 0 || this.cargando()) {
      return;
    }
    this.offset.update((offset) => Math.max(0, offset - this.limit));
    this.cargar();
  }

  // ---------- alta ----------

  protected alternarFormulario(): void {
    this.errores.set([]);
    this.aviso.set(null);
    this.mostrarFormulario.update((visible) => !visible);
  }

  /** El formulario hijo avisó que creó la cuenta: se recarga el listado. */
  protected alCrear(usuario: Usuario): void {
    this.mostrarFormulario.set(false);
    this.aviso.set(`Se creó la cuenta de @${usuario.nombreUsuario}.`);
    this.busqueda.set('');
    this.estado.set('');
    this.perfil.set('');
    this.offset.set(0);
    this.cargar();
  }

  // ---------- baja y alta lógica ----------

  protected esMiCuenta(usuario: Usuario): boolean {
    return usuario.id === this.idActual();
  }

  /** El propio administrador no puede deshabilitarse (el backend responde 403). */
  protected puedeDeshabilitar(usuario: Usuario): boolean {
    return estaHabilitado(usuario) && !this.esMiCuenta(usuario);
  }

  protected estaOcupado(usuario: Usuario): boolean {
    return this.enCurso().has(usuario.id);
  }

  /**
   * Deshabilita con `DELETE /usuarios/:id` y habilita con
   * `PATCH /usuarios/:id/estado`. La tabla se actualiza en el lugar con lo que
   * responde el backend, sin recargar toda la página.
   */
  protected alternarEstado(usuario: Usuario): void {
    if (this.estaOcupado(usuario)) {
      return;
    }

    const habilitar = !estaHabilitado(usuario);
    this.errores.set([]);
    this.aviso.set(null);
    this.marcarEnCurso(usuario.id, true);

    const pedido = habilitar
      ? this.usuariosService.cambiarEstado(usuario.id, true)
      : this.usuariosService.deshabilitar(usuario.id);

    pedido.subscribe({
      next: (estado) => {
        this.marcarEnCurso(usuario.id, false);
        this.usuarios.update((actuales) =>
          actuales.map((actual) =>
            actual.id === usuario.id
              ? { ...actual, activo: estado.activo, fechaBaja: estado.fechaBaja }
              : actual,
          ),
        );
        this.aviso.set(
          estado.activo
            ? `Se habilitó la cuenta de @${usuario.nombreUsuario}.`
            : `Se deshabilitó la cuenta de @${usuario.nombreUsuario}. Ya no puede ingresar.`,
        );
        // Con un filtro por estado activo, el usuario puede dejar de pertenecer
        // a la lista: se vuelve a pedir la página para que no quede "colado".
        if (this.estado()) {
          this.cargar();
        }
      },
      error: (error: unknown) => {
        this.marcarEnCurso(usuario.id, false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  // ---------- helpers de la vista ----------

  protected avatar(usuario: Usuario): string {
    return urlAvatar(usuario);
  }

  protected habilitado(usuario: Usuario): boolean {
    return estaHabilitado(usuario);
  }

  protected fechaBaja(usuario: Usuario): string {
    return usuario.fechaBaja ? fechaRelativa(usuario.fechaBaja) : '—';
  }

  private marcarEnCurso(id: string, enCurso: boolean): void {
    this.enCurso.update((actuales) => {
      const nuevo = new Set(actuales);
      if (enCurso) {
        nuevo.add(id);
      } else {
        nuevo.delete(id);
      }
      return nuevo;
    });
  }
}
