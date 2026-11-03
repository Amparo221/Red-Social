import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SESION_EXPIRADA, mensajesDeError } from '../../core/utils/error-http.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly enviando = signal(false);

  /**
   * `?sesion=expirada` lo pone el authInterceptor cuando el JWT venció (dura 15
   * minutos): la alerta arranca visible para que se entienda por qué se salió.
   */
  protected readonly errores = signal<string[]>(
    this.ruta.snapshot.queryParamMap.get('sesion') === 'expirada' ? [SESION_EXPIRADA] : [],
  );

  protected readonly formulario = this.fb.nonNullable.group({
    identificador: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected get identificador() {
    return this.formulario.controls.identificador;
  }

  protected get password() {
    return this.formulario.controls.password;
  }

  protected enviar(): void {
    this.errores.set([]);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.auth.login(this.formulario.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/publicaciones']);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errores.set(mensajesDeError(error));
      },
    });
  }
}
