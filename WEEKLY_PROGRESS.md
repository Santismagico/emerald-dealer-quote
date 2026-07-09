# WEEKLY_PROGRESS

## Semana del 6 de julio de 2026

**Hecho**

- Proyecto creado desde cero (la carpeta estaba vacía). Repositorio git inicializado, trabajo en rama `fable/regeneracion-emerald-dealer-quote-v1`.
- Node.js LTS 24.18.0 instalado en el equipo (no existía).
- MVP completo implementado: motor de cálculo con tests, formulario por pasos, clientes, historial, vista previa cliente/interna, PDF cliente e interno, WhatsApp, respaldo JSON, PWA instalable.
- Documentación completa (10 archivos).

**Decisiones importantes**

- Precio del oro como configuración interna editable, por defecto $0 con advertencia (no se inventó precio). Pendiente confirmar campo auxiliar de cálculo automático (+$100.000). Ver DECISIONS.md D-002.
- IndexedDB propio sin dependencias; jsPDF para PDF offline.

**Publicación (2026-07-08)**

- Repositorio público creado: https://github.com/Santismagico/emerald-dealer-quote
- Despliegue automático a GitHub Pages en cada push a `main`: https://santismagico.github.io/emerald-dealer-quote/
- GitHub CLI instalado y autenticado en el equipo.

**Pendiente / próximos pasos**

- Prueba manual en iPhone real (checklist en TEST_PLAN.md) e instalar la PWA desde la URL pública.
- Configurar precio real del oro en Ajustes.
- Considerar mover el proyecto fuera de OneDrive (sincronización puede interferir con node_modules/.git).
