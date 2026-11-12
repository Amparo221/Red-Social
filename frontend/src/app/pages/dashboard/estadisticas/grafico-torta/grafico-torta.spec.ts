import { TestBed } from '@angular/core/testing';
import { GraficoTorta } from './grafico-torta';

const FILAS = [
  { usuarioId: 'u-1', nombre: 'Ana Moreno', nombreUsuario: 'anamoreno', total: 3 },
  { usuarioId: 'u-2', nombre: 'Beto Pérez', nombreUsuario: 'betoperez', total: 2 },
];

describe('GraficoTorta', () => {
  beforeEach(() => {
    // jsdom no tiene canvas: se reemplaza la plantilla por el texto calculado.
    TestBed.overrideComponent(GraficoTorta, {
      set: { template: '<p>{{ total() }} · {{ descripcion() }}</p>' },
    });
  });

  it('suma el total y describe la torta para lectores de pantalla', () => {
    const fixture = TestBed.createComponent(GraficoTorta);
    fixture.componentRef.setInput('filas', FILAS);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('5');
    expect(texto).toContain('Publicaciones por usuario (5 en total)');
    expect(texto).toContain('@anamoreno: 3');
    expect(texto).toContain('@betoperez: 2');
  });

  it('no rompe sin filas', () => {
    const fixture = TestBed.createComponent(GraficoTorta);
    fixture.componentRef.setInput('filas', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('0');
  });
});
