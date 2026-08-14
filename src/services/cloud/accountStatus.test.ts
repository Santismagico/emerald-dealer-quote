import { describe, expect, it } from 'vitest';
import { isReadOnlyError, readDeviceId, READ_ONLY_MESSAGE } from './accountStatus';
import { rpcErrorInSpanish } from './auth';

function memoria(inicial: Record<string, string> = {}): Storage {
  const datos = new Map(Object.entries(inicial));
  return {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    getItem: (k: string) => datos.get(k) ?? null,
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => { datos.delete(k); },
    setItem: (k: string, v: string) => { datos.set(k, v); }
  } as Storage;
}

describe('identificador del equipo', () => {
  it('lo crea una sola vez y lo reutiliza', () => {
    const almacen = memoria();
    const primero = readDeviceId(almacen);
    expect(primero.length).toBeGreaterThanOrEqual(8);
    expect(readDeviceId(almacen)).toBe(primero);
  });

  it('cumple el límite que exige el servidor, entre 8 y 64 caracteres', () => {
    const id = readDeviceId(memoria());
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it('descarta un valor guardado que el servidor rechazaría', () => {
    // Si no se descartara, la cuenta quedaría sin registrar equipos en silencio.
    const almacen = memoria({ 'emerald-dealer-device-id': 'corto' });
    const id = readDeviceId(almacen);
    expect(id).not.toBe('corto');
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it('no se deriva del aparato: dos navegadores dan identificadores distintos', () => {
    // La política promete un identificador que no reconoce el equipo fuera de
    // esta cuenta. Si fuera derivado del hardware, sería lo contrario.
    expect(readDeviceId(memoria())).not.toBe(readDeviceId(memoria()));
  });
});

describe('mensaje de cuenta en solo lectura', () => {
  it('reconoce el rechazo del servidor', () => {
    expect(isReadOnlyError({ message: READ_ONLY_MESSAGE })).toBe(true);
    expect(isReadOnlyError({ message: 'otra cosa' })).toBe(false);
    expect(isReadOnlyError(null)).toBe(false);
  });

  it('no se confunde con el rechazo genérico de permisos, que comparte código', () => {
    // Los dos responden 42501: si se confundieran, al cliente moroso le diríamos
    // que no es el dueño de su propia joyería.
    const soloLectura = rpcErrorInSpanish({ code: '42501', message: READ_ONLY_MESSAGE });
    const noEsDueno = rpcErrorInSpanish({ code: '42501', message: 'only the owner can delete' });
    expect(soloLectura).toContain('solo lectura');
    expect(soloLectura).toContain('3105725618');
    expect(noEsDueno).toContain('dueño');
    expect(soloLectura).not.toBe(noEsDueno);
  });

  it('le dice al usuario que no pierde nada y cómo salir', () => {
    const mensaje = rpcErrorInSpanish({ code: '42501', message: READ_ONLY_MESSAGE });
    expect(mensaje).toContain('exportar');
    expect(mensaje).not.toMatch(/error|42501|exception/i);
  });
});
