import { describe, expect, it } from 'vitest';
import type { StoreDataSource } from './services/dataSource';
import { selectStoreDataSource } from './store';

describe('selector de fuente de datos', () => {
  const local = { name: 'local' } as unknown as StoreDataSource;
  const cloud = { name: 'cloud' } as unknown as StoreDataSource;

  it('mantiene almacenamiento local si la nube no está configurada', () => {
    expect(selectStoreDataSource({ hasSession: true, cloudConfigured: false, local, cloud })).toBe(local);
  });

  it('mantiene almacenamiento local si no hay sesión', () => {
    expect(selectStoreDataSource({ hasSession: false, cloudConfigured: true, local, cloud })).toBe(local);
  });

  it('usa nube solo cuando hay configuración y sesión', () => {
    expect(selectStoreDataSource({ hasSession: true, cloudConfigured: true, local, cloud })).toBe(cloud);
  });
});
