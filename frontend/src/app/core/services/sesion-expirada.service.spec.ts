import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DEMORA_REDIRECCION_MS, SesionExpiradaService } from './sesion-expirada.service';

describe('SesionExpiradaService', () => {
  let aviso: SesionExpiradaService;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    aviso = TestBed.inject(SesionExpiradaService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arranca sin aviso y sin navegar', () => {
    expect(aviso.avisando()).toBe(false);
    expect(aviso.motivoActual()).toBeNull();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('avisar muestra el 401, cuenta los 2 s y recién ahí va al login', () => {
    aviso.avisar('expirada');

    expect(aviso.avisando()).toBe(true);
    expect(aviso.motivoActual()).toBe('expirada');
    expect(aviso.segundosRestantes()).toBe(DEMORA_REDIRECCION_MS / 1000);
    expect(navegar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(aviso.segundosRestantes()).toBe(1);
    expect(navegar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { sesion: 'expirada' } });
    // El cartel se cierra para no reaparecer encima del login.
    expect(aviso.avisando()).toBe(false);
  });

  it('varias respuestas 401 a la vez producen un solo aviso y una sola navegación', () => {
    aviso.avisar('expirada');
    aviso.avisar('expirada');
    aviso.avisar('deshabilitada');

    // Gana el primer motivo: el segundo 401 es el mismo problema.
    expect(aviso.motivoActual()).toBe('expirada');

    vi.advanceTimersByTime(DEMORA_REDIRECCION_MS * 3);

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { sesion: 'expirada' } });
  });

  it('"ir al login ahora" no espera los 2 s', () => {
    aviso.avisar('deshabilitada');

    aviso.irAhora();

    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { sesion: 'deshabilitada' } });
    expect(aviso.avisando()).toBe(false);

    // El temporizador cancelado no vuelve a navegar.
    vi.advanceTimersByTime(DEMORA_REDIRECCION_MS);
    expect(navegar).toHaveBeenCalledTimes(1);
  });

  it('sin aviso, "ir al login ahora" no hace nada', () => {
    aviso.irAhora();

    expect(navegar).not.toHaveBeenCalled();
  });

  it('después de navegar puede volver a avisar (otra sesión que también vence)', () => {
    aviso.avisar('expirada');
    vi.advanceTimersByTime(DEMORA_REDIRECCION_MS);

    aviso.avisar('deshabilitada');
    expect(aviso.avisando()).toBe(true);
    expect(aviso.segundosRestantes()).toBe(DEMORA_REDIRECCION_MS / 1000);

    vi.advanceTimersByTime(DEMORA_REDIRECCION_MS);
    expect(navegar).toHaveBeenLastCalledWith(['/login'], { queryParams: { sesion: 'deshabilitada' } });
  });
});
