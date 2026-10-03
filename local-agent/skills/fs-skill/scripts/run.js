// @ts-nocheck
import { readdir, stat, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ACCESS_PROFILE, resolvePath, safeReal } from '../../../sandbox.js'

async function run() {

  try {
    // ====================================================================================
    // Parsear argumentos de línea de comandos
    // ====================================================================================
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        action: { type: 'string', short: 'a', default: 'list' }, // list | tree | stat
        depth:  { type: 'string', short: 'd', default: '2' },    // Profundidad para 'tree'
      },
      allowPositionals: true,
    });
    const inputData = positionals[0];
    if (!inputData) {
      console.log(JSON.stringify({ 
        error: 'Faltan argumentos.\nUso: node run.js ruta --action=list|tree|stat'
      }));
      return;
    }
    // ==============================================================================
    // Resolver ruta segura
    // ==============================================================================
    const { abs, ns } = resolvePath(inputData, { op: 'read' });
    const safePath = await safeReal(abs, ACCESS_PROFILE[ns].root);

    const action = values.action;
    switch (action) {
      // ============================================================================
      // Equivalente seguro a ls / dir      
      // ============================================================================
      case 'list': {
        const entries = await readdir(safePath, { withFileTypes: true });
        const result = entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
        }));
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      // ============================================================================
      // Listado recursivo hasta cierta profundidad
      // ============================================================================
      case 'tree': {
        const maxDepth = parseInt(values.depth, 10);
        async function buildTree(dirPath, depth = 0) {
          if (depth > maxDepth) return null;
          const entries = await readdir(dirPath, { withFileTypes: true });
          const items = [];
          
          for (const entry of entries) {
            const fullPath = join(dirPath, entry.name);
            if (entry.isDirectory()) {
              items.push({
                name: entry.name,
                type: 'directory',
                children: depth < maxDepth 
                  ? await buildTree(fullPath, depth + 1) 
                  : undefined
              });
            } else {
              items.push({ name: entry.name, type: 'file' });
            }
          }
          return items;
        }

        const tree = await buildTree(safePath, 0);
        console.log(JSON.stringify(tree, null, 2));
        return;
      }
      // ============================================================================
      // Obtener metadatos (tamaño, fechas)
      // ============================================================================
      case 'stat': { 
        const fileStat = await stat(safePath);
        console.log(JSON.stringify({
          size: fileStat.size,
          created: fileStat.birthtime,
          modified: fileStat.mtime,
          isDirectory: fileStat.isDirectory(),
          isFile: fileStat.isFile()
        }, null, 2));
        return;
      }

      default:
        console.log(JSON.stringify({ 
          error: `Acción '${action}' no reconocida. Usa: list, tree, stat.` 
        }));
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
  }
}

run();