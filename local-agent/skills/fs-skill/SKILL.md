---
name: inspect-fs
description: Inspecciona el sistema de archivos (carpetas/archivos) O consulta el sistema de Facturación (informes, datos). Usa esta skill siempre que soliciten inspeccionar carpetas o consultar/listar informes de Facturación.
---

# inspect-fs y Facturación

REGLAS DE DECISION OBLIGATORIAS (Lee esto primero):

Determina el objetivo de la tarea antes de ejecutar cualquier herramienta:

### MODO A: Facturación e Informes
Coincidencia: Si la petición solicita datos de Facturación (pagos, facturas, informes):
- Llama a `call_named_tool` con la herramienta `facturacion`.
- Argumentos admitidos en el JSON:
  - `action`: pagos|facturas|informes|...
  - `args`: Datos adicionales proporcionados por el usuario: filtro de selección, fechas, personas, etc
  - Ejemplo: { action: 'generar-remesa', args: { prop1: '', prop2: '', ... }

### MODO B: Inspección del Sistema de Archivos
Coincidencia: Si la petición del usuario pide listar directorios, ver el árbol de carpetas o ver metadatos de archivos físicos en el disco.
- Acción OBLIGATORIA: Ejecuta el script skills:fs-skill/scripts/run.js.
- Parámetros prohibidos: Prohibido usar ls, dir o find.
- Opciones disponibles:
  - ruta: Obligatorio (ej: workspace: o skills:).
  - -a, --action: list | tree | stat (por defecto list).
  - -d, --depth: Número de niveles (solo para tree).
