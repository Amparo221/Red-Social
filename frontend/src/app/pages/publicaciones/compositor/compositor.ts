import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { NuevaPublicacion, Publicacion } from '../../../core/models/publicacion.model';
import { PublicacionesService } from '../../../core/services/publicaciones.service';
import { mensajesDeError } from '../../../core/utils/error-http.util';
import { validarImagen } from '../../../core/utils/imagen.util';

/**
 * Límites del backend (backend/src/publicaciones/schemas/publicacion.schema.ts).
 * Se repiten acá para avisar antes de viajar al servidor; el backend valida de
 * nuevo con el ValidationPipe y sus mensajes son los que se muestran.
 */
const LARGO_MAXIMO_TITULO = 100;
const LARGO_MAXIMO_DESCRIPCION = 500;
const LARGO_MAXIMO_NOMBRE_AVE = 80;

type NombreCampo = 'titulo' | 'descripcion' | 'nombreComun' | 'nombreCientifico';

type Reglas = Partial<Record<'required' | 'maxlength', string>>;

const MENSAJES: Record<NombreCampo, Reglas> = {
  titulo: {
    required: 'Poné un título.',
    maxlength: `El título no puede superar los ${LARGO_MAXIMO_TITULO} caracteres.`,
  },
  descripcion: {
    required: 'Contá algo sobre la publicación.',
    maxlength: `La descripción no puede superar los ${LARGO_MAXIMO_DESCRIPCION} caracteres.`,
  },
  nombreComun: {
    maxlength: `El nombre común no puede superar los ${LARGO_MAXIMO_NOMBRE_AVE} caracteres.`,
  },
  nombreCientifico: {
    maxlength: `El nombre científico no puede superar los ${LARGO_MAXIMO_NOMBRE_AVE} caracteres.`,
  },
};

/**
 * Formulario para publicar, siempre visible arriba del feed.
 *
 * El POST lo hace el propio compositor (tiene el formulario y el archivo a
 * mano) y avisa con `creada` cuando salió bien: la página inserta la
 * publicación arriba de la lista sin recargar todo el feed.
 */
@Component({
  selector: 'app-compositor',
  imports: [ReactiveFormsModule],
  templateUrl: './compositor.html',
  styleUrl: './compositor.css',
})
export class Compositor implements OnDestroy {
  private readonly servicio = inject(PublicacionesService);
  private readonly fb = inject(FormBuilder);
  private readonly archivoInput = viewChild<ElementRef<HTMLInputElement>>('archivoInput');

  /** Se emite con la publicación ya creada por el backend. */
  readonly creada = output<Publicacion>();

  protected readonly enviando = signal(false);
  protected readonly errores = signal<string[]>([]);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly nombreArchivo = signal<string | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly archivo = signal<File | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(LARGO_MAXIMO_TITULO)]],
    descripcion: ['', [Validators.required, Validators.maxLength(LARGO_MAXIMO_DESCRIPCION)]],
    nombreComun: ['', [Validators.maxLength(LARGO_MAXIMO_NOMBRE_AVE)]],
    nombreCientifico: ['', [Validators.maxLength(LARGO_MAXIMO_NOMBRE_AVE)]],
  });

  protected get descripcion() {
    return this.formulario.controls.descripcion;
  }

  /** Mensaje de error del campo, o null si todavía no hay que mostrarlo. */
  protected mensaje(campo: NombreCampo): string | null {
    const control = this.formulario.controls[campo];
    if (!control.invalid || !(control.touched || control.dirty)) {
      return null;
    }

    const reglas = MENSAJES[campo];
    if (control.hasError('required')) return reglas.required ?? 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return reglas.maxlength ?? 'El valor es demasiado largo.';
    return 'Revisá este campo.';
  }

  protected enviar(): void {
    this.errores.set([]);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);

    const datos: NuevaPublicacion = this.formulario.getRawValue();

    this.servicio.crear(datos, this.archivo()).subscribe({
      next: (publicacion) => {
        this.enviando.set(false);
        this.limpiar();
        this.creada.emit(publicacion);
      },
      // Contexto 'sesion': acá un 401 significa token vencido, no credenciales
      // inválidas (el interceptor además manda al login).
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  /** Valida el archivo elegido y arma la vista previa. */
  protected alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    this.errorImagen.set(null);
    this.liberarVistaPrevia();

    if (!archivo) {
      this.archivo.set(null);
      this.nombreArchivo.set(null);
      return;
    }

    const error = validarImagen(archivo);
    if (error) {
      this.errorImagen.set(error);
      input.value = '';
      return;
    }

    this.archivo.set(archivo);
    this.nombreArchivo.set(archivo.name);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  protected quitarImagen(): void {
    const input = this.archivoInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.liberarVistaPrevia();
    this.archivo.set(null);
    this.nombreArchivo.set(null);
    this.errorImagen.set(null);
  }

  /** Deja el formulario listo para la próxima publicación. */
  private limpiar(): void {
    this.formulario.reset({
      titulo: '',
      descripcion: '',
      nombreComun: '',
      nombreCientifico: '',
    });
    this.quitarImagen();
  }

  /** Evita dejar blobs colgados cuando se cambia de pantalla. */
  private liberarVistaPrevia(): void {
    const url = this.vistaPrevia();
    if (url) {
      URL.revokeObjectURL(url);
      this.vistaPrevia.set(null);
    }
  }

  ngOnDestroy(): void {
    this.liberarVistaPrevia();
  }
}
