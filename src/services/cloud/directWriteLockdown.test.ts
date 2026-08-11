// Guardia contra el agujero encontrado el 2026-08-10 en el proyecto desechable.
//
// Seis tablas dejaban `TRUNCATE` en manos de cualquier cuenta con sesion. TRUNCATE
// **no respeta Row Level Security**: la barrera que separa a una joyeria de otra no
// se aplica a un vaciado de tabla. Cualquiera podia borrar los datos de todas.
//
// La causa fue una diferencia que parece cosmetica:
//   revoke insert, update, delete ... from authenticated   <- deja TRUNCATE abierto
//   revoke all ... from authenticated                      <- lo cierra
//
// Estas pruebas leen el SQL de las migraciones. No necesitan servidor, corren en
// cada `npm test` y fallan si alguien vuelve a escribir el patron debil.

import { describe, expect, it } from 'vitest';

// Se cargan igual que en `migrations.test.ts`: por Vite, no por Node, para que
// el mismo archivo sirva en las pruebas y en la compilacion.
const MIGRACIONES = import.meta.glob('../../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/** Tablas que la app lee pero NUNCA escribe directo: todo pasa por funciones protegidas. */
const TABLAS_SOLO_LECTURA = [
  'buyers',
  'expenses',
  'fund_contributions',
  'material_lots',
  'material_partners',
  'stock_jewels'
] as const;

describe('escritura directa cerrada en la nube', () => {
  const todoElSql = Object.keys(MIGRACIONES)
    .sort()
    .map((ruta) => MIGRACIONES[ruta])
    .join('\n');

  it('encuentra las migraciones que va a revisar', () => {
    // Si el glob dejara de encontrarlas, las demas pruebas pasarian en vacio.
    expect(Object.keys(MIGRACIONES).length).toBeGreaterThan(10);
    expect(todoElSql).toContain('fund_contributions');
  });

  it('ninguna tabla se queda con el revoke debil como ultima palabra', () => {
    // El patron debil puede existir en una migracion historica: lo que no puede
    // pasar es que sea lo ultimo que se dijo sobre esa tabla.
    const debiles = [
      ...todoElSql.matchAll(
        /revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.([a-z_]+)\s+from\s+[^;]*authenticated/gi
      )
    ].map((coincidencia) => coincidencia[1]);

    for (const tabla of new Set(debiles)) {
      const cierreFuerte = new RegExp(
        `revoke\\s+all\\s+on\\s+table\\s+public\\.${tabla}\\s+from\\s+[^;]*authenticated`,
        'i'
      );
      expect(
        cierreFuerte.test(todoElSql),
        `public.${tabla} usa "revoke insert, update, delete" y nunca se cierra con ` +
          `"revoke all". Eso deja TRUNCATE abierto, y TRUNCATE se salta el aislamiento ` +
          `entre joyerias.`
      ).toBe(true);
    }
  });

  it('las tablas de solo lectura revocan TODO a la cuenta con sesion', () => {
    for (const tabla of TABLAS_SOLO_LECTURA) {
      const revocaTodo = new RegExp(
        `revoke\\s+all\\s+on\\s+table\\s+public\\.${tabla}\\s+from\\s+[^;]*authenticated`,
        'i'
      );
      expect(
        revocaTodo.test(todoElSql),
        `public.${tabla} nunca revoca todos los permisos a "authenticated". ` +
          `Supabase concede TRUNCATE por defecto en cada tabla nueva.`
      ).toBe(true);
    }
  });

  it('las tablas de solo lectura recuperan el permiso de LEER', () => {
    // Revocar todo sin devolver el select dejaria la app sin poder mostrar nada.
    for (const tabla of TABLAS_SOLO_LECTURA) {
      const concedeLectura = new RegExp(
        `grant\\s+select\\s+on\\s+table\\s+public\\.${tabla}\\s+to\\s+[^;]*authenticated`,
        'i'
      );
      expect(
        concedeLectura.test(todoElSql),
        `public.${tabla} revoca todo pero nunca vuelve a conceder select.`
      ).toBe(true);
    }
  });

  it('ninguna tabla concede escritura directa a la cuenta con sesion', () => {
    const escrituras = [
      ...todoElSql.matchAll(
        /grant\s+([^;]*?)\s+on\s+table\s+public\.([a-z_]+)\s+to\s+([^;]*?)(?:;|$)/gi
      )
    ];

    for (const [, permisos, tabla, destinatarios] of escrituras) {
      if (!/authenticated/i.test(destinatarios)) continue;
      const peligrosos = /insert|update|delete|truncate|all/i.test(permisos);
      expect(
        peligrosos,
        `public.${tabla} concede "${permisos.trim()}" a authenticated. Con sesion ` +
          `iniciada solo se puede leer: escribir pasa por las funciones protegidas.`
      ).toBe(false);
    }
  });
});
