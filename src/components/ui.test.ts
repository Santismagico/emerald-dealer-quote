import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormDialog, SegmentedControl, Toggle } from './ui';

describe('controles claros y accesibles', () => {
  it('expone el estado real de un interruptor con texto y atributos accesibles', () => {
    const off = renderToStaticMarkup(
      createElement(Toggle, {
        checked: false,
        label: 'Compra a crédito',
        onChange: vi.fn()
      })
    );
    expect(off).toContain('role="switch"');
    expect(off).toContain('aria-checked="false"');
    expect(off).toContain('No');

    const on = renderToStaticMarkup(
      createElement(Toggle, {
        checked: true,
        disabled: true,
        label: 'Compra a crédito',
        onChange: vi.fn()
      })
    );
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('disabled=""');
    expect(on).toContain('Sí');
  });

  it('presenta contado y crédito como radios nativos y permite bloquear contado', () => {
    const markup = renderToStaticMarkup(
      createElement(SegmentedControl, {
        label: 'Forma de venta',
        value: 'credit',
        options: [
          { value: 'cash', label: 'Contado', disabled: true },
          { value: 'credit', label: 'A crédito' }
        ],
        onChange: vi.fn()
      })
    );
    expect(markup.match(/type="radio"/g)).toHaveLength(2);
    expect(markup).toContain('Contado');
    expect(markup).toContain('A crédito');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('checked=""');
  });

  it('estructura los formularios como diálogos con título, descripción y acciones', () => {
    const markup = renderToStaticMarkup(
      createElement(
        FormDialog,
        {
          title: 'Registrar venta',
          description: 'Lote Esmeraldas · 3 ct',
          onClose: vi.fn(),
          footer: createElement('button', null, 'Guardar'),
          children: createElement('p', null, 'Campos de la venta')
        }
      )
    );
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Registrar venta');
    expect(markup).toContain('Lote Esmeraldas · 3 ct');
    expect(markup).toContain('Campos de la venta');
    expect(markup).toContain('Guardar');
    expect(markup).toContain('aria-label="Cerrar"');
  });
});
