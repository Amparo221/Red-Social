import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import type { PublicacionesPorUsuario } from '../../../../core/models/estadisticas.model';
import { configuracionTorta } from '../../../../core/utils/grafico.util';

/**
 * Torta de publicaciones por usuario. Es un componente de presentación: no pide
 * datos, sólo dibuja lo que le pasa la pantalla de estadísticas.
 */
@Component({
  selector: 'app-grafico-torta',
  imports: [BaseChartDirective],
  templateUrl: './grafico-torta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoTorta {
  readonly filas = input.required<PublicacionesPorUsuario[]>();

  protected readonly configuracion = computed(() =>
    configuracionTorta(this.filas()),
  );

  protected readonly total = computed(() =>
    this.filas().reduce((suma, fila) => suma + fila.total, 0),
  );

  /** Texto para lectores de pantalla: el canvas no dice nada por sí solo. */
  protected readonly descripcion = computed(() => {
    const detalle = this.filas()
      .map((fila) => `@${fila.nombreUsuario}: ${fila.total}`)
      .join(', ');
    return `Publicaciones por usuario (${this.total()} en total). ${detalle}`;
  });
}
