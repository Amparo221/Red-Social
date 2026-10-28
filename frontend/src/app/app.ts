import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { urlAvatar } from './core/models/usuario.model';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // El avatar puede venir vacío si el backend no encontró la imagen subida.
  protected readonly avatar = (): string => urlAvatar(this.auth.usuarioActual());

  protected salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigate(['/login']);
  }
}
