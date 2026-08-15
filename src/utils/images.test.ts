import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertImageFileSize, fileToCompressedDataUrl, MAX_SOURCE_IMAGE_BYTES } from './images';

afterEach(() => vi.unstubAllGlobals());

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

describe('compresión configurable', () => {
  it('conserva exactamente el camino anterior cuando no recibe opciones', async () => {
    const toDataURL = vi.fn(function (this: { canvas: { width: number; height: number } }) {
      return `data:image/jpeg;base64,${this.canvas.width}x${this.canvas.height}`;
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        canvas,
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        toDataURL
      }),
      toDataURL() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      }
    };
    class FakeImage {
      naturalWidth = 2000;
      naturalHeight = 1000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    }
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('document', { createElement: () => canvas });
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:foto',
      revokeObjectURL: vi.fn()
    });
    const file = { size: 100 } as File;

    await expect(fileToCompressedDataUrl(file)).resolves.toBe(
      await fileToCompressedDataUrl(file, { maxDimension: 1000 })
    );
  });
});
