import { describe, expect, it, vi } from 'vitest';
import type {
  Appointment,
  BackupFile,
  Buyer,
  Client,
  Expense,
  MaterialLot,
  MaterialPartner,
  Quote,
  Settings,
  StockJewel,
  StoneLot,
  Supplier
} from '../../types';
import { sampleQuote, sampleSettings } from '../../test/fixtures';
import { transformStockJewelToNatural } from '../stoneJewelTransformation';
import {
  countImportRecords,
  hasLocalDataToImport,
  importToCloud,
  isCloudEmpty,
  type CloudImportWriter
} from './importer';

function largeBackup(): BackupFile {
  const timestamp = '2026-07-18T15:00:00Z';
  return {
    app: 'emerald-dealer-quote',
    version: 8,
    exportedAt: timestamp,
    settings: sampleSettings(),
    clients: [],
    quotes: Array.from({ length: 200 }, (_, index) => sampleQuote({
      id: `q-${index}`,
      number: `ED-2026-${String(index).padStart(4, '0')}`,
      images: [`data:image/jpeg;base64,imagen-${index}`],
      updatedAt: `2026-07-18T15:${String(index % 60).padStart(2, '0')}:00Z`
    })),
    appointments: [],
    stoneLots: [],
    suppliers: [],
    buyers: [{
      id: 'buyer-1',
      name: 'Comprador de prueba',
      phone: '',
      city: '',
      notes: '',
      createdAt: timestamp
    }],
    stockJewels: [{
      id: 'stock-jewel-1',
      name: 'Anillo de prueba',
      pieceType: 'anillo',
      material: 'Oro',
      photo: '',
      acquiredDate: '2026-07-18',
      weightGrams: 0,
      size: '',
      stoneCount: 0,
      stoneKind: '',
      costCop: 800000,
      priceCop: 1200000,
      status: 'disponible',
      notes: '',
      sale: null,
      collectionId: null,
      stoneTransformations: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    materialPartners: [{
      id: 'material-partner-1',
      name: 'Socio de prueba',
      phone: '',
      city: '',
      notes: '',
      createdAt: timestamp
    }],
    materialLots: [{
      id: 'material-lot-1',
      name: 'Oro de prueba',
      materialType: 'Oro',
      purity: '18K',
      purchaseDate: '2026-07-18',
      grams: 10,
      costCop: 5000000,
      partnerId: 'material-partner-1',
      partnerName: 'Socio de prueba',
      myGrams: 6,
      notes: '',
      uses: [{
        id: 'material-use-1',
        date: '2026-07-18',
        grams: 2,
        notes: ''
      }],
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    expenses: [{
      id: 'expense-1',
      date: '2026-07-18',
      concept: 'Feria de prueba',
      category: 'Publicidad',
      amountCop: 300000,
      usdRate: null,
      method: 'Transferencia',
      paidBy: 'Santiago',
      partnerId: 'material-partner-1',
      partnerName: 'Socio de prueba',
      myPercent: 60,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp
    }]
  };
}

function memoryWriter() {
  const values = {
    settings: null as Settings | null,
    clients: new Map<string, Client>(),
    quotes: new Map<string, Quote>(),
    appointments: new Map<string, Appointment>(),
    stoneLots: new Map<string, StoneLot>(),
    suppliers: new Map<string, Supplier>(),
    buyers: new Map<string, Buyer>(),
    stockJewels: new Map<string, StockJewel>(),
    materialPartners: new Map<string, MaterialPartner>(),
    materialLots: new Map<string, MaterialLot>(),
    expenses: new Map<string, Expense>()
  };
  let flushes = 0;
  const transformations: string[] = [];
  const restoredCosts: Array<{
    id: string;
    lotCostCop: number;
    jewelTransformationCostCop: number;
    jewelCostCop: number;
    updatedAt: string;
  }> = [];
  const writer: CloudImportWriter = {
    authorizeImport: async () => {},
    saveSettings: async (settings) => { values.settings = settings; },
    saveClient: async (client) => void values.clients.set(client.id, client),
    saveQuote: async (quote) => void values.quotes.set(quote.id, quote),
    saveAppointment: async (appointment) => void values.appointments.set(appointment.id, appointment),
    saveStoneLot: async (lot) => void values.stoneLots.set(lot.id, lot),
    seedStoneLotForImport: async (lot) => {
      if (!values.stoneLots.has(lot.id)) values.stoneLots.set(lot.id, lot);
    },
    saveSupplier: async (supplier) => void values.suppliers.set(supplier.id, supplier),
    saveBuyer: async (buyer) => void values.buyers.set(buyer.id, buyer),
    saveStockJewel: async (jewel) => void values.stockJewels.set(jewel.id, jewel),
    seedStockJewelForImport: async (jewel) => {
      if (!values.stockJewels.has(jewel.id)) values.stockJewels.set(jewel.id, jewel);
    },
    finalizeStoneLotForImport: async (lot) => void values.stoneLots.set(lot.id, lot),
    finalizeStockJewelForImport: async (jewel) => void values.stockJewels.set(jewel.id, jewel),
    restoreStockJewelTransformationForImport: async (input) => {
      const lot = values.stoneLots.get(input.lotId);
      const jewel = values.stockJewels.get(input.jewelId);
      if (!lot || !jewel) throw new Error('Falta la base de la transformación.');
      const existingUse = lot.internalUses.find((use) => use.id === input.id);
      const existingTransformation = jewel.stoneTransformations.find(
        (transformation) => transformation.id === input.id
      );
      if (existingUse || existingTransformation) {
        if (
          !existingUse ||
          !existingTransformation ||
          existingUse.costCop !== input.costCop ||
          existingTransformation.costCop !== input.costCop
        ) {
          throw new Error('La transformacion restaurada no coincide.');
        }
        return;
      }
      const { costCop, updatedAt, ...transformationInput } = input;
      const result = transformStockJewelToNatural(lot, jewel, transformationInput, updatedAt);
      const restoredLot: StoneLot = {
        ...result.lot,
        internalUses: result.lot.internalUses.map((use) =>
          use.id === input.id ? { ...use, costCop } : use
        )
      };
      const restoredJewel: StockJewel = {
        ...result.jewel,
        costCop: jewel.costCop + costCop,
        stoneTransformations: result.jewel.stoneTransformations.map((transformation) =>
          transformation.id === input.id ? { ...transformation, costCop } : transformation
        )
      };
      values.stoneLots.set(restoredLot.id, restoredLot);
      values.stockJewels.set(restoredJewel.id, restoredJewel);
      transformations.push(input.id);
      restoredCosts.push({
        id: input.id,
        lotCostCop: restoredLot.internalUses.at(-1)?.costCop ?? -1,
        jewelTransformationCostCop:
          restoredJewel.stoneTransformations.at(-1)?.costCop ?? -1,
        jewelCostCop: restoredJewel.costCop,
        updatedAt
      });
    },
    saveMaterialPartner: async (p) => void values.materialPartners.set(p.id, p),
    saveMaterialLot: async (l) => void values.materialLots.set(l.id, l),
    saveExpense: async (expense) => void values.expenses.set(expense.id, expense),
    flush: async () => { flushes += 1; },
    pendingCount: async () => 0,
    pullAll: async () => {}
  };
  return { writer, values, transformations, restoredCosts, flushes: () => flushes };
}

describe('importación inicial a la nube', () => {
  it('sube un respaldo grande de 200 cotizaciones por lotes y conserva imágenes', async () => {
    const backup = largeBackup();
    const target = memoryWriter();
    const progress = vi.fn();

    await importToCloud(backup, { writer: target.writer, batchSize: 25, onProgress: progress });

    expect(countImportRecords(backup)).toBe(206);
    expect(target.values.quotes.size).toBe(200);
    expect(target.values.quotes.get('q-199')?.images).toEqual(['data:image/jpeg;base64,imagen-199']);
    expect([...target.values.buyers.keys()]).toEqual(['buyer-1']);
    expect([...target.values.stockJewels.keys()]).toEqual(['stock-jewel-1']);
    expect([...target.values.materialPartners.keys()]).toEqual(['material-partner-1']);
    expect(target.values.materialLots.get('material-lot-1')).toMatchObject({
      grams: 10,
      myGrams: 6,
      costCop: 5000000,
      uses: [{ grams: 2 }]
    });
    expect(target.values.expenses.get('expense-1')).toMatchObject({
      amountCop: 300000,
      partnerName: 'Socio de prueba',
      myPercent: 60
    });
    expect(target.flushes()).toBe(10);
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({ completed: 206, total: 206, percent: 100 });
  });

  it('repetir la misma importación conserva ids y no duplica registros', async () => {
    const backup = largeBackup();
    const target = memoryWriter();

    await importToCloud(backup, { writer: target.writer, batchSize: 50 });
    await importToCloud(backup, { writer: target.writer, batchSize: 50 });

    expect(target.values.quotes.size).toBe(200);
    expect([...target.values.quotes.keys()][0]).toBe('q-0');
  });

  it('reconstruye una transformación mediante la operación atómica y conserva el resultado final', async () => {
    const backup = largeBackup();
    const firstUse: StoneLot['internalUses'][number] = {
      id: 'event-first',
      date: '2026-08-04',
      carats: 1,
      quantity: 1,
      origin: 'bruto',
      jewelId: 'jewel-first',
      costCop: 135_000,
      notes: 'Primer cambio de vitrina'
    };
    const secondUse: StoneLot['internalUses'][number] = {
      id: 'event-second',
      date: '2026-08-05',
      carats: 1,
      quantity: 1,
      origin: 'bruto',
      jewelId: 'jewel-second',
      costCop: 75_000,
      notes: 'Segundo cambio de vitrina'
    };
    const transformedLot: StoneLot = {
      id: 'lot-transform',
      name: 'Lote natural',
      stoneType: 'Esmeralda',
      description: '',
      purchaseDate: '2026-08-01',
      supplier: '',
      supplierId: null,
      carats: 10,
      quantity: 10,
      purchaseValueCop: 1_000_000,
      partnerId: null,
      partnerName: '',
      myPercent: 100,
      onCredit: false,
      supplierPayments: [],
      cuttingBatches: [],
      internalUses: [firstUse, secondUse],
      notes: '',
      sales: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z'
    };
    const transformedJewelFirst: StockJewel = {
      ...backup.stockJewels[0],
      id: 'jewel-first',
      acquiredDate: '2026-08-02',
      stoneCount: 1,
      stoneKind: 'natural',
      costCop: 935_000,
      sale: {
        id: 'sale-final',
        date: '2026-08-06',
        buyer: 'Comprador final',
        buyerId: null,
        priceCop: 1_500_000,
        productType: 'Joya con piedra natural',
        usdRate: null,
        method: 'Efectivo',
        receivedBy: 'Santiago',
        notes: 'Venta restaurada'
      },
      stoneTransformations: [{
        ...firstUse,
        lotId: 'lot-transform',
        fromStoneKind: 'fantasia',
        toStoneKind: 'natural'
      }],
      updatedAt: '2026-08-04T10:00:00.000Z'
    };
    const transformedJewelSecond: StockJewel = {
      ...backup.stockJewels[0],
      id: 'jewel-second',
      acquiredDate: '2026-08-02',
      stoneCount: 1,
      stoneKind: 'natural',
      costCop: 875_000,
      stoneTransformations: [{
        ...secondUse,
        lotId: 'lot-transform',
        fromStoneKind: 'fantasia',
        toStoneKind: 'natural'
      }],
      updatedAt: '2026-08-05T10:00:00.000Z'
    };
    backup.stoneLots = [transformedLot];
    backup.stockJewels = [transformedJewelSecond, transformedJewelFirst];
    const target = memoryWriter();

    await importToCloud(backup, { writer: target.writer, batchSize: 500 });

    expect(countImportRecords(backup)).toBe(213);
    expect(backup.stockJewels.map((jewel) => jewel.id)).toEqual(['jewel-second', 'jewel-first']);
    expect(transformedLot.internalUses.map((use) => use.id)).toEqual(['event-first', 'event-second']);
    expect(target.transformations).toEqual(['event-first', 'event-second']);
    expect(target.restoredCosts).toEqual([
      {
        id: 'event-first',
        lotCostCop: 135_000,
        jewelTransformationCostCop: 135_000,
        jewelCostCop: 935_000,
        updatedAt: '2026-08-05T10:00:00.000Z'
      },
      {
        id: 'event-second',
        lotCostCop: 75_000,
        jewelTransformationCostCop: 75_000,
        jewelCostCop: 875_000,
        updatedAt: '2026-08-05T10:00:00.000Z'
      }
    ]);
    expect(firstUse.costCop).not.toBe(100_000);
    expect(secondUse.costCop).not.toBe(100_000);
    expect(target.values.stoneLots.get(transformedLot.id)).toEqual(transformedLot);
    expect(target.values.stockJewels.get(transformedJewelFirst.id)).toEqual(transformedJewelFirst);
    expect(target.values.stockJewels.get(transformedJewelSecond.id)).toEqual(transformedJewelSecond);
    expect(target.values.stockJewels.get(transformedJewelFirst.id)?.sale).toEqual(
      transformedJewelFirst.sale
    );
    expect(target.flushes()).toBe(4);

    await importToCloud(backup, { writer: target.writer, batchSize: 500 });

    expect(target.transformations).toEqual(['event-first', 'event-second']);
    expect(target.values.stoneLots.get(transformedLot.id)).toEqual(transformedLot);
    expect(target.values.stockJewels.get(transformedJewelFirst.id)).toEqual(transformedJewelFirst);
    expect(target.values.stockJewels.get(transformedJewelSecond.id)).toEqual(transformedJewelSecond);
    expect(target.flushes()).toBe(8);
  });

  it('importa la historia autosuficiente de una joya cuyo lote ya fue eliminado', async () => {
    const backup = largeBackup();
    const orphanJewel: StockJewel = {
      ...backup.stockJewels[0],
      id: 'jewel-orphan',
      stoneCount: 1,
      stoneKind: 'natural',
      costCop: 900_000,
      stoneTransformations: [
        {
          id: 'event-orphan',
          date: '2026-07-18',
          lotId: 'lot-deleted',
          lotName: 'Lote natural eliminado',
          jewelId: 'jewel-orphan',
          origin: 'bruto',
          carats: 1,
          quantity: 1,
          costCop: 100_000,
          notes: '',
          fromStoneKind: 'fantasia',
          toStoneKind: 'natural'
        }
      ]
    };
    backup.stoneLots = [];
    backup.stockJewels = [orphanJewel];
    const target = memoryWriter();

    await importToCloud(backup, { writer: target.writer, batchSize: 500 });

    expect(countImportRecords(backup)).toBe(207);
    expect(target.transformations).toEqual([]);
    expect(target.values.stockJewels.get(orphanJewel.id)).toEqual(orphanJewel);
  });

  it('detecta si el dispositivo tiene información y si la nube está vacía', async () => {
    expect(hasLocalDataToImport(largeBackup())).toBe(true);
    expect(await isCloudEmpty({ list: async () => [] })).toBe(true);
    expect(await isCloudEmpty({
      list: async (table) => table === 'clients'
        ? [{ id: 'c-1', data: {}, updated_at: '2026-07-18T15:00:00Z' }]
        : []
    })).toBe(false);
  });

  it('no empieza si existe un cambio anterior pendiente o retenido', async () => {
    const backup = largeBackup();
    const target = memoryWriter();
    target.writer.pendingCount = async () => 10;

    await expect(importToCloud(backup, { writer: target.writer, batchSize: 25 })).rejects.toThrow(
      /antes de importar, resuelve los cambios pendientes/i
    );
    expect(target.values.quotes.size).toBe(0);
    expect(target.flushes()).toBe(1);
  });

  it('comprueba el permiso antes de escribir el primer registro', async () => {
    const backup = largeBackup();
    const target = memoryWriter();
    target.writer.authorizeImport = async () => {
      throw new Error('Esta cuenta no puede importar datos.');
    };

    await expect(importToCloud(backup, { writer: target.writer })).rejects.toThrow(
      /no puede importar/i
    );
    expect(target.values.quotes.size).toBe(0);
    expect(target.flushes()).toBe(0);
  });
});
