import { Component, computed, input, output, signal } from '@angular/core';
import {
  autorDe,
  esAutor,
  nombreAutor,
  type Publicacion,
} from '../../../core/models/publicacion.model';
import { urlAvatar } from '../../../core/models/usuario.model';
import { fechaCompleta, fechaRelativa } from '../../../core/utils/fecha.util';

/**
 * Tarjeta de una publicación del feed.
 *
 * Es de presentación: no llama al backend. Avisa con `meGusta` / `eliminar` y
 * la página decide (like optimista con rollback, borrado en dos pasos).
 */
@Component({
  selector: 'app-publicacion-card',
  templateUrl: './publicacion-card.html',
  styleUrl: './publicacion-card.css',
})
export class PublicacionCard {
  readonly publicacion = input.required<Publicacion>();
  /** Id del usuario de la sesión: con eso se decide si puede borrar. */
  readonly idUsuario = input<string | null>(null);
  readonly esAdministrador = input(false);
  /** true mientras hay un like o un borrado en curso para esta publicación. */
  readonly ocupada = input(false);

  readonly meGusta = output<void>();
  readonly eliminar = output<void>();

  /** Borrado en dos pasos dentro de la tarjeta (evita un confirm() del navegador). */
  protected readonly confirmando = signal(false);

  protected readonly autor = computed(() => autorDe(this.publicacion()));
  protected readonly nombre = computed(() => nombreAutor(this.publicacion()));
  protected readonly avatar = computed(() => urlAvatar(this.autor()));
  protected readonly fecha = computed(() => fechaRelativa(this.publicacion().createdAt));
  protected readonly fechaTooltip = computed(() => fechaCompleta(this.publicacion().createdAt));
  protected readonly puedeEliminar = computed(
    () => esAutor(this.publicacion(), this.idUsuario()) || this.esAdministrador(),
  );

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
}
