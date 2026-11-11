import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Inicio } from './inicio';
import { AuthService } from '../../core/services/auth.service';
import { PublicacionesService } from '../../core/services/publicaciones.service';
import type { Publicacion } from '../../core/models/publicacion.model';

const USUARIO = {
  id: '123',
  nombre: 'Ana',
  apellido: 'Pérez',
  nombreUsuario: 'anaperez',
  correo: 'ana@ejemplo.com',
  perfil: 'usuario',
  imagenPerfilUrl: '',
};

const PUBLICACIONES: Publicacion[] = [
  {
    id: 'p1',
    titulo: 'Tordo músico',
    descripcion: 'Cantando en el paraíso',
    nombreComun: 'Tordo músico',
    nombreCientifico: 'Agelaioides badius',
    imagenUrl: 'https://res.cloudinary.com/demo/red-social/publicaciones/tordo.jpg',
    usuario: { id: '123', nombre: 'Ana', apellido: 'Pérez', nombreUsuario: 'anaperez', imagenPerfilUrl: '' },
    cantidadLikes: 3,
    likeado: false,
    eliminado: false,
    createdAt: '2026-10-30T12:00:00.000Z',
    updatedAt: '2026-10-30T12:00:00.000Z',
  },
];

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;
  let componente: Inicio;
  let auth: { usuarioActual: ReturnType<typeof signal> };
  let publicaciones: {
    listar: ReturnType<typeof vi.fn>;
    darLike: ReturnType<typeof vi.fn>;
    quitarLike: ReturnType<typeof vi.fn>;
    eliminar: ReturnType<typeof vi.fn>;
    listarComentarios: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = { usuarioActual: signal(USUARIO) };
    publicaciones = {
      listar: vi.fn(),
      darLike: vi.fn(),
      quitarLike: vi.fn(),
      eliminar: vi.fn(),
      // El perfil monta <app-comentarios> por cada publicación (Sprint 4).
      listarComentarios: vi.fn(() =>
        of({ total: 0, offset: 0, limit: 3, hayMas: false, comentarios: [] }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: PublicacionesService, useValue: publicaciones },
      ],
    });

    fixture = TestBed.createComponent(Inicio);
    componente = fixture.componentInstance;
  });

  it('pide las últimas 3 publicaciones del usuario logueado al iniciar', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 1,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: PUBLICACIONES,
    }));

    fixture.detectChanges();

    expect(publicaciones.listar).toHaveBeenCalledWith({
      offset: 0,
      limit: 3,
      orden: 'fecha',
      usuario: '123',
    });
    expect(componente.misPublicaciones()).toEqual(PUBLICACIONES);
    expect(componente.cargandoMisPublicaciones()).toBe(false);
  });

  it('muestra estado vacío cuando el usuario no tiene publicaciones', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 0,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: [],
    }));

    fixture.detectChanges();

    expect(componente.misPublicaciones().length).toBe(0);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent?.includes('Todavía no publicaste nada')).toBe(true);
  });

  it('alternarLike invoca darLike cuando no estaba likeada', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 0,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: [],
    }));
    publicaciones.darLike.mockReturnValue(of({ id: 'p1', cantidadLikes: 1, likeado: true }));

    fixture.detectChanges();
    componente.alternarLike({ ...PUBLICACIONES[0], likeado: false });

    expect(publicaciones.darLike).toHaveBeenCalledWith('p1');
  });

  it('alternarLike invoca quitarLike cuando ya estaba likeada', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 0,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: [],
    }));
    publicaciones.quitarLike.mockReturnValue(of({ id: 'p1', cantidadLikes: 2, likeado: false }));

    fixture.detectChanges();
    componente.alternarLike({ ...PUBLICACIONES[0], likeado: true });

    expect(publicaciones.quitarLike).toHaveBeenCalledWith('p1');
  });

  it('eliminarMis invoca eliminar y quita la publicación de la lista', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 1,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: PUBLICACIONES,
    }));
    publicaciones.eliminar.mockReturnValue(of({ id: 'p1', eliminado: true }));

    fixture.detectChanges();
    componente.eliminarMis(PUBLICACIONES[0]);

    expect(publicaciones.eliminar).toHaveBeenCalledWith('p1');
    expect(componente.misPublicaciones().length).toBe(0);
  });

  it('abre el detalle al clickear una publicación del perfil', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 1,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: PUBLICACIONES,
    }));

    fixture.detectChanges();

    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const html = fixture.nativeElement as HTMLElement;

    (html.querySelector('.publicacion__texto') as HTMLElement).click();

    expect(navegar).toHaveBeenCalledWith(['/publicaciones', 'p1']);
  });

  it('muestra los comentarios de cada publicación del perfil en sólo lectura', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 1,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: PUBLICACIONES,
    }));

    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const item = html.querySelector('.mis-publicaciones__item');

    // Sprint 4: el perfil delega la lista en el componente compartido y la
    // proyecta DENTRO de la tarjeta (ng-content), sin recuadro propio.
    const tarjeta = item?.querySelector('app-publicacion-card');
    const comentarios = tarjeta?.querySelector('app-comentarios');
    expect(comentarios).not.toBeNull();
    expect(comentarios?.querySelector('.comentarios--embebido')).not.toBeNull();
    expect(publicaciones.listarComentarios).toHaveBeenCalledWith('p1', {
      offset: 0,
      limit: 3,
    });
    // Sólo lectura: desde el perfil no se comenta ni se edita.
    expect(item?.querySelector('.comentarios__form')).toBeNull();
  });

  it('no repite el botón de cerrar sesión (vive en el header)', () => {
    publicaciones.listar.mockReturnValue(of({
      total: 0,
      offset: 0,
      limit: 3,
      orden: 'fecha',
      hayMas: false,
      publicaciones: [],
    }));

    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent?.includes('Cerrar sesión')).toBe(false);
    // La sección no es una tarjeta anidada: el contador de publicaciones tampoco está.
    expect(html.querySelector('.mis-publicaciones')?.classList.contains('tarjeta')).toBe(false);
  });
});
