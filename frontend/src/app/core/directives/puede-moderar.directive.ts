import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
  type EmbeddedViewRef,
  type OnInit,
} from '@angular/core';
import { esAdministrador, type Usuario } from '../models/usuario.model';
import { AuthService } from '../services/auth.service';

/** El autor puede venir populado (objeto) o sólo como id suelto. */
export type ReferenciaAutor = string | { id: string } | null | undefined;

/**
 * Muestra el bloque sólo si la sesión puede moderar el contenido (Sprint 6).
 *
 * Reemplaza la lógica que antes vivía repetida en los componentes
 * (`computed puedeEliminar`, inputs `idUsuario`/`esAdministrador`): la regla es
 * la misma que aplica el backend:
 *
 *  - borrar publicaciones y comentarios: autor **o** administrador;
 *  - editar comentarios: sólo el autor (por eso existe `soloAutor`).
 *
 * Uso:
 * `*appPuedeModerar="publicacion().usuario"`
 * `*appPuedeModerar="comentario.autor; soloAutor: true"`
 */
@Directive({
  selector: '[appPuedeModerar]',
})
export class PuedeModerarDirective implements OnInit {
  /** Autor del contenido: id u objeto con `id`. */
  readonly appPuedeModerar = input<ReferenciaAutor>(null);
  /**
   * true para "sólo el autor": un administrador no puede moderar.
   *
   * El alias es obligatorio: en la microsintaxis Angular prefija las claves
   * secundarias con el nombre de la directiva, así que `soloAutor: true` se
   * enlaza contra `appPuedeModerarSoloAutor`.
   */
  readonly soloAutor = input(false, { alias: 'appPuedeModerarSoloAutor' });

  private readonly plantilla = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  /** Vista creada (null cuando el bloque está oculto). */
  private vista: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    // Reacciona a cambios de sesión (login/logout) y a los inputs.
    effect(() => {
      this.appPuedeModerar();
      this.soloAutor();
      this.auth.usuarioActual();
      this.actualizar();
    });
  }

  ngOnInit(): void {
    // Primera evaluación sincrónica (los inputs ya están seteados): así el
    // bloque aparece en el mismo render y no parpadea.
    this.actualizar();
  }

  private actualizar(): void {
    const autorId = idDeAutor(this.appPuedeModerar());
    const puede = puedeModerar(autorId, this.auth.usuarioActual(), this.soloAutor());

    if (puede === (this.vista !== null)) {
      return;
    }

    if (puede) {
      this.vista = this.contenedor.createEmbeddedView(this.plantilla);
    } else {
      this.contenedor.clear();
      this.vista = null;
    }
  }
}

/** Normaliza el input a un id (o null si no hay autor). */
export function idDeAutor(referencia: ReferenciaAutor): string | null {
  if (!referencia) {
    return null;
  }
  return typeof referencia === 'string' ? referencia : referencia.id || null;
}

/**
 * Regla pura, exportada para poder testearla sin montar la directiva.
 * Sin sesión no se muestra nada; con `soloAutor` el administrador queda afuera.
 */
export function puedeModerar(
  autorId: string | null,
  usuario: Pick<Usuario, 'id' | 'perfil'> | null | undefined,
  soloAutor = false,
): boolean {
  if (!usuario) {
    return false;
  }
  if (autorId && usuario.id === autorId) {
    return true;
  }
  return !soloAutor && esAdministrador(usuario);
}
