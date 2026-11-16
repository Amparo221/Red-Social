import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClicFueraDirective } from './clic-fuera.directive';

@Component({
  imports: [ClicFueraDirective],
  template: `
    <div class="panel" (appClicFuera)="cerrado = cerrado + 1" [cerrarConEscape]="escape()">
      <button type="button" class="dentro">Dentro</button>
    </div>
    <button type="button" class="fuera">Fuera</button>
  `,
})
class Anfitrion {
  cerrado = 0;
  readonly escape = signal(true);
}

describe('ClicFueraDirective', () => {
  let fixture: ComponentFixture<Anfitrion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  /** jsdom no siempre tiene PointerEvent: alcanza con un MouseEvent con ese tipo. */
  function presionar(selector: string): void {
    const destino = fixture.nativeElement.querySelector(selector) as HTMLElement;
    destino.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  }

  function presionarEscape(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  it('no emite cuando el click es dentro del elemento', () => {
    presionar('.dentro');

    expect(fixture.componentInstance.cerrado).toBe(0);
  });

  it('emite cuando el click es fuera', () => {
    presionar('.fuera');

    expect(fixture.componentInstance.cerrado).toBe(1);
  });

  it('Escape también cierra', () => {
    presionarEscape();

    expect(fixture.componentInstance.cerrado).toBe(1);
  });

  it('se puede apagar el cierre con Escape', () => {
    fixture.componentInstance.escape.set(false);
    fixture.detectChanges();

    presionarEscape();

    expect(fixture.componentInstance.cerrado).toBe(0);
  });

  it('deja de escuchar al destruirse', () => {
    fixture.destroy();

    presionarEscape();

    expect(fixture.componentInstance.cerrado).toBe(0);
  });
});
