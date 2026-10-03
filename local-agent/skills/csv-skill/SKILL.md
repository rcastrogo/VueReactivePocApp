---
name: csv-stats
description: Realiza operaciones sobre datos en formato csv. Úsala cuando pidan analizar o resumir datos en formato CSV o recuperar datos del sistema en este formato.
---

# csv-stats

1. Ejecuta `sample-skill/scripts/run.js [opciones] texto|ruta.csv`.
2. Las opciones de son:
  - mode: { short: 'm', default: 'text' },    // file | text
  - action: { short: 'a', default: 'stats' }, // stats | export
3. El script imprime JSON con el resumen.
4. Resume el resultado al usuario utilizando HTML sin markdown. Incluye las filas por defecto. No pegar el JSON completo.
5. Los nombres de archivos temporales siguen el patrón: `workspace:cs-stat/data-.csv` (usa un UUID aleatorio).
