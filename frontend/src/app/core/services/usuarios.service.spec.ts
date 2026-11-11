import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { ListadoUsuarios, Usuario } from '../models/usuario.model';
import { UsuariosService } from './usuarios.service';

const URL_USUARIOS = `${environment.apiUrl}/usuarios`;

const USUARIO: Usuario = {
  id: '507f1f77bcf86cd799439011',
  nombre: 'Ana',
  apellido: 'Moreno',
  correo: 'ana@correo.com',
  nombreUsuario: 'anamoreno',
  fechaNacimiento: '1998-05-20',
  descripcion: '',
  imagenPerfilUrl: '',
  perfil: 'usuario',
  activo: true,
  fechaBaja: null,
};

const LISTADO: ListadoUsuarios = {
  total: 1,
  offset: 0,
  limit: 10,
  hayMas: false,
  usuarios: [USUARIO],
};

describe('UsuariosService', () => {
  let servicio: UsuariosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(UsuariosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista con offset/limit por defecto y manda los filtros cargados', () => {
    let respuesta: ListadoUsuarios | undefined;

    servicio
      .listar({ busqueda: '  ana  ', estado: 'deshabilitados', perfil: 'administrador' })
      .subscribe((listado) => (respuesta = listado));

    const pedido = http.expectOne((req) => req.url === URL_USUARIOS);
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.params.get('offset')).toBe('0');
    expect(pedido.request.params.get('limit')).toBe('10');
    // La búsqueda se recorta y los vacíos no se mandan.
    expect(pedido.request.params.get('busqueda')).toBe('ana');
    expect(pedido.request.params.get('estado')).toBe('deshabilitados');
    expect(pedido.request.params.get('perfil')).toBe('administrador');

    pedido.flush(LISTADO);

    expect(respuesta).toEqual(LISTADO);
  });

  it('no manda estado, perfil ni búsqueda vacíos', () => {
    servicio.listar({ busqueda: '   ' }).subscribe();

    const pedido = http.expectOne((req) => req.url === URL_USUARIOS);
    expect(pedido.request.params.has('busqueda')).toBe(false);
    expect(pedido.request.params.has('estado')).toBe(false);
    expect(pedido.request.params.has('perfil')).toBe(false);

    pedido.flush(LISTADO);
  });

  it('crea el usuario con multipart (incluido el perfil y la imagen)', () => {
    const archivo = new File(['x'], 'foto.png', { type: 'image/png' });
    let respuesta: Usuario | undefined;

    servicio
      .crear(
        {
          nombre: ' Ana ',
          apellido: 'Moreno',
          correo: 'ana@correo.com',
          nombreUsuario: 'anamoreno',
          password: 'Segura123',
          fechaNacimiento: '1998-05-20',
          descripcion: '  Hola  ',
          perfil: 'administrador',
        },
        archivo,
      )
      .subscribe((usuario) => (respuesta = usuario));

    const pedido = http.expectOne(URL_USUARIOS);
    expect(pedido.request.method).toBe('POST');

    const cuerpo = pedido.request.body as FormData;
    expect(cuerpo.get('nombre')).toBe('Ana');
    expect(cuerpo.get('descripcion')).toBe('Hola');
    expect(cuerpo.get('perfil')).toBe('administrador');
    expect(cuerpo.get('imagen')).toBe(archivo);
    expect(pedido.request.headers.has('Content-Type')).toBe(false);

    pedido.flush(USUARIO);

    expect(respuesta).toEqual(USUARIO);
  });

  it('no manda perfil ni imagen cuando no vienen', () => {
    servicio
      .crear({
        nombre: 'Ana',
        apellido: 'Moreno',
        correo: 'ana@correo.com',
        nombreUsuario: 'anamoreno',
        password: 'Segura123',
        fechaNacimiento: '1998-05-20',
      })
      .subscribe();

    const pedido = http.expectOne(URL_USUARIOS);
    const cuerpo = pedido.request.body as FormData;
    expect(cuerpo.has('perfil')).toBe(false);
    expect(cuerpo.has('imagen')).toBe(false);
    expect(cuerpo.has('descripcion')).toBe(false);

    pedido.flush(USUARIO);
  });

  it('deshabilita con DELETE /usuarios/:id', () => {
    servicio.deshabilitar(USUARIO.id).subscribe();

    const pedido = http.expectOne(`${URL_USUARIOS}/${USUARIO.id}`);
    expect(pedido.request.method).toBe('DELETE');

    pedido.flush({ id: USUARIO.id, activo: false, fechaBaja: '2026-11-11T00:00:00.000Z' });
  });

  it('cambia el estado con PATCH /usuarios/:id/estado', () => {
    servicio.cambiarEstado(USUARIO.id, true).subscribe();

    const pedido = http.expectOne(`${URL_USUARIOS}/${USUARIO.id}/estado`);
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ activo: true });

    pedido.flush({ id: USUARIO.id, activo: true, fechaBaja: null });
  });
});
