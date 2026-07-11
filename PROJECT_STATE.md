# PROJECT_STATE — Emerald Dealer Quote

_Actualizado: 2026-07-11 por Codex al completar la Etapa 1. Este archivo es la foto del estado real; cualquier agente debe poder continuar leyendo solo esto y los documentos que enlaza._

## Qué aplicación es

PWA de cotizaciones de joyería para Santiago (comerciante de esmeraldas, Colombia). Cotiza piezas (oro + piedras + mano de obra), genera PDF para el cliente (sin datos internos) y PDF interno (con costos y margen), comparte por WhatsApp, lleva historial, seguimiento de producción del taller y abonos del cliente. Todo local (IndexedDB), sin backend.

- **Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + jsPDF + vite-plugin-pwa + Vitest. Sin router ni gestor de estado externo.
- **Versión:** 0.5.0 + cambios no publicados de la Etapa 1 en la rama Fable. No se cambió la versión ni se publicó.
- **Producción:** https://santismagico.github.io/emerald-dealer-quote/ — deploy automático SOLO al hacer push a `main` (`.github/workflows/deploy.yml`).
- **Repositorio:** https://github.com/Santismagico/emerald-dealer-quote (público — nunca subir datos reales ni secretos).

## Estado de Git y respaldos

- Rama de trabajo autorizada: `fable/regeneracion-emerald-dealer-quote-v1`. La Etapa 1 queda en un commit local, sin push.
- Punto de restauración: tag `punto-seguro-2026-07-09` (commit c3140c4), subido a GitHub.
- `main` contiene lo publicado; la rama de trabajo va adelante. **No hacer push a `main` sin autorización de Santiago** (dispara despliegue público).
- Cómo restaurar si algo sale mal: `git restore .` para descartar cambios sin commit; `git reset --hard punto-seguro-2026-07-09` para volver al punto seguro (solo si es imprescindible y avisando).

## Qué está funcionando (verificado 2026-07-11)

- `npm test`: 162 tests en verde (9 archivos).
- `npm run build`: compila sin errores.
- Todos los módulos del MVP + producción del taller + abonos (ver `PRODUCT_SPEC.md` raíz, tabla de módulos).
- Aviso de palabras sensibles antes de PDF cliente/WhatsApp: **Etapa 1 completada y probada**. El PDF analiza su contenido final completo y WhatsApp analiza el mensaje exacto; el usuario puede cancelar o confirmar expresamente el riesgo.

## Qué se quiere construir ahora

Cerrar los pendientes de calidad y pulido del ROADMAP v0.2/v0.2.x en etapas pequeñas:

1. **Completada:** pruebas y corrección del detector de palabras sensibles.
2. Marcado automático de cotizaciones vencidas (estado derivado, sin mutar datos).
3. Guardado eficiente en producción/abonos (guardar al cerrar/perder foco, no por tecla).
4. Recordatorio periódico de exportar respaldo.
5. Adjuntar el PDF al compartir donde el dispositivo lo soporte (Web Share API nivel 2).
6. Plantillas de piezas frecuentes.

## Decisiones tomadas (resumen; detalle en DECISIONS.md)

- Precio del oro automático: internacional 24K del día + $100.000 COP/g (D-002).
- `src/services/schema.ts` es la ÚNICA fuente de defaults/migraciones/normalización (D-010).
- El detector analiza la salida real de PDF cliente y WhatsApp, no una lista manual de campos (D-012).
- Dinero en COP enteros; motor de cálculo puro; privacidad del cliente protegida por tests.
- Plan SaaS (Supabase) escrito en `SAAS_PLAN.md` pero **congelado** hasta orden de Santiago.

## Qué NO debe modificarse

- La lógica del precio del oro (`src/services/goldPrice.ts`) salvo decisión registrada.
- El motor de cálculo (`src/calc/engine.ts`) salvo bug demostrado con test.
- Los tests de privacidad (`src/services/pdfContent.test.ts`): si un cambio los rompe, el cambio está mal.
- `.github/workflows/deploy.yml` y `main` (controlan la publicación).
- No agregar dependencias sin justificarlo en `DECISIONS.md`.

## Riesgos conocidos

- Proyecto dentro de OneDrive (sincronización puede interferir con `node_modules`; conviene moverlo algún día, no urgente).
- Dependencia de 2 APIs gratuitas para el precio del oro (mitigado con fallback y límites de sanidad).
- Repo público: cuidado con datos personales en ejemplos, fixtures o capturas.
- El detector no puede leer texto incrustado dentro del logo o de imágenes de referencia; revisar imágenes antes de enviarlas al cliente.
- Deuda anotada: migraciones IndexedDB versionadas — **no hacer todavía**, esperar al primer cambio real de estructura (ROADMAP).

## Siguiente paso exacto

La **Etapa 1 está completada**. La siguiente recomendación es la Etapa 2: marcado automático de cotizaciones vencidas como estado derivado, solo después de una nueva autorización de Santiago.

## Pruebas que debe ejecutar todo agente antes de dar algo por terminado

```bash
npm test && npm run build
```

## Bitácora de etapas (Codex la actualiza)

| Fecha | Etapa | Resultado | Commit |
|---|---|---|---|
| 2026-07-09 | Preparación y protección (Claude) | Tag `punto-seguro-2026-07-09`, docs de traspaso creados | c3140c4 |
| 2026-07-11 | Etapa 1: detector de información sensible | Salida real por canal, aviso explícito, 162 tests y build en verde | Este commit |
