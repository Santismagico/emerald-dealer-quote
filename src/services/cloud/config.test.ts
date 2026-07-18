import { describe, expect, it } from 'vitest';
import { cloudEnabled, readCloudConfig } from './config';

describe('bandera de nube', () => {
  it('mantiene el modo local si falta cualquiera de las dos variables', () => {
    expect(cloudEnabled({})).toBe(false);
    expect(cloudEnabled({ VITE_SUPABASE_URL: 'https://ejemplo.supabase.co' })).toBe(false);
    expect(cloudEnabled({ VITE_SUPABASE_ANON_KEY: 'clave-publicable' })).toBe(false);
  });

  it('activa la nube solo con URL y clave publicable presentes', () => {
    const env = {
      VITE_SUPABASE_URL: ' https://ejemplo.supabase.co ',
      VITE_SUPABASE_ANON_KEY: ' clave-publicable '
    };
    expect(cloudEnabled(env)).toBe(true);
    expect(readCloudConfig(env)).toEqual({
      url: 'https://ejemplo.supabase.co',
      key: 'clave-publicable'
    });
  });
});
