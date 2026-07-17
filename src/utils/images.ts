// Compresión de imágenes en el navegador antes de guardarlas en IndexedDB.
// Se reducen a un tamaño razonable para no agotar el almacenamiento local.

const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.72;

/**
 * Guardia de memoria ANTES de procesar: las fotos de un teléfono pesan 3–8 MB
 * y son válidas (la app las comprime igual); solo se rechaza un archivo
 * absurdamente grande que podría agotar la memoria del navegador (D-034).
 */
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;

/** Límite de lo que se GUARDA: el resultado ya comprimido (D-034). */
export const MAX_IMAGE_FILE_BYTES = 1_500_000;

export function assertImageFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('La imagen es muy pesada. Elige un archivo de máximo 25 MB.');
  }
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  assertImageFileSize(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (dataUrl.length > MAX_IMAGE_FILE_BYTES) {
      throw new Error('La imagen no se pudo reducir lo suficiente. Prueba con otra.');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
    img.src = src;
  });
}
