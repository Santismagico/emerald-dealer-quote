import { describe, expect, it } from 'vitest';
import { assertImageFileSize, MAX_IMAGE_FILE_BYTES } from './images';

describe('límite de imágenes de referencia', () => {
  it('acepta hasta 1.5 MB y rechaza archivos más pesados con mensaje claro', () => {
    expect(() => assertImageFileSize({ size: MAX_IMAGE_FILE_BYTES })).not.toThrow();
    expect(() => assertImageFileSize({ size: MAX_IMAGE_FILE_BYTES + 1 })).toThrow(
      'La imagen es muy pesada'
    );
  });
});
