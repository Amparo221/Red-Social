import { TestBed } from '@angular/core/testing';
import { GraficoLineas } from './grafico-lineas';

const SERIE = [
  {
    clave: '2026-11-01',
    etiqueta: '1 nov',
    desde: '2026-11-01T03:00:00.000Z',
    hasta: '2026-11-02T02:59:59.999Z',
    total: 0,
  },
  {
    clave: '2026-11-02',
    etiqueta: '2 nov',
    desde: '2026-11-02T03:00:00.000Z',
    hasta: '2026-11-03T02:59:59.999Z',
    total: 4,
  },
];

describe('GraficoLineas', () => {
  beforeEach(() => {
    // jsdom no tiene canvas: se reemplaza la plantilla por el texto calculado.
    TestBed.overrideComponent(GraficoLineas, {
      set: { template: '<p>{{ total() }} · {{ descripcion() }}</p>' },
    });
  });

  it('suma la serie y la describe para lectores de pantalla', () => {
    const fixture = TestBed.createComponent(GraficoLineas);
    fixture.componentRef.setInput('serie', SERIE);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('4');
    expect(texto).toContain('Comentarios en el tiempo (4 en total)');
    expect(texto).toContain('1 nov: 0');
    expect(texto).toContain('2 nov: 4');
  });

  it('no rompe con la serie vacía', () => {
    const fixture = TestBed.createComponent(GraficoLineas);
    fixture.componentRef.setInput('serie', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Comentarios en el tiempo (0 en total)',
    );
  });
});
