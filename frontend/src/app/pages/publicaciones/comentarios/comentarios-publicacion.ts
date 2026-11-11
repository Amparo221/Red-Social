import { Component, computed, inject, input, signal } from '@angular/core';
import {
  COMENTARIOS_POR_PAGINA,
  MAXIMO_TEXTO_COMENTARIO,
  autorComentarioDe,
  esAutorComentario,
  estaEditado,
  nombreAutorComentario,
  puedeEditarComentario,
  type Comentario,
} from '../../../core/models/publicacion.model';
import { esAdministrador, urlAvatar } from '../../../core/models/usuario.model';
import { AuthService } from '../../../core/services/auth.service';
import { PublicacionesService } from '../../../core/services/publicaciones.service';
import { mensajesDeError } from '../../../core/utils/error-http.util';
import { fechaCompleta, fechaRelativa } from '../../../core/utils/fecha.util';

/**
 * Comentarios de una publicación (Sprint 4).
 *
 * Es el único lugar donde viven la paginación (3 por vez + "cargar más"), el
 * alta, la edición (sólo el autor, con la marca "editado") y el borrado (autor
 * o administrador). Se usa en dos pantallas:
 *
 *  - detalle (`soloLectura` = false): todo habilitado;
 *  - perfil (`soloLectura` = true): sólo la lista paginada, sin formulario ni
 *    acciones, porque el perfil es una vista de resumen.
 */
@Component({
  selector: 'app-comentarios',
  templateUrl: './comentarios-publicacion.html',
  styleUrl: './comentarios-publicacion.css',
})
export class ComentariosPublicacion {
  /** Publicación cuyos comentarios se muestran. */
  readonly idPublicacion = input.required<string>();
  /** true en el perfil: lista sin formulario ni botones de editar/borrar. */
  readonly soloLectura = input(false);
  /**
   * true cuando los comentarios van dentro de la tarjeta de la publicación
   * (perfil): sin borde ni fondo propios, para que no parezcan otra caja.
   */
  readonly embebido = input(false);

  private readonly publicacionesService = inject(PublicacionesService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.usuarioActual;
  protected readonly esAdministrador = computed(() => esAdministrador(this.usuario()));

  protected readonly comentarios = signal<Comentario[]>([]);
  protected readonly total = signal(0);
  protected readonly hayMas = signal(false);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly errores = signal<string[]>([]);

  /** Alta de un comentario nuevo. */
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);

  /** Edición: se edita de a un comentario por vez. */
  protected readonly editandoId = signal<string | null>(null);
  protected readonly textoEdicion = signal('');
  protected readonly guardandoEdicion = signal(false);

  /** Ids con un DELETE en vuelo (deshabilita sus botones). */
  protected readonly eliminando = signal<ReadonlySet<string>>(new Set());

  /** Largo máximo que acepta el backend, para los contadores. */
  protected readonly maximoTexto = MAXIMO_TEXTO_COMENTARIO;

  /**
   * Cuántos comentarios ya se pidieron al servidor. Se usa como `offset` del
   * próximo "cargar más"; avanza con la respuesta, no con lo que se ve.
   */
  private offsetServidor = 0;

  ngOnInit(): void {
    this.cargar();
  }

  /** Primera página (y reintento cuando falla la carga). */
  protected cargar(): void {
    this.errores.set([]);
    this.cargando.set(true);
    this.offsetServidor = 0;

    this.publicacionesService
      .listarComentarios(this.idPublicacion(), {
        offset: 0,
        limit: COMENTARIOS_POR_PAGINA,
      })
      .subscribe({
        next: (listado) => {
          this.comentarios.set(listado.comentarios);
          this.total.set(listado.total);
          this.hayMas.set(listado.hayMas);
          this.offsetServidor = listado.offset + listado.comentarios.length;
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.comentarios.set([]);
          this.total.set(0);
          this.hayMas.set(false);
          this.errores.set(mensajesDeError(error, 'sesion'));
          this.cargando.set(false);
        },
      });
  }

  /** Pide la página siguiente y la agrega al final de la lista. */
  protected cargarMas(): void {
    if (this.cargando() || this.cargandoMas() || !this.hayMas()) {
      return;
    }

    const offset = this.offsetServidor;
    this.errores.set([]);
    this.cargandoMas.set(true);

    this.publicacionesService
      .listarComentarios(this.idPublicacion(), {
        offset,
        limit: COMENTARIOS_POR_PAGINA,
      })
      .subscribe({
        next: (listado) => {
          // Deduplicado por id: si mientras se paginaba se borró un comentario,
          // el servidor puede devolver uno que ya está en pantalla.
          this.comentarios.update((actuales) => {
            const yaMostrados = new Set(actuales.map((c) => c.id));
            return [
              ...actuales,
              ...listado.comentarios.filter((c) => !yaMostrados.has(c.id)),
            ];
          });
          this.total.set(listado.total);
          this.hayMas.set(listado.hayMas);
          this.offsetServidor = listado.offset + listado.comentarios.length;
          this.cargandoMas.set(false);
        },
        error: (error: unknown) => {
          this.errores.set(mensajesDeError(error, 'sesion'));
          this.cargandoMas.set(false);
        },
      });
  }

