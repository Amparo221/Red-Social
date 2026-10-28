import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { urlAvatar } from '../../core/models/usuario.model';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly usuario = this.auth.usuarioActual;
  protected readonly avatar = computed(() => urlAvatar(this.usuario()));

  /** Se muestra el saludo de bienvenida sólo al volver del registro. */
  protected readonly recienRegistrado = this.ruta.snapshot.queryParamMap.has('bienvenida');

  protected readonly fechaNacimiento = computed(() => this.formatearFecha(this.usuario()?.fechaNacimiento));
  protected readonly miembroDesde = computed(() => this.formatearFecha(this.usuario()?.createdAt));

  protected salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigate(['/login']);
  }

  /** `fechaNacimiento` es 'AAAA-MM-DD': se muestra como texto legible. */
  private formatearFecha(valor: string | undefined): string {
    if (!valor) {
      return '';
    }

    // Se le agrega la hora para que el navegador no corra un día por la zona horaria.
    const fecha = new Date(valor.includes('T') ? valor : `${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime())
      ? valor
      : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
