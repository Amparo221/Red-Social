import { TestBed } from '@angular/core/testing';
import { SesionTimerService } from '../../core/services/sesion-timer.service';
import { ModalSesion } from './modal-sesion';

/**
 * Doble del servicio de sesión: el modal sólo lee estado y delega clicks, así
 * que no hace falta un reloj real ni HTTP.
 */
function unTimer(
  opciones: { avisando?: boolean; segundos?: number; extendiendo?: boolean } = {},
) {
  return {
    avisando: () => opciones.avisando ?? true,
    segundosRestantes: () => opciones.segundos ?? 65,
    extendiendoSesion: () => opciones.extendiendo ?? false,
    extender: vi.fn(),
    salir: vi.fn(),
  };
}

function montar(falso: ReturnType<typeof unTimer>) {
  TestBed.configureTestingModule({
    imports: [ModalSesion],
    providers: [{ provide: SesionTimerService, useValue: falso as unknown as SesionTimerService }],
  });

  const fixture = TestBed.createComponent(ModalSesion);
  fixture.detectChanges();

  return { fixture, html: fixture.nativeElement as HTMLElement };
}

describe('ModalSesion', () => {
  it('no muestra nada mientras no corresponda avisar', () => {
    const { html } = montar(unTimer({ avisando: false }));

    expect(html.querySelector('.modal-sesion')).toBeNull();
  });

  it('muestra la cuenta regresiva en m:ss y los dos botones', () => {
    const { html } = montar(unTimer({ segundos: 65 }));

    const texto = html.textContent ?? '';
    expect(html.querySelector('.modal-sesion')).not.toBeNull();
    expect(texto).toContain('Tu sesión está por vencer');
    expect(html.querySelector('.modal-sesion__cuenta')?.textContent?.trim()).toBe('1:05');
    expect(texto).toContain('Cerrar sesión');
    expect(texto).toContain('Extender sesión');
  });

  it('extender delega en el servicio', () => {
    const falso = unTimer();
    const { html } = montar(falso);

    (html.querySelector('.boton--primario') as HTMLButtonElement).click();

    expect(falso.extender).toHaveBeenCalledTimes(1);
  });

  it('cerrar sesión delega en el servicio', () => {
    const falso = unTimer();
    const { html } = montar(falso);

    (html.querySelector('.boton--secundario') as HTMLButtonElement).click();

    expect(falso.salir).toHaveBeenCalledTimes(1);
  });

  it('deshabilita el botón de extender mientras se pide el token', () => {
    const { html } = montar(unTimer({ extendiendo: true }));

    const extender = html.querySelector('.boton--primario') as HTMLButtonElement;
    expect(extender.disabled).toBe(true);
    expect(extender.textContent?.trim()).toBe('Extendiendo…');
  });
});
