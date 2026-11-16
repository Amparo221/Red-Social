import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CLAVE_SESION, AuthService } from '../services/auth.service';
import {
  PuedeModerarDirective,
  idDeAutor,
  puedeModerar,
  type ReferenciaAutor,
} from './puede-moderar.directive';

const ID_AUTOR = '507f1f77bcf86cd799439011';
const ID_ADMIN = '507f1f77bcf86cd799439012';
const ID_OTRO = '507f1f77bcf86cd799439013';

function unaSesion(id: string, perfil = 'usuario') {
  return {
    id,
    nombre: 'Ana',
    apellido: 'Moreno',
    correo: 'ana@correo.com',
    nombreUsuario: 'anamoreno',
    fechaNacimiento: '1995-04-12',
    descripcion: '',
    imagenPerfilUrl: '',
    perfil,
    token: 'token-de-prueba',
  };
}

/** Host mínimo: un bloque para "borrar" y otro restringido al autor. */
@Component({
  imports: [PuedeModerarDirective],
  template: `
    <p *appPuedeModerar="autor()" class="borrar">Eliminar</p>
    <p *appPuedeModerar="autor(); soloAutor: true" class="editar">Editar</p>
  `,
})
class Anfitrion {
  readonly autor = signal<ReferenciaAutor>(ID_AUTOR);
}

describe('puedeModerar', () => {
  it('sin sesión no se puede moderar nada', () => {
    expect(puedeModerar(ID_AUTOR, null)).toBe(false);
    expect(puedeModerar(null, null)).toBe(false);
  });

  it('el autor puede borrar y editar lo suyo', () => {
    const usuario = { id: ID_AUTOR, perfil: 'usuario' };

    expect(puedeModerar(ID_AUTOR, usuario)).toBe(true);
    expect(puedeModerar(ID_AUTOR, usuario, true)).toBe(true);
  });

  it('un usuario común no puede moderar contenido ajeno', () => {
    expect(puedeModerar(ID_OTRO, { id: ID_AUTOR, perfil: 'usuario' })).toBe(false);
  });

  it('el administrador modera todo menos lo que es sólo del autor', () => {
    const admin = { id: ID_ADMIN, perfil: 'administrador' };

    expect(puedeModerar(ID_OTRO, admin)).toBe(true);
    expect(puedeModerar(ID_OTRO, admin, true)).toBe(false);
  });
});

describe('idDeAutor', () => {
  it('acepta el id suelto y el autor populado', () => {
    expect(idDeAutor(ID_AUTOR)).toBe(ID_AUTOR);
    expect(idDeAutor({ id: ID_AUTOR })).toBe(ID_AUTOR);
  });

  it('devuelve null cuando no hay autor', () => {
    expect(idDeAutor(null)).toBeNull();
    expect(idDeAutor(undefined)).toBeNull();
  });
});

describe('PuedeModerarDirective', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let http: HttpTestingController;

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    http = TestBed.inject(HttpTestingController);
  }

  function texto(clase: string): string {
    return fixture.nativeElement.querySelector(`.${clase}`)?.textContent?.trim() ?? '';
  }

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    http?.verify();
    localStorage.clear();
  });

  it('sin sesión no muestra ningún bloque', async () => {
    await montar();
    fixture.detectChanges();

    expect(texto('borrar')).toBe('');
    expect(texto('editar')).toBe('');
  });

  it('con sesión de autor muestra los dos bloques', async () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion(ID_AUTOR)));
    await montar();
    fixture.detectChanges();

    expect(texto('borrar')).toBe('Eliminar');
    expect(texto('editar')).toBe('Editar');
  });

  it('un usuario común no ve los bloques de un contenido ajeno', async () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion(ID_OTRO)));
    await montar();
    fixture.detectChanges();

    expect(texto('borrar')).toBe('');
    expect(texto('editar')).toBe('');
  });

  it('el administrador ve el borrar pero no el editar (sólo autor)', async () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion(ID_ADMIN, 'administrador')));
    await montar();
    fixture.detectChanges();

    expect(texto('borrar')).toBe('Eliminar');
    expect(texto('editar')).toBe('');
  });

  it('reacciona al cambio de autor', async () => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(unaSesion(ID_AUTOR)));
    await montar();
    fixture.detectChanges();
    expect(texto('borrar')).toBe('Eliminar');

    fixture.componentInstance.autor.set(ID_OTRO);
    fixture.detectChanges();
    expect(texto('borrar')).toBe('');

    fixture.componentInstance.autor.set(ID_AUTOR);
    fixture.detectChanges();
    expect(texto('borrar')).toBe('Eliminar');
  });

  it('aparece al iniciar sesión y desaparece al cerrarla', async () => {
    await montar();
    fixture.detectChanges();
    expect(texto('borrar')).toBe('');

    TestBed.inject(AuthService)
      .login({ identificador: 'ana@correo.com', password: 'secreta' })
      .subscribe();
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(unaSesion(ID_AUTOR));
    fixture.detectChanges();
    expect(texto('borrar')).toBe('Eliminar');

    TestBed.inject(AuthService).cerrarSesion();
    fixture.detectChanges();
    expect(texto('borrar')).toBe('');
  });
});
