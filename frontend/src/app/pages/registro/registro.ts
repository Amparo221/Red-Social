import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { mensajesDeError } from '../../core/utils/error-http.util';

type NombreCampo =
  | 'nombre'
  | 'apellido'
  | 'correo'
  | 'nombreUsuario'
  | 'password'
  | 'fechaNacimiento'
  | 'descripcion';

type Reglas = Partial<Record<'required' | 'email' | 'minlength' | 'maxlength' | 'pattern', string>>;

/**
 * Los límites son los mismos que valida el backend en
 * backend/src/auth/dto/register.dto.ts, para avisar antes de ir al servidor
 * (el backend igual vuelve a validar y sus mensajes son los que se muestran).
 */
const MENSAJES: Record<NombreCampo, Reglas> = {
  nombre: {
    required: 'Ingresá tu nombre.',
    maxlength: 'El nombre no puede superar los 50 caracteres.',
  },
  apellido: {
    required: 'Ingresá tu apellido.',
    maxlength: 'El apellido no puede superar los 50 caracteres.',
  },
  correo: {
    required: 'Ingresá tu correo.',
    email: 'El correo no tiene un formato válido.',
  },
  nombreUsuario: {
    required: 'Elegí un nombre de usuario.',
    minlength: 'El nombre de usuario debe tener al menos 3 caracteres.',
    maxlength: 'El nombre de usuario no puede superar los 30 caracteres.',
    pattern: 'El nombre de usuario no puede contener espacios.',
  },
  password: {
    required: 'Creá una contraseña.',
    minlength: 'La contraseña debe tener al menos 8 caracteres.',
    pattern: 'La contraseña debe tener al menos una mayúscula y un número.',
  },
  fechaNacimiento: {
    required: 'Ingresá tu fecha de nacimiento.',
  },
  descripcion: {
    maxlength: 'La descripción no puede superar los 200 caracteres.',
  },
};

const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB, igual que el FileInterceptor del backend.
const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly enviando = signal(false);
  protected readonly errores = signal<string[]>([]);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly nombreArchivo = signal<string | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly archivo = signal<File | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    apellido: ['', [Validators.required, Validators.maxLength(50)]],
    correo: ['', [Validators.required, Validators.email]],
    nombreUsuario: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30),
        Validators.pattern(/^\S+$/),
      ],
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.pattern(/(?=.*[A-Z])(?=.*\d)/)],
    ],
    fechaNacimiento: ['', [Validators.required]],
    descripcion: ['', [Validators.maxLength(200)]],
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
    if (control.hasError('email')) return reglas.email ?? 'El correo no tiene un formato válido.';
    if (control.hasError('minlength')) return reglas.minlength ?? 'El valor es demasiado corto.';
    if (control.hasError('maxlength')) return reglas.maxlength ?? 'El valor es demasiado largo.';
    if (control.hasError('pattern')) return reglas.pattern ?? 'El formato no es válido.';
    return 'Revisá este campo.';
  }

  protected enviar(): void {
    this.errores.set([]);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.auth.registrar(this.formulario.getRawValue(), this.archivo()).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/inicio'], { queryParams: { bienvenida: 1 } });
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errores.set(mensajesDeError(error));
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

    // Se valida también en el navegador para no subir 5 MB al pedo: el backend
    // lo vuelve a validar con el FileInterceptor.
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
      this.errorImagen.set('La imagen debe ser JPG, PNG, WEBP o GIF.');
      input.value = '';
      return;
    }

    if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
      this.errorImagen.set('La imagen no puede superar los 5 MB.');
      input.value = '';
      return;
    }

    this.archivo.set(archivo);
    this.nombreArchivo.set(archivo.name);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  protected quitarImagen(input: HTMLInputElement): void {
    input.value = '';
    this.liberarVistaPrevia();
    this.archivo.set(null);
    this.nombreArchivo.set(null);
    this.errorImagen.set(null);
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