  /** Publica el texto del textarea y lo agrega al final del hilo. */
  protected agregar(): void {
    const texto = this.texto().trim();
    if (!texto || this.enviando() || texto.length > MAXIMO_TEXTO_COMENTARIO) {
      return;
    }

    this.errores.set([]);
    this.enviando.set(true);

    this.publicacionesService
      .crearComentario(this.idPublicacion(), texto)
      .subscribe({
        next: (comentario) => {
          // El hilo va del más viejo al más nuevo: el nuevo va al final.
          this.comentarios.update((actuales) => [...actuales, comentario]);
          this.total.update((valor) => valor + 1);
          this.texto.set('');
          this.enviando.set(false);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.errores.set(mensajesDeError(error, 'sesion'));
        },
      });
  }

  protected actualizarTexto(evento: Event): void {
    const campo = evento.target as HTMLTextAreaElement | null;
    this.texto.set(campo?.value ?? '');
  }

  /** Abre el editor en línea con el texto actual del comentario. */
  protected comenzarEdicion(comentario: Comentario): void {
    if (!this.puedeEditar(comentario)) {
      return;
    }

    this.errores.set([]);
    this.editandoId.set(comentario.id);
    this.textoEdicion.set(comentario.texto);
  }

  protected actualizarTextoEdicion(evento: Event): void {
    const campo = evento.target as HTMLTextAreaElement | null;
    this.textoEdicion.set(campo?.value ?? '');
  }

  protected cancelarEdicion(): void {
    this.editandoId.set(null);
    this.textoEdicion.set('');
  }

  /** PATCH del comentario y reemplazo en la lista con lo que devuelve el backend. */
  protected guardarEdicion(comentario: Comentario): void {
    const texto = this.textoEdicion().trim();
    if (!texto || this.guardandoEdicion() || texto.length > MAXIMO_TEXTO_COMENTARIO) {
      return;
    }

    // Sin cambios reales: se cierra el editor y no se molesta al backend.
    if (texto === comentario.texto.trim()) {
      this.cancelarEdicion();
      return;
    }

    this.errores.set([]);
    this.guardandoEdicion.set(true);

    this.publicacionesService.editarComentario(comentario.id, texto).subscribe({
      next: (actualizado) => {
        // La respuesta ya trae `editado: true` y `fechaEdicion`: el badge
        // aparece sin recargar la lista.
        this.comentarios.update((actuales) =>
          actuales.map((c) => (c.id === actualizado.id ? actualizado : c)),
        );
        this.guardandoEdicion.set(false);
        this.cancelarEdicion();
      },
      error: (error: unknown) => {
        this.guardandoEdicion.set(false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  /** Borra un comentario (baja lógica) y lo saca de la lista. */
  protected eliminar(comentario: Comentario): void {
    if (this.eliminando().has(comentario.id)) {
      return;
    }

    this.errores.set([]);
    this.marcarEliminando(comentario.id, true);

    this.publicacionesService.eliminarComentario(comentario.id).subscribe({
      next: () => {
        this.comentarios.update((actuales) =>
          actuales.filter((c) => c.id !== comentario.id),
        );
        this.total.update((valor) => Math.max(0, valor - 1));
        if (this.editandoId() === comentario.id) {
          this.cancelarEdicion();
        }
        this.marcarEliminando(comentario.id, false);
      },
      error: (error: unknown) => {
        this.errores.set(mensajesDeError(error, 'sesion'));
        this.marcarEliminando(comentario.id, false);
      },
    });
  }

  /** El backend deja borrar al autor del comentario o a un administrador. */
  protected puedeEliminar(comentario: Comentario): boolean {
    return esAutorComentario(comentario, this.usuario()?.id, this.esAdministrador());
  }

  /** Editar es más restrictivo: sólo el autor. */
  protected puedeEditar(comentario: Comentario): boolean {
    return puedeEditarComentario(comentario, this.usuario()?.id);
  }

  protected estaEditando(comentario: Comentario): boolean {
    return this.editandoId() === comentario.id;
  }

  protected estaEliminando(comentarioId: string): boolean {
    return this.eliminando().has(comentarioId);
  }

  protected yaEditado(comentario: Comentario): boolean {
    return estaEditado(comentario);
  }

  // El autor del comentario puede venir sin popular: estos helpers resuelven
  // el avatar y el nombre en el template.

  protected avatarDe(comentario: Comentario): string {
    return urlAvatar(autorComentarioDe(comentario));
  }

  protected nombreDe(comentario: Comentario): string {
    return nombreAutorComentario(comentario);
  }

  protected usuarioDe(comentario: Comentario): string {
    return autorComentarioDe(comentario)?.nombreUsuario ?? '';
  }

  // Expone las utilidades de fecha al template.
  protected readonly fechaRelativa = fechaRelativa;
  protected readonly fechaCompleta = fechaCompleta;

  private marcarEliminando(comentarioId: string, eliminando: boolean): void {
    this.eliminando.update((actual) => {
      const siguiente = new Set(actual);
      if (eliminando) {
        siguiente.add(comentarioId);
      } else {
        siguiente.delete(comentarioId);
      }
      return siguiente;
    });
  }
}
