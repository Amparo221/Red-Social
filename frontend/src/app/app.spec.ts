import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('crea el shell de la app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  it('muestra la marca Purplegram y los accesos sin sesión', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compilado = fixture.nativeElement as HTMLElement;
    const texto = compilado.textContent ?? '';

    expect(texto).toContain('Purplegram');
    expect(texto).toContain('Ingresar');
    expect(texto).toContain('Crear cuenta');
  });
});
