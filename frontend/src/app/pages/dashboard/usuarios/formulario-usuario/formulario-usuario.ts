import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { PerfilUsuario, Usuario } from '../../../../core/models/usuario.model';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { mensajesDeError } from '../../../../core/utils/error-http.util';
import { validarImagen } from '../../../../core/utils/imagen.util';

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
 * Mismos límites que el backend (`RegisterDto` + `CrearUsuarioDto`), para
 * avisar antes de ir al servidor. El backend vuelve a validar y sus mensajes
 * son los que se muestran si algo se escapa.
 */
const MENSAJES: Record<NombreCampo, Reglas> = {
  nombre: {
    required: 'Ingresá el nombre.',
    maxlength: 'El nombre no puede superar los 50 caracteres.',
  },
  apellido: {
    required: 'Ingresá el apellido.',
    maxlength: 'El apellido no puede superar los 50 caracteres.',
  },
  correo: {
    required: 'Ingresá el correo.',
    email: 'El correo no tiene un formato válido.',
  },
  nombreUsuario: {
    required: 'Elegí un nombre de usuario.',
    minlength: 'El nombre de usuario debe tener al menos 3 caracteres.',
    maxlength: 'El nombre de usuario no puede superar los 30 caracteres.',
    pattern: 'El nombre de usuario no puede contener espacios.',
  },
  password: {
    required: 'Asigná una contraseña.',
    minlength: 'La contraseña debe tener al menos 8 caracteres.',
    pattern: 'La contraseña debe tener al menos una mayúscula y un número.',
  },
  fechaNacimiento: {
    required: 'Ingresá la fecha de nacimiento.',
  },
  descripcion: {
    maxlength: 'La descripción no puede superar los 200 caracteres.',
  },
};

/**
 * Alta de usuarios del dashboard (Sprint 4).
 *
 * Es un componente "tonto": no recarga listados ni navega. Cuando el backend
 * responde, emite `creada` con el usuario nuevo y el padre decide qué hacer.
 * Pide los mismos datos que el registro público más el perfil.
 */
@Component({
  selector: 'app-formulario-usuario',
  imports: [ReactiveFormsModule],
  templateUrl: './formulario-usuario.html',
  styleUrl: './formulario-usuario.css',
})
export class FormularioUsuario implements OnDestroy {
  private readonly usuariosService = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);

  readonly creada = output<Usuario>();
  readonly cancelar = output<void>();

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
    perfil: ['usuario' as PerfilUsuario, [Validators.required]],
  });

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
    this.usuariosService.crear(this.formulario.getRawValue(), this.archivo()).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        this.creada.emit(usuario);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        // Los 409 (correo o usuario repetido) llegan con el mensaje del backend.
        this.errores.set(mensajesDeError(error, 'sesion'));
      },
    });
  }

  protected cancelarAlta(): void {
    this.cancelar.emit();
  }

  /** Valida el archivo elegido y arma la vista previa (igual que el registro). */
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

  protected quitarImagen(input: HTMLInputElement): void {
    input.value = '';
    this.liberarVistaPrevia();
    this.archivo.set(null);
    this.nombreArchivo.set(null);
    this.errorImagen.set(null);
  }

  /** Evita dejar blobs colgados cuando se cierra el formulario. */
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
