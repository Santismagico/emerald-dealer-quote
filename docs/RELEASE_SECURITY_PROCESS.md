# Proceso seguro para preparar y publicar Emerald Dealer

## Regla principal

Un cambio en el código nunca publica el sitio por sí solo. La publicación es una acción manual y separada. Si falla una sola comprobación, la salida se detiene y la versión pública permanece igual.

## Evidencia obligatoria de cada candidata

1. La revisión de dependencias no encuentra problemas altos o críticos.
2. El detector de credenciales aprueba los archivos que entrarían al repositorio.
3. Todas las pruebas y la compilación terminan correctamente.
4. Los controles de base de datos confirman que las escrituras pasan por operaciones protegidas.
5. N6 aprueba el commit exacto en el proyecto desechable de pruebas: dos cuentas, dos joyerías, ningún acceso cruzado, ningún acceso anónimo y consecutivos sin duplicados.
6. La evidencia se guarda por 90 días asociada al commit exacto.

## Cómo se prepara una candidata

1. Trabajar en una rama separada.
2. Ejecutar `npm run security:check`.
3. Aplicar las migraciones únicamente al proyecto identificado como **Emerald Dealer - Pruebas Fase 2**.
4. Ejecutar `npm run security:n6` con las claves cargadas solo en la sesión local. Nunca copiarlas al repositorio, un chat, una captura o un archivo de evidencia.
5. Revisar los avisos de seguridad y rendimiento de Supabase.
6. Guardar el resultado, el commit, la fecha y el responsable en `docs/AUDITORIA_FASE2.md`.

## Cómo se publica

1. La candidata ya debe estar aprobada y unida a `main` mediante el proceso acordado.
2. En GitHub Actions, abrir **Deploy a GitHub Pages** y elegir ejecución manual.
3. Escribir el commit exacto aprobado por N6.
4. Escribir `PUBLICAR` como confirmación final.
5. Verificar el sitio publicado y conservar la evidencia. Si algo no coincide, detenerse y volver a la última versión aprobada mediante otra publicación manual.

## Condiciones que obligan a detenerse

- Aparece una credencial o un archivo privado.
- Una dependencia tiene una vulnerabilidad alta o crítica sin resolver.
- Falla una prueba, la compilación o la comprobación N6.
- El proyecto no está claramente marcado como pruebas.
- La evidencia N6 corresponde a otro commit.
- No existe autorización expresa de Santiago para publicar.
- Se intenta utilizar datos reales de clientes en el entorno de pruebas.

## Recuperación

- Aplicación: volver al último commit aprobado y ejecutar nuevamente todos los controles antes de una publicación manual.
- Base de datos de pruebas: corregir la operación protegida y repetir N6. Solo en una emergencia de compatibilidad se puede revisar y ejecutar manualmente `supabase/rollback/restore_direct_writes_after_20260718200036.sql`; este retroceso reduce la protección y nunca debe mantenerse ni llevarse a producción.
- Credencial expuesta: revocarla inmediatamente, reemplazarla y revisar el historial antes de continuar.

## Revisión periódica

- Antes de cada candidata: controles completos y N6.
- Cada mes: avisos de Supabase, dependencias y permisos de GitHub.
- Antes de recibir datos reales o habilitar invitaciones: auditoría independiente, matriz aprobada de permisos por rol, revisión legal y prueba de recuperación.
