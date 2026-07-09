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

**Pendiente / próximos pasos**

- Prueba manual en iPhone real (checklist en TEST_PLAN.md).
- Configurar precio real del oro en Ajustes.
- Evaluar despliegue (Netlify/Vercel/Cloudflare Pages) para poder instalar la PWA desde el celular.
- Considerar mover el proyecto fuera de OneDrive (sincronización puede interferir con node_modules/.git).
