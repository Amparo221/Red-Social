import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OcupadoDirective } from './ocupado.directive';

@Component({
  imports: [OcupadoDirective],
  template: `<button type="button" class="guardar" [appOcupado]="ocupado()">Guardar</button>`,
})
class Anfitrion {
  readonly ocupado = signal(false);
}

describe('OcupadoDirective', () => {
  let fixture: ComponentFixture<Anfitrion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  function boton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.guardar') as HTMLButtonElement;
  }

  it('deja el control habilitado cuando no hay nada en curso', () => {
    expect(boton().disabled).toBe(false);
    expect(boton().getAttribute('aria-busy')).toBeNull();
  });

  it('deshabilita y marca aria-busy mientras la operación está en vuelo', () => {
    fixture.componentInstance.ocupado.set(true);
    fixture.detectChanges();

    expect(boton().disabled).toBe(true);
    expect(boton().getAttribute('aria-busy')).toBe('true');
  });

  it('vuelve a habilitarlo cuando termina', () => {
    fixture.componentInstance.ocupado.set(true);
    fixture.detectChanges();

    fixture.componentInstance.ocupado.set(false);
    fixture.detectChanges();

    expect(boton().disabled).toBe(false);
    expect(boton().getAttribute('aria-busy')).toBeNull();
  });
});
