import { getSupabase } from './config';

/**
 * Estado de la cuenta y registro del equipo.
 *
 * Las dos cosas que los términos `v1-2026-08-12` prometen y que el servidor ya
 * hace cumplir: el modo solo lectura del numeral 3 y el conteo de equipos de la
 * regla «una cuenta por joyería».
 *
 * Lo de aquí es **cortesía, no seguridad**: sirve para explicarle al usuario por
 * qué no puede guardar. Quien cambie estos valores en su navegador seguirá sin
 * poder escribir, porque el candado vive en la base de datos.
 */

export type AccountStatus = 'activa' | 'solo_lectura';

export interface AccountState {
  status: AccountStatus;
  /** Hasta cuándo está pagado, en formato YYYY-MM-DD. Null si nunca se registró. */
  paidThrough: string | null;
  readOnlySince: string | null;
}

const DEVICE_KEY = 'emerald-dealer-device-id';

/** Mensaje del servidor cuando la cuenta está en solo lectura. */
export const READ_ONLY_MESSAGE = 'organization is read only';

export function isReadOnlyError(error: { message?: string } | null | undefined): boolean {
  return typeof error?.message === 'string' && error.message.includes(READ_ONLY_MESSAGE);
}

/**
 * Identificador del equipo. Aleatorio y propio de este navegador: no se deriva
 * del aparato ni permite reconocerlo fuera de esta cuenta, que es exactamente
 * lo que promete la política de privacidad.
 */
export function readDeviceId(storage: Storage = localStorage): string {
  const guardado = storage.getItem(DEVICE_KEY);
  if (typeof guardado === 'string' && guardado.length >= 8 && guardado.length <= 64) {
    return guardado;
  }
  const nuevo =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  storage.setItem(DEVICE_KEY, nuevo);
  return nuevo;
}

/**
 * Deja constancia de que esta cuenta se usó desde este equipo. Si falla no
 * interrumpe nada: es un dato de control, no una condición para trabajar.
 */
export async function registerDevice(): Promise<void> {
  try {
    const client = await getSupabase();
    await client.rpc('touch_device', { p_device_id: readDeviceId() });
  } catch {
    // Silencio deliberado: que el registro de equipos falle jamás puede dejar a
    // una joyería sin poder usar su aplicación.
  }
}

/** Lee el estado de la propia cuenta. Ante cualquier duda, se asume activa. */
export async function readAccountState(): Promise<AccountState> {
  const activa: AccountState = { status: 'activa', paidThrough: null, readOnlySince: null };
  try {
    const client = await getSupabase();
    const { data, error } = await client
      .from('organization_billing')
      .select('status, paid_through, read_only_since')
      .maybeSingle();
    if (error || !data) return activa;
    const fila = data as Record<string, unknown>;
    return {
      status: fila.status === 'solo_lectura' ? 'solo_lectura' : 'activa',
      paidThrough: typeof fila.paid_through === 'string' ? fila.paid_through : null,
      readOnlySince: typeof fila.read_only_since === 'string' ? fila.read_only_since : null
    };
  } catch {
    return activa;
  }
}
