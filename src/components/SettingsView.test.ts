import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BACKUP_RESTORE_WARNING,
  BackupImportControls,
  canReplaceFromLocalBackup,
  runBackupRestoreFlow
} from './SettingsView';

describe('flujo visible de restauración', () => {
  it('advierte todos los grupos de datos que serán reemplazados', () => {
    for (const expected of [
      'ajustes',
      'clientes',
      'cotizaciones',
      'abonos',
      'taller',
      'agenda',
      'lotes de piedras',
      'ventas',
      'pagos',
      'proveedores',
      'compradores',
      'joyas en inventario',
      'socios de material',
      'lotes de material',
      'gastos'
    ]) {
      expect(BACKUP_RESTORE_WARNING).toContain(expected);
    }
  });

  it('impide reemplazar la copia local cuando la sesión usa una cuenta nube', () => {
    expect(canReplaceFromLocalBackup(false)).toBe(true);
    expect(canReplaceFromLocalBackup(true)).toBe(false);

    const cloudMarkup = renderToStaticMarkup(createElement(BackupImportControls, {
      isCloudAccount: true,
      importError: '',
      onFile: () => {}
    }));
    expect(cloudMarkup).toContain('Importar datos');
    expect(cloudMarkup).not.toContain('Importar respaldo');
    expect(cloudMarkup).not.toContain('type="file"');

    const localMarkup = renderToStaticMarkup(createElement(BackupImportControls, {
      isCloudAccount: false,
      importError: '',
      onFile: () => {}
    }));
    expect(localMarkup).toContain('Importar respaldo');
    expect(localMarkup).toContain('type="file"');
  });

  it('un aborto no recarga la aplicación ni muestra éxito', async () => {
    const afterCommit = vi.fn();
    const reloadAll = vi.fn(async () => {});
    const showSuccess = vi.fn();

    const result = await runBackupRestoreFlow({
      restore: async () => {
        throw new Error('transacción abortada');
      },
      afterCommit,
      reloadAll,
      showSuccess
    });

    expect(result).toBe('restore-failed');
    expect(afterCommit).not.toHaveBeenCalled();
    expect(reloadAll).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('un fallo al recargar después del commit tampoco muestra éxito', async () => {
    const showSuccess = vi.fn();

    const result = await runBackupRestoreFlow({
      restore: async () => {},
      afterCommit: () => {},
      reloadAll: async () => {
        throw new Error('lectura fallida');
      },
      showSuccess
    });

    expect(result).toBe('reload-failed');
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('muestra éxito únicamente después de restaurar, sincronizar y recargar', async () => {
    const order: string[] = [];

    const result = await runBackupRestoreFlow({
      restore: async () => {
        order.push('restaurar');
      },
      afterCommit: () => {
        order.push('sincronizar');
      },
      reloadAll: async () => {
        order.push('recargar');
      },
      showSuccess: () => {
        order.push('éxito');
      }
    });

    expect(result).toBe('success');
    expect(order).toEqual(['restaurar', 'sincronizar', 'recargar', 'éxito']);
  });
});
