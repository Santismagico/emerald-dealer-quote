import { describe, expect, it } from 'vitest';
import { assertImageFileSize, MAX_SOURCE_IMAGE_BYTES } from './images';

describe('límite de imágenes de referencia (D-034)', () => {
  it('acepta fotos típicas de teléfono (3–8 MB): la app las comprime después', () => {
    expect(() => assertImageFileSize({ size: 3 * 1024 * 1024 })).not.toThrow();
    expect(() => assertImageFileSize({ size: 8 * 1024 * 1024 })).not.toThrow();
    expect(() => assertImageFileSize({ size: MAX_SOURCE_IMAGE_BYTES })).not.toThrow();
  });

  it('rechaza archivos absurdamente grandes con mensaje claro', () => {
    expect(() => assertImageFileSize({ size: MAX_SOURCE_IMAGE_BYTES + 1 })).toThrow(
      'La imagen es muy pesada'
    );
  });
});
