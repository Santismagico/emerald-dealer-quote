// Datos de ejemplo compartidos por los tests.

import type { Quote, Client, Settings } from '../types';
import { defaultSettings } from '../services/storage';

export function sampleClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'c-1',
    name: 'María Gómez',
    phone: '3001234567',
    email: 'maria@example.com',
    city: 'Bogotá',
    document: '',
    notes: 'Cliente frecuente',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides
  };
}

export function sampleSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...defaultSettings(),
    goldPricePerGram: 550000,
    defaultMarginPercent: 25,
    phone: '3009876543',
    whatsapp: '573009876543',
    city: 'Bogotá',
    ...overrides
  };
}

export function sampleQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q-1',
    number: 'ED-2026-0001',
    clientId: 'c-1',
    clientSnapshot: sampleClient(),
    date: '2026-07-07',
    validUntil: '2026-07-22',
    status: 'borrador',
    approvedAt: '',
    deliveredAt: '',
    pieceType: 'anillo',
    pieceDescription: 'Anillo de compromiso con esmeralda central',
    material: 'Oro',
    materialPricePerGram: 550000,
    weightGrams: 6.5,
    stones: [
      {
        id: 's-1',
        type: 'Esmeralda',
        cut: 'esmeralda',
        size: '7x5 mm',
        carats: 1.2,
        quantity: 1,
        priceMode: 'porQuilate',
        unitPrice: 3000000,
        treatment: '',
        quality: 'Calidad comercial alta',
        notes: 'Piedra de Muzo, lote 12'
      }
    ],
    laborCost: 800000,
    extraCosts: [{ id: 'e-1', label: 'Engaste', amount: 150000 }],
    marginPercent: 25,
    discountType: 'porcentaje',
    discountValue: 5,
    taxEnabled: false,
    taxPercent: 19,
    deposit: 2000000,
    internalNotes: 'Costo real de la piedra fue menor, revisar proveedor.',
    clientNotes: 'Incluye estuche de lujo.',
    images: [],
    production: [
      {
        id: 'st-1',
        name: 'Fundición',
        status: 'lista',
        completedAt: '2026-07-06',
        cost: 300000,
        paid: true,
        paidAt: '2026-07-06',
        paidTo: 'Taller Ramírez',
        paidBy: 'Santiago',
        notes: ''
      },
      {
        id: 'st-2',
        name: 'Pulido',
        status: 'enProceso',
        completedAt: '',
        cost: 120000,
        paid: false,
        paidAt: '',
        paidTo: '',
        paidBy: '',
        notes: 'Programado para el viernes'
      }
    ],
    payments: [
      {
        id: 'p-1',
        amount: 1000000,
        date: '2026-07-05',
        receivedBy: 'Laura',
        method: 'Transferencia',
        notes: ''
      }
    ],
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:30:00.000Z',
    ...overrides
  };
}
