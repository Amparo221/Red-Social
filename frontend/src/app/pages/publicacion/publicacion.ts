import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  autorDe,
  esAutor,
  nombreAutor as nombreAutorDe,
  type Publicacion as PublicacionModel,
} from '../../core/models/publicacion.model';
import { esAdministrador, urlAvatar } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import { PublicacionesService } from '../../core/services/publicaciones.service';
import { ComentariosPublicacion } from '../publicaciones/comentarios/comentarios-publicacion';
import { mensajesDeError } from '../../core/utils/error-http.util';
import { fechaCompleta, fechaRelativa } from '../../core/utils/fecha.util';

/**
 * Pantalla de detalle de una publicación (Sprint 3).
 *
 * Muestra una publicación individual con sus datos completos, el botón de me
 * gusta y el de eliminar (solo autor o administrador). Los comentarios viven en
 * `ComentariosPublicacion` (Sprint 4), el mismo componente que usa el perfil:
 * así la paginación, la edición y el borrado se mantienen en un solo lugar.
 */
@Component({
  selector: 'app-publicacion',
  imports: [ComentariosPublicacion],
  templateUrl: './publicacion.html',
  styleUrl: './publicacion.css',
})
export class Publicacion {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicacionesService = inject(PublicacionesService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.usuarioActual;
  protected readonly esAdministrador = computed(() => esAdministrador(this.usuario()));

  protected readonly publicacion = signal<PublicacionModel | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errores = signal<string[]>([]);

  /** Autor populado (null si el backend devolvió sólo el id). */
  protected readonly autor = computed(() => {
    const p = this.publicacion();
    return p ? autorDe(p) : null;
  });
  protected readonly nombreAutor = computed(() => {
    const p = this.publicacion();
    return p ? nombreAutorDe(p) : '';
  });
  protected readonly avatarAutor = computed(() => urlAvatar(this.autor()));

  /** Like en vuelo para la publicación actual. */
  private readonly enCurso = signal<ReadonlySet<string>>(new Set());
  protected readonly likeEnCurso = computed(() => {
    const p = this.publicacion();
    return !!p && this.enCurso().has(p.id);
  });

  /** Borrado en dos pasos. */
  protected readonly confirmandoBorrado = signal(false);
  protected readonly borrando = signal(false);

  // Expone las utilidades de fecha al template.
  protected readonly fechaRelativa = fechaRelativa;
  protected readonly fechaCompleta = fechaCompleta;

  ngOnInit(): void {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!id) {
      this.errores.set(['No se especificó una publicación.']);
      this.cargando.set(false);
      return;
    }

    this.cargar(id);
  }

  /** Carga la publicación por su ID. */
  protected cargar(id: string): void {
    this.errores.set([]);
    this.cargando.set(true);

    this.publicacionesService.obtenerUno(id).subscribe({
      next: (publicacion) => {
        this.publicacion.set(publicacion);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.errores.set(mensajesDeError(error, 'sesion'));
        this.cargando.set(false);
      },
    });
  }

  /** Like optimista con rollback ante error. */
  protected alternarLike(): void {
    const p = this.publicacion();
    if (!p || this.enCurso().has(p.id)) {
      return;
    }

    const estabaLikeada = p.likeado;
    const likesPrevios = p.cantidadLikes;

    this.publicacion.update((actual) =>
      actual
        ? {
            ...actual,
            likeado: !estabaLikeada,
            cantidadLikes: Math.max(0, likesPrevios + (!estabaLikeada ? 1 : -1)),
          }
        : actual
    );
    this.enCurso.update((actual) => new Set(actual).add(p.id));

    const pedido = estabaLikeada
      ? this.publicacionesService.quitarLike(p.id)
      : this.publicacionesService.darLike(p.id);

    pedido.subscribe({
      next: (resultado) => {
        this.publicacion.update((actual) =>
          actual
            ? { ...actual, likeado: resultado.likeado, cantidadLikes: resultado.cantidadLikes }
            : actual
        );
        this.finalizarLike(p.id);
      },
      error: () => {
        this.publicacion.update((actual) =>
          actual
            ? { ...actual, likeado: estabaLikeada, cantidadLikes: likesPrevios }
            : actual
        );
        this.finalizarLike(p.id);
      },
    });
  }

  /** Saca la publicación del set de operaciones en vuelo (evita repetir el like). */
  private finalizarLike(id: string): void {
    this.enCurso.update((actual) => {
      const siguiente = new Set(actual);
      siguiente.delete(id);
      return siguiente;
    });
  }

  /** Borrado en dos pasos. */
  protected pedirConfirmacion(): void {
    this.confirmandoBorrado.set(true);
  }

  protected cancelarBorrado(): void {
    this.confirmandoBorrado.set(false);
  }

  protected confirmarBorrado(): void {
    const p = this.publicacion();
    if (!p) {
      return;
    }

    this.confirmandoBorrado.set(false);
    this.borrando.set(true);

    this.publicacionesService.eliminar(p.id).subscribe({
      next: () => {
        this.borrando.set(false);
        // Volvemos al feed después de borrar.
        void this.router.navigate(['/publicaciones']);
      },
      error: (error: unknown) => {
        this.borrando.set(false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  /** Devuelve true si el usuario de la sesión puede eliminar esta publicación. */
  protected puedeEliminar(): boolean {
    const p = this.publicacion();
    if (!p) {
      return false;
    }

    return esAutor(p, this.usuario()?.id) || this.esAdministrador();
  }

  /** Vuelve al feed. */
  protected volverAlFeed(): void {
    void this.router.navigate(['/publicaciones']);
  }
}
