// @ts-nocheck

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpath } from 'node:fs/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const AGENT_ROOT = HERE;

export const ACCESS_PROFILE = {
  workspace: {
    root: process.env.AGENT_WORKSPACE || path.resolve(AGENT_ROOT, 'src'),
    canRead: true,
    canWrite: true,
    canExecute: false,
  },
  skills: {
    root: path.resolve(AGENT_ROOT, 'skills'),
    canRead: true,
    canWrite: false,
    canExecute: true,
  },
};

const OPERATIONS = {
  read:    { permission: 'canRead',    deniedMsg: 'Lectura no permitida' },
  write:   { permission: 'canWrite',   deniedMsg: 'Escritura no permitida' },
  execute: { permission: 'canExecute', deniedMsg: 'Ejecucion no permitida' },
};

export function resolvePath(input, { op }) {
  // 1. Validar operación
  if (!Object.hasOwn(OPERATIONS, op)) throw new Error(`Operacion no permitida: ${op}`);
  // 2. Validar tipo de entrada
  if (typeof input !== 'string') throw new Error('La ruta debe ser una cadena de texto.');
  // 3. Bloquear Null Bytes (\0)
  if (input.includes('\0')) throw new Error('Entrada malformada: contiene caracteres nulos.');
  // 4. Extracción y validación estricta de Namespace / Suffix
  let ns = 'workspace';
  let rel = input;
  if (input.includes(':')) {
    const parts = input.split(':');
    if (parts.length > 2) throw new Error(`Sintaxis de namespace o sufijo inválida: ${input}`);
    [ns, rel] = parts;
  } else {
    rel = input.replace(/^\/+/, '');
  }
  // 5. Validar Namespace y Permisos
  if (!Object.hasOwn(ACCESS_PROFILE, ns)) throw new Error(`Namespace desconocido: ${ns}`);
  const { permission, deniedMsg } = OPERATIONS[op];
  if (!ACCESS_PROFILE[ns][permission]) throw new Error(`${deniedMsg} en ${ns}`);
  // 6. Rechazar rutas absolutas de Windows, POSIX o rutas UNC de red
  if (
    path.isAbsolute(rel) ||
    /^[a-zA-Z]:/.test(rel) ||
    rel.startsWith('\\\\') ||
    rel.startsWith('//')
  ) {
    throw new Error(`Ruta absoluta o de red no permitida en sandbox: ${rel}`);
  }
  // 7. Normalización de separadores para validar traversal léxico
  const normalizedRel = rel.replace(/\\/g, '/');
  const segments = normalizedRel.split('/');
  // Rechazar si algún segmento intenta salir mediante '..'
  if (segments.includes('..')) {
    // Si la ruta contiene '..', verificar si el camino resuelto intenta acceder al exterior
    const fakeBase = '/root';
    const fakeResolved = path.posix.normalize(path.posix.join(fakeBase, normalizedRel));
    if (!fakeResolved.startsWith('/root/') && fakeResolved !== '/root') {
      throw new Error(`Ruta fuera del sandbox: ${input}`);
    }
    // Si la ruta contiene '..' y trata de re-ingresar al directorio raíz usando su propio nombre
    if (normalizedRel.startsWith('../') || normalizedRel.startsWith('..')) {
      throw new Error(`Escape de namespace mediante traversal: ${input}`);
    }
  }
  // 8. Resolver la ruta absoluta real dentro del sistema
  const rootAbs = ACCESS_PROFILE[ns].root;
  const abs = path.resolve(rootAbs, rel);
  // 9. Verificación estricta de Path Traversal frente a rootAbs
  const relCheck = path.relative(rootAbs, abs);
  if (
    relCheck === '..' ||
    relCheck.startsWith(`..${path.sep}`) ||
    relCheck.startsWith('../') ||
    path.isAbsolute(relCheck)
  ) {
    throw new Error(`Ruta fuera del sandbox: ${input}`);
  }
  return { abs, ns, rel };
}

export async function safeReal(abs, rootAbs) {
  async function resolveExistingReal(targetPath) {
    try {
      return await realpath(targetPath);
    } catch (err) {
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        const parent = path.dirname(targetPath);
        if (parent === targetPath) return targetPath;
        const realParent = await resolveExistingReal(parent);
        return path.join(realParent, path.basename(targetPath));
      }
      throw err;
    }
  }

  const real = await resolveExistingReal(abs);
  const realRoot = await realpath(rootAbs);
  const rel = path.relative(realRoot, real);
  if (
    rel === '..' ||
    rel.startsWith(`..${path.sep}`) ||
    rel.startsWith('../') ||
    path.isAbsolute(rel)
  ) {
    throw new Error('Symlink o escape de directorio detectado fuera de la raíz');
  }

  return real;
}
