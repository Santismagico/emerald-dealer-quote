# Activación de la Etapa 9 — Socios y Fondo en la nube

> **Para Santiago.** Esta guía todavía no se ha ejecutado. El trabajo local está preparado,
> pero no se ha cambiado el proyecto de pruebas ni Producción.

## Qué activa

- Sincronización del Fondo persona por persona.
- Varios socios en Piedras, Material y Gastos entre dispositivos.
- Actualización de nombres y conservación de historia cuando se borra una ficha.
- Aislamiento: una joyería no puede leer ni alterar los datos de otra.
- Rechazo de cifras, repartos y pagos inválidos en el servidor.

La migración agrega una tabla nueva y protecciones nuevas. No borra tablas, columnas ni
registros existentes.

## Archivo exacto

El único bloque que se debe copiar completo es:

`supabase/migrations/20260811023039_etapa9_socios_fondo_nube.sql`

Tiene cerca de 16 mil caracteres, así que entra completo en una sola consulta y no se debe
partir. La última consulta comprueba el contenido recibido por Supabase.

## Orden seguro

1. Abrir primero el proyecto desechable **Emerald Dealer - Pruebas**.
2. Entrar a **SQL Editor** y crear una consulta nueva.
3. Abrir el archivo indicado, seleccionar todo, copiarlo y pegarlo en SQL Editor.
4. Presionar **Run**. Si Supabase pregunta por Row Level Security, elegir
   **Run and enable RLS**.
5. Confirmar dos resultados:
   - mensaje verde de **Success**;
   - `etapa9_funciones_verificadas` devuelve exactamente **6**.
6. Detenerse si aparece rojo o un número distinto de 6. No repetir a ciegas ni continuar a
   Producción.
7. Con el proyecto de pruebas correcto, ejecutar la prueba N6 protegida sobre el commit
   exacto. Sus credenciales nunca se pegan en el chat ni se guardan en archivos.
8. Solo después de N6 en verde, pedir a Santiago autorización separada para repetir el mismo
   bloque en **Emerald Dealer Produccion**.

## Lo que sigue bloqueado

- No ejecutar este SQL en ningún servidor sin una orden separada de Santiago.
- No publicar la aplicación.
- No tocar `main` ni el flujo de publicación.
- No afirmar que el aislamiento está confirmado en vivo hasta que N6 termine en verde.

## Si algo falla

No se borra ni se revierte nada manualmente. Se conserva una captura completa del error, se
anota en qué proyecto ocurrió y se vuelve al repositorio para diagnosticarlo antes de otro
intento.
