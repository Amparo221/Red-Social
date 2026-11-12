import { TestBed } from '@angular/core/testing';
import { GraficoBarras } from './grafico-barras';

const FILAS = [
  {
    publicacionId: 'p-1',
    titulo: 'Colibrí garganta rubí',
    autor: 'anamoreno',
    eliminada: false,
    total: 4,
  },
  {
    publicacionId: 'p-2',
    titulo: 'Garza mora',
    autor: 'betoperez',
    eliminada: true,
    total: 1,
  },
];

describe('GraficoBarras', () => {
  beforeEach(() => {
    // jsdom no tiene canvas: se reemplaza la plantilla por el texto calculado.
    TestBed.overrideComponent(GraficoBarras, {
      set: { template: '<p>{{ total() }} · {{ descripcion() }}</p>' },
    });
  });

  it('suma los comentarios del ranking y lo describe', () => {
    const fixture = TestBed.createComponent(GraficoBarras);
    fixture.componentRef.setInput('filas', FILAS);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('5');
    expect(texto).toContain('Comentarios por publicación (5 en total)');
    expect(texto).toContain('Colibrí garganta rubí: 4');
    expect(texto).toContain('Garza mora: 1');
  });

  it('no rompe sin publicaciones', () => {
    const fixture = TestBed.createComponent(GraficoBarras);
    fixture.componentRef.setInput('filas', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Comentarios por publicación (0 en total)',
    );
  });
});
