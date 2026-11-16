import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { provideCharts } from 'ng2-charts';
import {
  AGRUPACIONES,
  ESTADISTICAS_LIMITE,
  PRESETS_RANGO,
  RANGO_MAXIMO_DIAS,
  RANGO_POR_DEFECTO,
  agrupacionSugerida,
  diaLocal,
  diasDelRango,
  etiquetaDeAgrupacion,
  rangoDePreset,
  textoDelRango,
  type Agrupacion,
  type ComentariosPorPeriodo,
  type ComentariosPorPublicacion,
  type EstadisticasResponse,
  type PresetRango,
  type PublicacionesPorUsuario,
  type TotalesEstadisticas,
} from '../../../core/models/estadisticas.model';
import { NumeroPipe } from '../../../core/pipes/numero.pipe';
import { EstadisticasService } from '../../../core/services/estadisticas.service';
import { mensajesDeError } from '../../../core/utils/error-http.util';
import { GraficoBarras } from './grafico-barras/grafico-barras';
import { GraficoLineas } from './grafico-lineas/grafico-lineas';
import { GraficoTorta } from './grafico-torta/grafico-torta';
import { GRAFICOS_USADOS } from './graficos';

const TOTALES_VACIOS: TotalesEstadisticas = {
  publicaciones: 0,
  usuariosConPublicaciones: 0,
  comentarios: 0,
  publicacionesConComentarios: 0,
};

/**
 * Dashboard de estadísticas (Sprint 5). Sólo entra un administrador (lo
 * garantizan `adminGuard` en el router y `RolesGuard` en el backend).
 *
 * La pantalla es la dueña del rango y de la granularidad; los tres gráficos son
 * hijos "tontos" que reciben las filas ya calculadas. Toda la matemática de
 * Chart.js vive en `core/utils/grafico.util.ts` para poder testearla sin canvas.
 *
 * Sprint 6: Chart.js se registra acá (y no en `app.config.ts`) para que quede en
 * el chunk diferido de esta pantalla, que sólo abre un administrador.
 */
@Component({
  selector: 'app-estadisticas',
  imports: [GraficoTorta, GraficoLineas, GraficoBarras, NumeroPipe],
  providers: [provideCharts({ registerables: GRAFICOS_USADOS })],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css',
})
export class Estadisticas implements OnInit {
  private readonly estadisticasService = inject(EstadisticasService);

  protected readonly presets = PRESETS_RANGO;
  protected readonly agrupaciones = AGRUPACIONES;
  protected readonly limite = ESTADISTICAS_LIMITE;
  /** Tope de los `<input type="date">`: no se pueden pedir días futuros. */
  protected readonly hoy = diaLocal();

  private readonly rangoInicial = rangoDePreset(RANGO_POR_DEFECTO) ?? {
    desde: diaLocal(),
    hasta: diaLocal(),
  };

  protected readonly preset = signal<PresetRango>(RANGO_POR_DEFECTO);
  protected readonly desde = signal(this.rangoInicial.desde);
  protected readonly hasta = signal(this.rangoInicial.hasta);
  protected readonly agrupacion = signal<Agrupacion>(
    agrupacionSugerida(this.rangoInicial.desde, this.rangoInicial.hasta),
  );

  protected readonly cargando = signal(true);
  protected readonly errores = signal<string[]>([]);
  protected readonly datos = signal<EstadisticasResponse | null>(null);

  /** Identificador del último pedido: descarta respuestas viejas. */
  private ultimoPedido = 0;

  protected readonly totales = computed<TotalesEstadisticas>(
    () => this.datos()?.totales ?? TOTALES_VACIOS,
  );
  protected readonly publicacionesPorUsuario = computed<PublicacionesPorUsuario[]>(
    () => this.datos()?.publicacionesPorUsuario ?? [],
  );
  protected readonly comentariosPorPeriodo = computed<ComentariosPorPeriodo[]>(
    () => this.datos()?.comentariosPorPeriodo ?? [],
  );
  protected readonly comentariosPorPublicacion = computed<ComentariosPorPublicacion[]>(
    () => this.datos()?.comentariosPorPublicacion ?? [],
  );

  protected readonly textoRango = computed(() =>
    textoDelRango(this.desde(), this.hasta()),
  );
  /** "por día" / "por semana" / "por mes", para la bajada del gráfico. */
  protected readonly textoAgrupacion = computed(() =>
    etiquetaDeAgrupacion(this.agrupacion()).toLowerCase(),
  );
  /** Los gráficos muestran su estado vacío recién cuando terminó la carga. */
  protected readonly sinPublicaciones = computed(
    () => !this.cargando() && this.publicacionesPorUsuario().length === 0,
  );
  protected readonly sinComentarios = computed(
    () =>
      !this.cargando() &&
      this.comentariosPorPeriodo().every((punto) => punto.total === 0),
  );
  protected readonly sinComentariosPorPublicacion = computed(
    () => !this.cargando() && this.comentariosPorPublicacion().length === 0,
  );

  ngOnInit(): void {
    this.cargar();
  }

  // ---------- rango y granularidad ----------

  /**
   * Los presets recalculan las fechas y la granularidad; `personalizado` no
   * hace nada porque son justamente las fechas que eligió el usuario.
   */
  protected elegirPreset(preset: PresetRango): void {
    this.preset.set(preset);

    const rango = rangoDePreset(preset);
    if (!rango) {
      return;
    }

    this.desde.set(rango.desde);
    this.hasta.set(rango.hasta);
    this.agrupacion.set(agrupacionSugerida(rango.desde, rango.hasta));
    this.cargar();
  }

  protected alCambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
    this.preset.set('personalizado');
  }

  protected alCambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
    this.preset.set('personalizado');
  }

  protected alCambiarAgrupacion(evento: Event): void {
    this.agrupacion.set(
      (evento.target as HTMLSelectElement).value as Agrupacion,
    );
    this.cargar();
  }

  protected actualizar(): void {
    this.cargar();
  }

  protected esPreset(preset: PresetRango): boolean {
    return this.preset() === preset;
  }

  // ---------- carga ----------

  /**
   * Valida el rango en el navegador para no ir y volver por un 400: el backend
   * aplica las mismas reglas (y es el que manda si algo se escapa).
   */
  protected cargar(): void {
    const desde = this.desde();
    const hasta = this.hasta();

    if (!desde || !hasta) {
      this.errores.set(['Elegí las dos fechas del rango.']);
      return;
    }

    const dias = diasDelRango(desde, hasta);
    if (dias < 1) {
      this.errores.set(['La fecha "Hasta" no puede ser anterior a "Desde".']);
      return;
    }
    if (dias > RANGO_MAXIMO_DIAS) {
      this.errores.set([
        `El rango no puede superar los ${RANGO_MAXIMO_DIAS} días.`,
      ]);
      return;
    }

    const pedido = ++this.ultimoPedido;
    this.cargando.set(true);
    this.errores.set([]);

    this.estadisticasService
      .consultar({
        desde,
        hasta,
        agrupacion: this.agrupacion(),
        limite: this.limite,
      })
      .subscribe({
        next: (datos) => {
          // Si mientras tanto se pidió otro rango, esta respuesta ya no sirve.
          if (pedido !== this.ultimoPedido) {
            return;
          }
          this.datos.set(datos);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          if (pedido !== this.ultimoPedido) {
            return;
          }
          this.datos.set(null);
          this.errores.set(mensajesDeError(error, 'sesion'));
          this.cargando.set(false);
        },
      });
  }

  protected reintentar(): void {
    this.cargar();
  }
}

