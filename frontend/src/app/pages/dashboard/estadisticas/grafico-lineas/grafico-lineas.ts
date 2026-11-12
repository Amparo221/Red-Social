import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import type { ComentariosPorPeriodo } from '../../../../core/models/estadisticas.model';
import { configuracionLinea } from '../../../../core/utils/grafico.util';

/**
 * Serie temporal de comentarios. Chart.js recibe la serie completa (con los
 * períodos sin actividad en 0) para que la línea no saltee días.
 */
@Component({
  selector: 'app-grafico-lineas',
  imports: [BaseChartDirective],
  templateUrl: './grafico-lineas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoLineas {
  readonly serie = input.required<ComentariosPorPeriodo[]>();

  protected readonly configuracion = computed(() =>
    configuracionLinea(this.serie()),
  );

  protected readonly total = computed(() =>
    this.serie().reduce((suma, punto) => suma + punto.total, 0),
  );

  /** Texto para lectores de pantalla: el canvas no dice nada por sí solo. */
  protected readonly descripcion = computed(() => {
    const detalle = this.serie()
      .map((punto) => `${punto.etiqueta}: ${punto.total}`)
      .join(', ');
    return `Comentarios en el tiempo (${this.total()} en total). ${detalle}`;
  });
}
