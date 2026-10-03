// @ts-nocheck
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { ACCESS_PROFILE, resolvePath, safeReal } from './../../../sandbox.js'


function resumeCsv(content) {
  const rows = (content || '').trim().split(/\r?\n/);
  if (rows.length === 0 || (rows.length === 1 && rows[0] === ''))
    return { error: 'CSV vacío' };

  const columns = rows[0].split(',');
  const nulls = rows.reduce((acc, row) => {
    row.split(',').forEach((value, index) => {
      if (value.trim() === '') {
        const colname = columns[index];
        acc[colname] = (acc[colname] || 0) + 1;
      }
    });
    return acc;
  }, {});

  return {
    totalRows: rows.length,
    rows: rows,
    columns: columns.length,
    nulls
  };
}

async function run() {
  try {
    // =================================================================================
    // Parsear argumentos de línea de comandos
    // =================================================================================
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        mode: { type: 'string', short: 'm', default: 'text', values: ['file', 'text'] },
        action: { type: 'string', short: 'a', default: 'stats', values: ['stats'] },
      },
      allowPositionals: true,
    });

    const inputData = positionals[0];
    if (!inputData) {
      console.log(JSON.stringify({ 
        error: 'Falta la ruta o el contenido del CSV.\nUso: node run.js --mode file|text'
      }));
      return;
    }

    // ==========================================================================
    // MODO ARCHIVO
    // ==========================================================================
    if (values.mode === 'file') {
      const pathToCsv = inputData.trim();
      const { abs, ns, rel } = resolvePath(inputData, { op: 'read' });
      await safeReal(abs, ACCESS_PROFILE[ns].root);
      const content = await readFile(abs, 'utf8'); 

      const summary = resumeCsv(content);
      if (summary.error) {
        console.log(JSON.stringify({ error: summary.error }));
        return;
      }
      const result = {
        ...summary,
        mode: 'file',
        action: values.action,
        file: pathToCsv
      };
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // ==========================================================================
    // MODO TEXTO (CSV directo)
    // ==========================================================================
    if (values.mode == 'text') {
      const summary = resumeCsv(inputData);
      if (summary.error) {
        console.log(JSON.stringify({ error: summary.error }));
        return;
      }
      const result = {
        ...summary,
        mode: 'text',
        action: values.action,
      };
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    // ==========================================================================
    // MODO NO SOPORTADO
    // ==========================================================================
    console.log(JSON.stringify({ error: `Modo no soportado: ${values.mode}` }));
    return;
 
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
  }
}

run();
