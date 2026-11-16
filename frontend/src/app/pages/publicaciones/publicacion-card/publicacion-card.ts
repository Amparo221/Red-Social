import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClicFueraDirective } from '../../../core/directives/clic-fuera.directive';
import { OcupadoDirective } from '../../../core/directives/ocupado.directive';
import { PuedeModerarDirective } from '../../../core/directives/puede-moderar.directive';
import { autorDe, nombreAutor, type Publicacion } from '../../../core/models/publicacion.model';
import { urlAvatar } from '../../../core/models/usuario.model';
import { NumeroPipe } from '../../../core/pipes/numero.pipe';
import { TiempoRelativoPipe } from '../../../core/pipes/tiempo-relativo.pipe';
import { TruncarDescripcionPipe } from '../../../core/pipes/truncar-descripcion.pipe';
import { fechaCompleta } from '../../../core/utils/fecha.util';

/**
 * Tarjeta de una publicación del feed.
 *
 * Es de presentación: no llama al backend. Avisa con `meGusta` / `eliminar` /
 * `abrir` y la página decide (like optimista con rollback, borrado en dos
 * pasos, navegación al detalle).
 *
 * Desde el Sprint 6 no recibe `idUsuario`/`esAdministrador`: quién puede borrar
 * lo decide la directiva `*appPuedeModerar`, que lee la sesión por su cuenta.
 */
@Component({
  selector: 'app-publicacion-card',
  imports: [
    RouterLink,
    PuedeModerarDirective,
    OcupadoDirective,
    ClicFueraDirective,
    TruncarDescripcionPipe,
    TiempoRelativoPipe,
    NumeroPipe,
  ],
  templateUrl: './publicacion-card.html',
  styleUrl: './publicacion-card.css',
})
export class PublicacionCard {
  readonly publicacion = input.required<Publicacion>();
  /** true mientras hay un like o un borrado en curso para esta publicación. */
  readonly ocupada = input(false);

  readonly meGusta = output<void>();
  readonly eliminar = output<void>();
  /** Pidió abrir el detalle (click en cualquier parte que no sea un botón o el título). */
  readonly abrir = output<void>();

  /** Borrado en dos pasos dentro de la tarjeta (evita un confirm() del navegador). */
  protected readonly confirmando = signal(false);

  protected readonly autor = computed(() => autorDe(this.publicacion()));
  protected readonly nombre = computed(() => nombreAutor(this.publicacion()));
  protected readonly avatar = computed(() => urlAvatar(this.autor()));
  protected readonly fechaTooltip = computed(() => fechaCompleta(this.publicacion().createdAt));

  protected pedirConfirmacion(): void {
    this.confirmando.set(true);
  }

  protected cancelar(): void {
    this.confirmando.set(false);
  }

  protected confirmarBorrado(): void {
    this.confirmando.set(false);
    this.eliminar.emit();
  }

  /**
   * Abre el detalle al hacer click en cualquier parte de la tarjeta.
   *
   * Se saltean los elementos interactivos: el título es un `<a>`, y el like y
   * el borrar son `<button>`. Sin esta guarda, tocar el corazón también abriría
   * la publicación y no se podría dar me gusta.
   */
  protected alClickear(evento: MouseEvent): void {
    const destino = evento.target as HTMLElement | null;
    if (destino?.closest('a, button, input, textarea, select, label')) {
      return;
    }
    this.abrir.emit();
  }
}
