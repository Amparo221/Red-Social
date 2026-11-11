import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import type { Usuario } from '../../../../core/models/usuario.model';
import { FormularioUsuario } from './formulario-usuario';

const URL_USUARIOS = `${environment.apiUrl}/usuarios`;

const CREADO: Usuario = {
  id: 'u-9',
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1998-05-20',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'administrador',
  activo: true,
  fechaBaja: null,
};

const html = (fixture: ComponentFixture<FormularioUsuario>) =>
  fixture.nativeElement as HTMLElement;

/** Escribe en un campo como lo haría el usuario (input + event). */
const escribir = (
  fixture: ComponentFixture<FormularioUsuario>,
  selector: string,
  valor: string,
) => {
  const campo = html(fixture).querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
};

const enviar = (fixture: ComponentFixture<FormularioUsuario>) => {
  html(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
};

/** Completa el formulario con datos válidos. */
const completar = (fixture: ComponentFixture<FormularioUsuario>) => {
  escribir(fixture, '#nuevo-nombre', 'Ana');
  escribir(fixture, '#nuevo-apellido', 'Moreno');
  escribir(fixture, '#nuevo-correo', 'ana@correo.com');
  escribir(fixture, '#nuevo-nombre-usuario', 'anamoreno');
  escribir(fixture, '#nuevo-password', 'Segura123');
  escribir(fixture, '#nuevo-fecha', '1998-05-20');
  fixture.detectChanges();
};

describe('FormularioUsuario', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioUsuario],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('no llama al backend si faltan campos obligatorios', () => {
    const fixture = TestBed.createComponent(FormularioUsuario);
    fixture.detectChanges();

    enviar(fixture);
    fixture.detectChanges();

    http.expectNone(URL_USUARIOS);
    expect(html(fixture).textContent).toContain('Ingresá el nombre.');
    expect(html(fixture).textContent).toContain('Elegí un nombre de usuario.');
  });

  it('crea el usuario por multipart y emite la cuenta creada', () => {
    const fixture = TestBed.createComponent(FormularioUsuario);
    fixture.detectChanges();
    completar(fixture);

    let creada: Usuario | undefined;
    fixture.componentInstance.creada.subscribe((usuario) => (creada = usuario));

    enviar(fixture);

    const pedido = http.expectOne(URL_USUARIOS);
    expect(pedido.request.method).toBe('POST');
    const cuerpo = pedido.request.body as FormData;
    expect(cuerpo.get('nombre')).toBe('Ana');
    expect(cuerpo.get('correo')).toBe('ana@correo.com');
    expect(cuerpo.get('password')).toBe('Segura123');
    // Sin elegir nada, el perfil por defecto es usuario.
    expect(cuerpo.get('perfil')).toBe('usuario');

    pedido.flush(CREADO);
    fixture.detectChanges();

    expect(creada).toEqual(CREADO);
  });

  it('permite crear un administrador y manda la imagen elegida', () => {
    const fixture = TestBed.createComponent(FormularioUsuario);
    fixture.detectChanges();
    completar(fixture);

    const perfil = html(fixture).querySelector('#nuevo-perfil') as HTMLSelectElement;
    perfil.value = 'administrador';
    perfil.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const archivo = new File(['x'], 'foto.png', { type: 'image/png' });
    const input = html(fixture).querySelector('#nuevo-imagen') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [archivo] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    enviar(fixture);

    const pedido = http.expectOne(URL_USUARIOS);
    const cuerpo = pedido.request.body as FormData;
    expect(cuerpo.get('perfil')).toBe('administrador');
    expect(cuerpo.get('imagen')).toBe(archivo);

    pedido.flush(CREADO);
  });

  it('muestra el mensaje del backend si el correo ya existe (409)', () => {
    const fixture = TestBed.createComponent(FormularioUsuario);
    fixture.detectChanges();
    completar(fixture);

    enviar(fixture);

    http
      .expectOne(URL_USUARIOS)
      .flush(
        { statusCode: 409, message: 'El correo ya está registrado' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(html(fixture).textContent).toContain('El correo ya está registrado');
  });

  it('avisa en el navegador si la imagen no es válida', () => {
    const fixture = TestBed.createComponent(FormularioUsuario);
    fixture.detectChanges();

    const archivo = new File(['x'], 'notas.txt', { type: 'text/plain' });
    const input = html(fixture).querySelector('#nuevo-imagen') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [archivo] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(html(fixture).textContent).toContain('La imagen debe ser JPG, PNG, WEBP o GIF');
  });

  it('emite cancelar al cerrar el formulario', () => {
    const fixture = TestBed.createComponent(FormularioUsuario);
    fixture.detectChanges();

    let cancelado = false;
    fixture.componentInstance.cancelar.subscribe(() => (cancelado = true));

    const boton = Array.from(html(fixture).querySelectorAll('button')).find((candidato) =>
      candidato.textContent?.includes('Cancelar'),
    ) as HTMLButtonElement;
    boton.click();

    expect(cancelado).toBe(true);
  });
});
