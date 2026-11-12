import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import type { ComentariosPorPublicacion } from '../../../../core/models/estadisticas.model';
import { configuracionBarras } from '../../../../core/utils/grafico.util';

/**
 * Ranking de publicaciones por cantidad de comentarios. Las barras van
 * horizontales porque los títulos son largos.
 */
@Component({
  selector: 'app-grafico-barras',
  imports: [BaseChartDirective],
  templateUrl: './grafico-barras.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoBarras {
  readonly filas = input.required<ComentariosPorPublicacion[]>();

  protected readonly configuracion = computed(() =>
    configuracionBarras(this.filas()),
  );

  protected readonly total = computed(() =>
    this.filas().reduce((suma, fila) => suma + fila.total, 0),
  );

  /** Texto para lectores de pantalla: el canvas no dice nada por sí solo. */
  protected readonly descripcion = computed(() => {
    const detalle = this.filas()
      .map((fila) => `${fila.titulo}: ${fila.total}`)
      .join(', ');
    return `Comentarios por publicación (${this.total()} en total). ${detalle}`;
  });
}
