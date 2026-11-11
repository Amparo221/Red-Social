import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PUBLICACIONES_POR_PAGINA,
  type FiltrosPublicaciones,
  type OrdenPublicaciones,
  type Publicacion,
} from '../../core/models/publicacion.model';
import { esAdministrador } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import { PublicacionesService } from '../../core/services/publicaciones.service';
import { mensajesDeError } from '../../core/utils/error-http.util';
import { Compositor } from './compositor/compositor';
import { PublicacionCard } from './publicacion-card/publicacion-card';

/**
 * Pantalla principal: el feed de publicaciones.
 *
 * Es la dueña del estado del listado (publicaciones, orden, filtro, total). El
 * compositor y la tarjeta son hijos "tontos": avisan por output y acá se llama
 * al backend.
 */
@Component({
  selector: 'app-publicaciones',
  imports: [Compositor, PublicacionCard],
  templateUrl: './publicaciones.html',
  styleUrl: './publicaciones.css',
})
export class Publicaciones implements OnInit {
  private readonly publicacionesService = inject(PublicacionesService);
  private readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuarioActual;
  protected readonly idUsuario = computed(() => this.usuario()?.id ?? null);
  protected readonly esAdministrador = computed(() => esAdministrador(this.usuario()));

  protected readonly publicaciones = signal<Publicacion[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly errores = signal<string[]>([]);
  protected readonly aviso = signal<string | null>(null);
  protected readonly orden = signal<OrdenPublicaciones>('fecha');

  /** Publicaciones con un like o un borrado en vuelo (se deshabilitan sus botones). */
  private readonly enCurso = signal<ReadonlySet<string>>(new Set());

  /** El saludo de bienvenida se muestra sólo al volver del registro. */
  protected readonly recienRegistrado = this.ruta.snapshot.queryParamMap.has('bienvenida');

  /** El backend ya manda `hayMas`, pero así queda bien después de crear o borrar. */
  protected readonly hayMas = computed(() => this.publicaciones().length < this.total());

  // Con un error de carga no se muestra el estado vacío: abajo ya está la alerta.
  protected readonly vacio = computed(
    () => !this.cargando() && this.errores().length === 0 && this.publicaciones().length === 0,
  );

  ngOnInit(): void {
    this.cargar();
  }

  // ---------- filtros y paginación ----------

  protected cambiarOrden(orden: OrdenPublicaciones): void {
    if (this.orden() === orden) {
      return;
    }
    this.orden.set(orden);
    this.cargar();
  }

  /** Primera página: se usa al entrar y cada vez que cambia el orden o el filtro. */
  protected cargar(): void {
    this.errores.set([]);
    this.cargando.set(true);

    this.publicacionesService.listar(this.filtros(0)).subscribe({
      next: (listado) => {
        this.publicaciones.set(listado.publicaciones);
        this.total.set(listado.total);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.publicaciones.set([]);
        this.total.set(0);
        this.cargando.set(false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  /** Siguiente página, agregada abajo de lo que ya se ve. */
  protected cargarMas(): void {
    if (this.cargandoMas() || !this.hayMas()) {
      return;
    }

    this.cargandoMas.set(true);
    this.errores.set([]);

    // offset = cantidad ya mostrada: sirve tanto si se creó una publicación
    // (corre todo un lugar) como si se borró (se achica la lista).
    this.publicacionesService.listar(this.filtros(this.publicaciones().length)).subscribe({
      next: (listado) => {
        this.publicaciones.update((actuales) => {
          // El @for usa `track` por id: si el backend repite una publicación
          // (alguien publicó entre página y página) se filtra acá.
          const ids = new Set(actuales.map((publicacion) => publicacion.id));
          return [
            ...actuales,
            ...listado.publicaciones.filter((publicacion) => !ids.has(publicacion.id)),
          ];
        });
        this.total.set(listado.total);
        this.cargandoMas.set(false);
      },
      error: (error: unknown) => {
        this.cargandoMas.set(false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  // ---------- acciones sobre las publicaciones ----------

  /** El compositor ya la creó en el backend: se inserta arriba sin recargar. */
  protected alCrear(publicacion: Publicacion): void {
    this.publicaciones.update((actuales) => [publicacion, ...actuales]);
    this.total.update((total) => total + 1);
    this.aviso.set('¡Publicación creada!');
    this.errores.set([]);
  }

  protected alEliminar(publicacion: Publicacion): void {
    if (this.enCurso().has(publicacion.id)) {
      return;
    }

    this.errores.set([]);
    this.aviso.set(null);
    this.marcarEnCurso(publicacion.id, true);

    this.publicacionesService.eliminar(publicacion.id).subscribe({
      next: () => {
        this.marcarEnCurso(publicacion.id, false);
        this.publicaciones.update((actuales) =>
          actuales.filter((actual) => actual.id !== publicacion.id),
        );
        this.total.update((total) => Math.max(0, total - 1));
        this.aviso.set('Publicación eliminada.');
      },
      error: (error: unknown) => {
        this.marcarEnCurso(publicacion.id, false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  /**
   * Like optimista: la tarjeta cambia al instante y, si el backend falla, se
   * vuelve a los valores anteriores. La respuesta del backend manda cuando
   * llega, así el contador nunca queda desfasado.
   */
  protected alternarLike(publicacion: Publicacion): void {
    const { id, likeado: estabaLikeada, cantidadLikes: likesPrevios } = publicacion;

    // Un solo pedido por publicación: el segundo click espera al primero.
    if (this.enCurso().has(id)) {
      return;
    }

    this.marcarEnCurso(id, true);
    this.aplicarLike(id, !estabaLikeada, likesPrevios + (estabaLikeada ? -1 : 1));

    const pedido = estabaLikeada
      ? this.publicacionesService.quitarLike(id)
      : this.publicacionesService.darLike(id);

    pedido.subscribe({
      next: (resultado) => {
        this.aplicarLike(id, resultado.likeado, resultado.cantidadLikes);
        this.marcarEnCurso(id, false);
      },
      error: (error: unknown) => {
        // 409 = el servidor ya estaba en el estado que acabamos de pintar (por
        // ejemplo, dos pestañas abiertas): se deja el cambio y se muestra el
        // mensaje del backend. Con cualquier otro error se revierte.
        const esConflicto = error instanceof HttpErrorResponse && error.status === 409;
        if (!esConflicto) {
          this.aplicarLike(id, estabaLikeada, likesPrevios);
        }
        this.marcarEnCurso(id, false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  protected estaOcupada(publicacion: Publicacion): boolean {
    return this.enCurso().has(publicacion.id);
  }

  /** Click en cualquier parte de la tarjeta (menos el like): abre el detalle. */
  protected abrirDetalle(publicacion: Publicacion): void {
    void this.router.navigate(['/publicaciones', publicacion.id]);
  }

  // ---------- helpers ----------

  private filtros(offset: number): FiltrosPublicaciones {
    return {
      offset,
      limit: PUBLICACIONES_POR_PAGINA,
      orden: this.orden(),
    };
  }

  private aplicarLike(id: string, likeado: boolean, cantidadLikes: number): void {
    this.publicaciones.update((actuales) =>
      actuales.map((publicacion) =>
        publicacion.id === id
          ? { ...publicacion, likeado, cantidadLikes: Math.max(0, cantidadLikes) }
          : publicacion,
      ),
    );
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
