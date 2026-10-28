import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { mensajesDeError } from '../../core/utils/error-http.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly enviando = signal(false);
  protected readonly errores = signal<string[]>([]);

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
        void this.router.navigate(['/inicio']);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errores.set(mensajesDeError(error));
      },
    });
  }
}
