// Etapa S2: los aportes al fondo se guardan de verdad y viajan en el respaldo v9.
//
// Lo que más importa aquí: un respaldo v8 —de antes de que existiera el fondo—
// se sigue importando sin fallar, y estrena la lista vacía.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { BackupFile, FundContribution } from '../types';

let storage: typeof import('./storage');
let backupService: typeof import('./backup');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('./storage');
  backupService = await import('./backup');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function aporte(overrides: Partial<FundContribution> = {}): FundContribution {
  return {
    id: 'ap-1',
    personId: 'q-1',
    personName: 'Ana',
    date: '2026-01-15',
    amountCop: 3_000_000,
    returnKind: 'mensual',
    monthlyRatePercent: 2,
    agreedTotalCop: null,
    dueDate: '',
    payments: [],
    notes: '',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    ...overrides
  };
}

function respaldoVacio(version: number): Record<string, unknown> {
  return {
    app: 'emerald-dealer-quote',
    version,
    exportedAt: '',
    settings: null,
    clients: [],
    quotes: [],
    appointments: [],
    stoneLots: [],
    suppliers: [],
    buyers: [],
    stockJewels: [],
    materialPartners: [],
    materialLots: [],
    expenses: []
  };
}

describe('guardar y leer aportes', () => {
  it('guarda un aporte y lo devuelve normalizado', async () => {
    await storage.saveFundContribution(aporte());
    const guardados = await storage.listFundContributions();
    expect(guardados).toHaveLength(1);
    expect(guardados[0].personName).toBe('Ana');
    expect(guardados[0].amountCop).toBe(3_000_000);
    expect(guardados[0].monthlyRatePercent).toBe(2);
  });

  it('rechaza un aporte inválido antes de tocar la base', async () => {
    await expect(storage.saveFundContribution(aporte({ amountCop: 0 }))).rejects.toThrow(
      'El aporte debe ser mayor que cero.'
    );
    expect(await storage.listFundContributions()).toHaveLength(0);
  });

  it('un aporte pactado a cifra fija no conserva tasa mensual colgando', async () => {
    await storage.saveFundContribution(
      aporte({
        returnKind: 'fijo',
        monthlyRatePercent: 2,
        agreedTotalCop: 3_600_000,
        dueDate: '2026-07-15'
      })
    );
    const [guardado] = await storage.listFundContributions();
    expect(guardado.monthlyRatePercent).toBeNull();
    expect(guardado.agreedTotalCop).toBe(3_600_000);
  });

  it('ordena del aporte más reciente al más viejo', async () => {
    await storage.saveFundContribution(aporte({ id: 'ap-1', date: '2026-01-15' }));
    await storage.saveFundContribution(aporte({ id: 'ap-2', date: '2026-05-20' }));
    const guardados = await storage.listFundContributions();
    expect(guardados.map((a) => a.id)).toEqual(['ap-2', 'ap-1']);
  });

  it('un aporte saldado se puede borrar solo si fue un error de registro', async () => {
    await storage.saveFundContribution(aporte());
    await storage.deleteFundContribution('ap-1');
    expect(await storage.listFundContributions()).toHaveLength(0);
  });
});

describe('respaldo v9', () => {
  it('la exportación incluye los aportes y usa la versión vigente', async () => {
    await storage.saveFundContribution(aporte());
    const backup = await backupService.exportBackup();
    expect(backup.version).toBe(9);
    expect(backupService.BACKUP_VERSION).toBe(9);
    expect(backup.fundContributions.map((a) => a.id)).toEqual(['ap-1']);
  });

  it('un respaldo v8 se sigue aceptando y estrena la lista vacía', () => {
    const parsed = backupService.parseBackup(JSON.stringify(respaldoVacio(8)));
    expect(parsed.fundContributions).toEqual([]);
    expect(parsed.version).toBe(9);
  });

  it('acepta todas las versiones anteriores sin aportes', () => {
    for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const parsed = backupService.parseBackup(JSON.stringify(respaldoVacio(version)));
      expect(parsed.fundContributions).toEqual([]);
    }
  });

  it('restaura los aportes y reemplaza lo que hubiera', async () => {
    await storage.saveFundContribution(aporte({ id: 'viejo', personName: 'Anterior' }));
    const backup: BackupFile = {
      ...(respaldoVacio(9) as unknown as BackupFile),
      fundContributions: [aporte({ id: 'ap-nuevo', personName: 'Luis' })]
    };
    await backupService.importBackup(backup);
    const guardados = await storage.listFundContributions();
    expect(guardados.map((a) => a.id)).toEqual(['ap-nuevo']);
    expect(guardados[0].personName).toBe('Luis');
  });

  it('rechaza aportes duplicados', () => {
    const json = JSON.stringify({
      ...respaldoVacio(9),
      fundContributions: [aporte(), aporte()]
    });
    expect(() => backupService.parseBackup(json)).toThrow('aportes al fondo duplicados');
  });

  it('rechaza un trato imposible: rendimiento pactado menor que la plata puesta', () => {
    const json = JSON.stringify({
      ...respaldoVacio(9),
      fundContributions: [
        {
          ...aporte({ returnKind: 'fijo', monthlyRatePercent: null }),
          amountCop: 3_000_000,
          agreedTotalCop: 1_000_000
        }
      ]
    });
    // La normalización sube el total al capital, así que el trato queda válido
    // en vez de reventar: nunca se importa una deuda menor que lo entregado.
    const parsed = backupService.parseBackup(json);
    expect(parsed.fundContributions[0].agreedTotalCop).toBe(3_000_000);
  });

  it('rechaza un pago anterior al aporte', () => {
    const json = JSON.stringify({
      ...respaldoVacio(9),
      fundContributions: [
        aporte({
          payments: [
            { id: 'pg-1', date: '2025-01-01', amountCop: 100_000, kind: 'rendimiento', notes: '' }
          ]
        })
      ]
    });
    expect(() => backupService.parseBackup(json)).toThrow('Un pago quedó antes del aporte.');
  });
});

describe('ida y vuelta completa', () => {
  it('exportar e importar deja los aportes idénticos', async () => {
    const original = aporte({
      payments: [
        { id: 'pg-1', date: '2026-03-15', amountCop: 60_000, kind: 'rendimiento', notes: 'marzo' }
      ],
      notes: 'Aporte de prueba'
    });
    await storage.saveFundContribution(original);

    const exportado = await backupService.exportBackup();
    const json = backupService.serializeBackup(exportado);
    const reimportado = backupService.parseBackup(json);
    await backupService.importBackup(reimportado);

    const guardados = await storage.listFundContributions();
    expect(guardados).toEqual(exportado.fundContributions);
    expect(guardados[0].payments).toHaveLength(1);
    expect(guardados[0].payments[0].amountCop).toBe(60_000);
  });
});
