import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PublicacionesService } from '../../core/services/publicaciones.service';
import { PublicacionCard } from '../publicaciones/publicacion-card/publicacion-card';
import { ComentariosPublicacion } from '../publicaciones/comentarios/comentarios-publicacion';
import { urlAvatar, esAdministrador } from '../../core/models/usuario.model';
import { mensajesDeError } from '../../core/utils/error-http.util';
import type { Publicacion, FiltrosPublicaciones } from '../../core/models/publicacion.model';

@Component({
  selector: 'app-inicio',
  imports: [PublicacionCard, ComentariosPublicacion],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly publicacionesService = inject(PublicacionesService);

  protected readonly usuario = this.auth.usuarioActual;
  protected readonly avatar = computed(() => urlAvatar(this.usuario()));
  protected readonly esAdministrador = computed(() => esAdministrador(this.usuario()));
  protected readonly idUsuario = computed(() => this.usuario()?.id ?? null);

  protected readonly fechaNacimiento = computed(() => this.formatearFecha(this.usuario()?.fechaNacimiento));
  protected readonly miembroDesde = computed(() => this.formatearFecha(this.usuario()?.createdAt));

  public readonly misPublicaciones = signal<Publicacion[]>([]);
  public readonly cargandoMisPublicaciones = signal(true);
  public readonly erroresMisPublicaciones = signal<string[]>([]);

  ngOnInit(): void {
    this.cargarMisPublicaciones();
  }

  /** Click en cualquier parte de la tarjeta (menos el like): abre el detalle. */
  protected abrirDetalle(publicacion: Publicacion): void {
    void this.router.navigate(['/publicaciones', publicacion.id]);
  }

  /** Últimas 3 publicaciones del usuario logueado, para mostrar en el perfil. */
  public cargarMisPublicaciones(): void {
    const id = this.usuario()?.id;
    if (!id) {
      this.cargandoMisPublicaciones.set(false);
      return;
    }

    this.erroresMisPublicaciones.set([]);
    this.cargandoMisPublicaciones.set(true);

    const filtros: FiltrosPublicaciones = {
      offset: 0,
      limit: 3,
      orden: 'fecha',
      usuario: id,
    };

    this.publicacionesService.listar(filtros).subscribe({
      next: (listado) => {
        this.misPublicaciones.set(listado.publicaciones);
        this.cargandoMisPublicaciones.set(false);
      },
      error: (error: unknown) => {
        this.erroresMisPublicaciones.set(mensajesDeError(error, 'sesion'));
        this.cargandoMisPublicaciones.set(false);
      },
    });
  }

  /** Like en una publicación del perfil: toggle optimista con rollback ante error. */
  public alternarLike(publicacion: Publicacion): void {
    const estabaLikeada = publicacion.likeado;
    const likesPrevios = publicacion.cantidadLikes;

    this.misPublicaciones.update((actuales) =>
      actuales.map((p) =>
        p.id === publicacion.id
          ? { ...p, likeado: !estabaLikeada, cantidadLikes: Math.max(0, likesPrevios + (!estabaLikeada ? 1 : -1)) }
          : p
      )
    );

    const pedido = estabaLikeada
      ? this.publicacionesService.quitarLike(publicacion.id)
      : this.publicacionesService.darLike(publicacion.id);

    pedido.subscribe({
      next: (resultado) => {
        this.misPublicaciones.update((actuales) =>
          actuales.map((p) =>
            p.id === publicacion.id
              ? { ...p, likeado: resultado.likeado, cantidadLikes: resultado.cantidadLikes }
              : p
          )
        );
      },
      error: () => {
        this.misPublicaciones.update((actuales) =>
          actuales.map((p) =>
            p.id === publicacion.id
              ? { ...p, likeado: estabaLikeada, cantidadLikes: likesPrevios }
              : p
          )
        );
      },
    });
  }

  /** Borrar una publicación del perfil. */
  public eliminarMis(publicacion: Publicacion): void {
    this.publicacionesService.eliminar(publicacion.id).subscribe({
      next: () => {
        this.misPublicaciones.update((actuales) =>
          actuales.filter((p) => p.id !== publicacion.id)
        );
      },
      error: () => {
        this.erroresMisPublicaciones.set(['No se pudo eliminar la publicación.']);
      },
    });
  }

  /** `fechaNacimiento` es 'AAAA-MM-DD': se muestra como texto legible. */
  private formatearFecha(valor: string | undefined): string {
    if (!valor) {
      return '';
    }

    // Se le agrega la hora para que el navegador no corra un día por la zona horaria.
    const fecha = new Date(valor.includes('T') ? valor : `${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime())
      ? valor
      : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
