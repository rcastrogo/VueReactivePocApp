import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCESS_PROFILE, resolvePath, safeReal } from './sandbox.js';

async function runTests() {
  
  async function validate(input, op) {
    assert.equal(typeof input, 'string', 'La ruta debe ser un string.');
    const result = resolvePath(input, { op });
    const target = op === 'write' ? path.dirname(result.abs) : result.abs;
    await safeReal(target, ACCESS_PROFILE[result.ns].root);
    if (op === 'write') await safeReal(result.abs, ACCESS_PROFILE[result.ns].root);
    return result;
  }

  await test('Perfiles permitidos y permisos', () => {
    assert.deepEqual(Object.keys(ACCESS_PROFILE).sort(), ['skills', 'workspace']);
    assert.equal(ACCESS_PROFILE.workspace.canRead, true);
    assert.equal(ACCESS_PROFILE.workspace.canWrite, true);
    assert.equal(ACCESS_PROFILE.skills.canRead, true);
    assert.equal(ACCESS_PROFILE.skills.canWrite, false);
    assert.equal(ACCESS_PROFILE.workspace.canExecute, false);
    assert.equal(ACCESS_PROFILE.skills.canExecute, true);
  });

  await test('Ejecucion exclusiva de skills', async context => {
    for (const input of ['skills:run.js', 'skills:sample-skill/scripts/sample.js', 'skills:carpeta/../run.js']) {
      await context.test(`Permitido: ${input}`, async () => {
        const result = await validate(input, 'execute');
        assert.equal(result.ns, 'skills');
      });
    }
    for (const input of [
      'workspace:arbitrario.js', 'arbitrario.js', './arbitrario.js',
      'skills:../src/arbitrario.js', 'skills:carpeta/../../src/arbitrario.js',
      'skills:..\\src\\arbitrario.js', 'skills:/run.js',
      'other:run.js', 'constructor:run.js', '__proto__:run.js',
      'skills:run.js:extra', 'skills:run\0.js',
    ]) {
      await context.test(`Rechazado: ${JSON.stringify(input)}`, async () => {
        await assert.rejects(() => validate(input, 'execute'));
      });
    }
    for (const op of ['', 'exec', 'delete', undefined, null]) {
      await context.test(`Operacion invalida: ${JSON.stringify(op)}`, () => {
        assert.throws(() => resolvePath('skills:run.js', { op }), /Operacion no permitida/);
      });
    }
  });

  await test('Rutas internas y normalizacion', async context => {
    const validPaths = [
      ['archivo.txt', 'archivo.txt'],
      ['carpeta/archivo.txt', 'carpeta/archivo.txt'],
      ['carpeta\\archivo.txt', 'carpeta/archivo.txt'],
      ['./archivo.txt', 'archivo.txt'],
      ['carpeta/../archivo.txt', 'archivo.txt'],
      ['carpeta/./sub/../archivo.txt', 'carpeta/archivo.txt'],
      ['carpeta//archivo.txt', 'carpeta/archivo.txt'],
      ['carpeta con espacios/archivo.txt', 'carpeta con espacios/archivo.txt'],
      ['.oculto', '.oculto'],
      ['carpeta/%2e%2e/archivo.txt', 'carpeta/%2e%2e/archivo.txt'],
    ];
    for (const ns of ['workspace', 'skills']) {
      for (const op of ns === 'workspace' ? ['read', 'write'] : ['read']) {
        for (const [input, expected] of validPaths) {
          await context.test(`${op}: ${ns}:${input}`, async () => {
            const result = await validate(`${ns}:${input}`, op);
            assert.equal(result.ns, ns);
            assert.equal(result.rel, input);
            assert.equal(result.abs, path.resolve(ACCESS_PROFILE[ns].root, expected));
          });
        }
      }
    }
    for (const input of ['', '.', 'workspace:', 'workspace:.', 'skills:', 'skills:.']) {
      await context.test(`Lectura del root: ${JSON.stringify(input)}`, async () => {
        const result = await validate(input, 'read');
        assert.equal(result.abs, ACCESS_PROFILE[result.ns].root);
      });
    }
    for (const op of ['read', 'write']) {
      await context.test(`Namespace implicito workspace: ${op}`, async () => {
        const result = await validate('carpeta/archivo.txt', op);
        assert.equal(result.ns, 'workspace');
        assert.equal(result.abs, path.join(ACCESS_PROFILE.workspace.root, 'carpeta', 'archivo.txt'));
      });
    }
  });

  await test('Traversal, rutas absolutas y escapes entre namespaces', async context => {
    const escapes = [
      '..', '../archivo.txt', '../../archivo.txt', 'carpeta/../../archivo.txt',
      '..\\archivo.txt', '..\\..\\archivo.txt', 'carpeta\\..\\..\\archivo.txt',
      '../skills/archivo.txt', '../src/archivo.txt', '../src-sibling/archivo.txt',
      'C:\\Windows\\System32\\archivo.txt', 'C:/Windows/System32/archivo.txt',
      '\\\\servidor\\recurso\\archivo.txt', '\\\\?\\C:\\Windows\\archivo.txt',
    ];
    for (const ns of ['workspace', 'skills']) {
      const root = ACCESS_PROFILE[ns].root;
      for (const op of ['read', 'write']) {
        for (const input of [...escapes, path.resolve(root, '..', 'sandbox.js'), `${root}-sibling/archivo.txt`]) {
          await context.test(`${op}: ${ns}:${input}`, async () => {
            await assert.rejects(() => validate(`${ns}:${input}`, op));
          });
        }
      }
    }
  });

  await test('Namespaces invalidos, entradas malformadas y permisos', async context => {
    const invalidPaths = [
      'other:archivo.txt', 'Workspace:archivo.txt', 'SKILLS:archivo.txt',
      ':archivo.txt', 'file:///C:/Windows/archivo.txt', 'https://example.com/archivo.txt',
      'constructor:archivo.txt', '__proto__:archivo.txt', 'toString:archivo.txt',
      'workspace:archivo.txt:stream', 'skills:archivo.js:extra',
      'workspace:archivo\0.txt', 'workspace:carpeta\0/archivo.txt',
      undefined, null, 42, {}, [], true,
    ];
    for (const op of ['read', 'write']) {
      for (const input of invalidPaths) {
        await context.test(`${op}: ${JSON.stringify(input)}`, async () => {
          await assert.rejects(() => validate(input, op));
        });
      }
    }
    for (const input of ['skills:', 'skills:archivo.js', 'skills:carpeta/archivo.js']) {
      await context.test(`skills no permite escribir: ${input}`, async () => {
        await assert.rejects(() => validate(input, 'write'), /Escritura no permitida/);
      });
    }
  });

  await test('safeReal: limites canonicos y enlaces existentes', async context => {
    for (const ns of ['workspace', 'skills']) {
      const root = ACCESS_PROFILE[ns].root;
      const realRoot = await realpath(root);
      await context.test(`${ns}: root existente`, async () => {
        assert.equal(await safeReal(root, root), realRoot);
      });
      await context.test(`${ns}: ruta interna sin necesidad de crearla`, async () => {
        const target = path.join(root, '__sandbox_route_validation__', 'archivo.txt');
        assert.equal(await safeReal(target, root), path.join(realRoot, '__sandbox_route_validation__', 'archivo.txt'));
      });
      for (const target of [path.dirname(root), `${root}-sibling/archivo.txt`]) {
        await context.test(`${ns}: fuera del root ${target}`, async () => {
          await assert.rejects(() => safeReal(target, root));
        });
      }
      const directories = [root];
      const externalLinks = [];
      while (directories.length) {
        const directory = directories.pop();
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const target = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) {
            try {
              const relativePath = path.relative(realRoot, await realpath(target));
              if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
                externalLinks.push(target);
              }
            } catch (error) {
              if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
            }
          } else if (entry.isDirectory()) {
            directories.push(target);
          }
        }
      }
      await context.test(`${ns}: symlinks externos existentes`, {
        skip: externalLinks.length === 0 ? 'No hay symlinks externos; no se crean fixtures.' : false,
      }, async () => {
        for (const target of externalLinks) {
          await assert.rejects(() => safeReal(target, root));
          if ((await stat(target)).isDirectory()) {
            await assert.rejects(() => safeReal(path.join(target, '__sandbox_route_validation__', 'archivo.txt'), root));
          }
        }
      });
    }
  });
}

// ============================================================================
// PUNTO DE ENTRADA
// ============================================================================
runTests().catch((error) => {
  console.error('❌ Error no controlado en la ejecución:', error.message);
  process.exit(1);
});