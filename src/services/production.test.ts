import { describe, it, expect } from 'vitest';
import { defaultProductionStages, productionSummary, emptyStage } from './production';

describe('etapas de producción', () => {
  it('crea las 5 etapas estándar en el orden acordado y sin Impresión', () => {
    const stages = defaultProductionStages();
    const names = stages.map((s) => s.name);
    expect(names).toEqual(['Diseño', 'Fundición', 'Terminado y engaste', 'Material', 'Varios']);
    expect(names).not.toContain('Impresión');
    expect(stages.every((s) => s.status === 'pendiente')).toBe(true);
    expect(stages.every((s) => s.cost === 0 && !s.paid)).toBe(true);
    // ids únicos
    expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length);
  });
});

describe('resumen de producción', () => {
  it('suma gasto total, pagado y pendiente', () => {
    const stages = [
      { ...emptyStage('Fundición'), cost: 300000, paid: true, status: 'lista' as const },
      { ...emptyStage('Pulido'), cost: 120000, paid: false, status: 'enProceso' as const },
      { ...emptyStage('Entrega'), cost: 0 }
    ];
    const s = productionSummary(stages);
    expect(s.totalCost).toBe(420000);
    expect(s.paidCost).toBe(300000);
    expect(s.pendingCost).toBe(120000);
    expect(s.stagesDone).toBe(1);
    expect(s.stagesTotal).toBe(3);
  });

  it('los totales son enteros y los negativos se tratan como cero', () => {
    const stages = [
      { ...emptyStage('Diseño'), cost: 100000.6, paid: true },
      { ...emptyStage('Raro'), cost: -50000 },
      { ...emptyStage('Nulo'), cost: NaN }
    ];
    const s = productionSummary(stages);
    expect(s.totalCost).toBe(100001);
    expect(Number.isInteger(s.totalCost)).toBe(true);
    expect(s.pendingCost).toBe(0);
  });

  it('lista vacía da resumen en ceros', () => {
    const s = productionSummary([]);
    expect(s).toEqual({ totalCost: 0, paidCost: 0, pendingCost: 0, stagesDone: 0, stagesTotal: 0 });
  });
});
