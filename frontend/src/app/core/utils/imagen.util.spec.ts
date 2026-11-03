import { TAMANIO_MAXIMO_IMAGEN, validarImagen } from './imagen.util';

describe('validarImagen', () => {
  it('acepta JPG, PNG, WEBP y GIF dentro del límite', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validarImagen({ type, size: 1024 })).toBeNull();
    }
  });

  it('rechaza otros formatos', () => {
    expect(validarImagen({ type: 'application/pdf', size: 1024 })).toBe(
      'La imagen debe ser JPG, PNG, WEBP o GIF.',
    );
  });

  it('rechaza archivos de más de 5 MB', () => {
    expect(validarImagen({ type: 'image/png', size: TAMANIO_MAXIMO_IMAGEN + 1 })).toBe(
      'La imagen no puede superar los 5 MB.',
    );
  });

  it('acepta justo el límite de 5 MB', () => {
    expect(validarImagen({ type: 'image/png', size: TAMANIO_MAXIMO_IMAGEN })).toBeNull();
  });
});
