
import { existsSync } from 'node:fs';
import { readdir, readFile, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ACCESS_PROFILE, resolvePath, safeReal } from './sandbox.js';

const execPromise = promisify(execFile);
const SCRIPT_INTERPRETERS = {
  '.js': 'node',
};

// ============================================================================
// INVOCACIÓN DEL MODELO
// ============================================================================
export async function invokeModel(payload, url) {

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error API  (\(${response.status}):\)${errorBody}`);
  }
  return response.json();
}

// ============================================================================
// GESTIÓN DE SKILLS
// ============================================================================
export function parseFrontmatter(markdownContent) {
  const frontmatterMatch = markdownContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const metadata = {};
  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split(/\r?\n/);
    for (const line of lines) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex > 0) {
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
        metadata[key] = value;
      }
    }
  }
  return metadata;
}

// ============================================================================
// Carga todas las skills válidas dentro del directorio configurado
// ============================================================================
export async function loadSkills(directoryPath) {
  if (!existsSync(directoryPath)) return [];

  const discoveredSkills = [];
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFilePath = path.join(directoryPath, entry.name, 'SKILL.md');
    if (!existsSync(skillFilePath)) continue;

    const fileContent = await readFile(skillFilePath, 'utf8');
    const { name, description } = parseFrontmatter(fileContent);

    if (name && description) {
      discoveredSkills.push({
        name,
        description,
        file: `skills:${entry.name}`
      });
    }
  }

  return discoveredSkills;
}

export function buildSystemPrompt(skills = [], basePrompt = '') {
  if (skills.length) {
    const skillListText = skills
      .map(skill => `- ${skill.name}: ${skill.description} Documentación: ${skill.file}/SKILL.md`)
      .join('\n');

    return [
      basePrompt,
      'SKILLS DISPONIBLES:',
      skillListText,
    ].join('\n\n');
  }
  return basePrompt + '\n\nNo hay skills disponibles actualmente.';
}

export async function buildToolDeclarations(mcpRoutes = new Map(), mcpEndpoint = '') {
  const tools = [
    {
      name: 'read_file',
      description: 'Lee un archivo de texto. Soporta los prefijo \'workspace:\' | \'skills:\' para sandbox',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Escribe un archivo de texto en \'workspace:\'. IMPORTANTE: Para escribir varios archivos en una misma operación, usa write_files.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta del archivo.' },
          content: { type: 'string', description: 'Contenido del archivo.' }
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'write_files',
      description: 'Escribe varios archivos de texto en \'workspace:\' en una sola operación. Úsala cuando necesites crear o modificar varios archivos relacionados. Para un solo archivo usa write_file.',
      input_schema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            description: 'Lista de archivos que se escribirán.',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Ruta del archivo.' },
                content: { type: 'string', description: 'Contenido completo del archivo.' }
              },
              required: ['path', 'content']
            }
          }
        },
        required: ['files']
      }
    },
    {
      name: 'run_script',
      description: 'Ejecuta un script (.js) y devuelve su salida. El prefijo \'skills:\' es OBLIGATORIO.',
      input_schema: {
        type: 'object',
        properties: {
          script: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } },
        },
        required: ['script'],
      },
    }, {
      name: 'call_named_tool',
      description: `
      Invoca una herramienta por su nombre.
      Acciones conocidas y sus argumentos (pásalos como JSON string en 'args'):
        - "Envío de mensajes": tool='send-message', args={"to": string, "message": string}
        - "Consulta de eventos": tool='query-events', args={"date"?: string, "team"?: string}
        - "Reserva de salas": tool='reserve-room', args={"room_id": string, "time": string}
      `,
      input_schema: {
        type: 'object',
        properties: {
          tool: { type: 'string', description: 'Nombrede la herramienta a invocar.' },
          args: { type: 'string', description: 'Argumentos para la herramienta en formato JSON.' }
        },
        required: ['tool', 'args'],
      }
    }
  ];
  console.log(`Herramientas locales: ${tools.map(tool => tool.name).join(', ')}`);
  const mcpTools = mcpEndpoint ? await getMCPToolDeclarations(mcpEndpoint) : [];
  if (mcpTools && mcpTools.length) {
    const prefixedMcpTools = mcpTools.map(tool => ({ ...tool, name: 'mpc_usuario__' + tool.name }));
    tools.push(...prefixedMcpTools);
    prefixedMcpTools.forEach(tool => mcpRoutes.set(tool.name, mcpEndpoint));
    console.log(`Herramientas MCP [mpc_usuario]: ${mcpTools.map(tool => tool.name).join(', ')}`);
  }

  return tools;
}

export async function getMCPToolDeclarations(endpoint = '') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'tools/list' }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Error en la recuperación de herramientas del conector MCP: ${errorBody}`);
    return [];
  } else {
    const res = await response.json();
    return res.result?.tools ?? [];
  }
}

export async function executeMCPTools(endpoint, name, args) {
  console.log(`Ejecutando herramienta MCP: ${name} con argumentos: ${JSON.stringify(args)}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      }
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Error en la recuperación de herramientas del conector MCP: ${errorBody}`);
    return 'Error en la ejecución de la herramienta MCP';
  }

  const res = await response.json();
  if (res?.error) {
    const error_message = `Error devuelto por la herramienta MCP: ${JSON.stringify(res.error)}`;
    console.error(error_message);
    return error_message;
  }
  if (res?.result?.isError) return contentToText(res.result.content);
  const content = res?.result?.content;
  if (!Array.isArray(content) || content.length === 0) return '<sin salida>';
  return contentToText(content);
}

export function contentToText(content) {
  return content
    .map(block => {
      switch (block.type) {

        case 'text':
          return block.text ?? '';

        case 'image':
          return `[Imagen: ${block.mimeType ?? 'tipo desconocido'}]`;

        case 'audio':
          return `[Audio: ${block.mimeType ?? 'tipo desconocido'}]`;

        case 'resource': {
          const resource = block.resource;

          if (typeof resource?.text === 'string') {
            return resource.text;
          }

          if (resource?.blob) {
            return `[Recurso binario: ${resource.mimeType ?? 'tipo desconocido'}]`;
          }

          return '[Recurso MCP]';
        }

        case 'resource_link':
          return `[Recurso: ${block.name ?? block.uri ?? 'sin nombre'}]`;

        default:
          return `[Contenido MCP no soportado: ${block.type ?? 'desconocido'}]`;
      }
    })
    .filter(Boolean)
    .join('\n');
}

export function truncateOutput(text, length = 20_000) {
  let textStr = text;
  if (typeof text === 'object') textStr = JSON.stringify(text);
  if (textStr.length <= length) return textStr;
  return textStr.slice(0, length) + '\n[... Salida truncada por límite de tamaño]';
}

export function assertString(value, message) {
  if (typeof value === 'string') return true;
  if (message) throw new Error(message);
}

export function assertArray(value, message) {
  if (Array.isArray(value)) return true;
  if (message) throw new Error(message);
}

export function assertTrue(value, message) {
  if (value) return true;
  if (message) throw new Error(message);
}

export async function writeWorkspaceFile(filePath, content) {
  const { abs, ns } = resolvePath(filePath, { op: 'write' });
  const dir = path.dirname(abs);
  await safeReal(dir, ACCESS_PROFILE[ns].root);
  await mkdir(dir, { recursive: true });
  await writeFile(abs, content, 'utf8');
}

export async function executeToolCall(toolCall, mcpRoutes = new Map(), namedToolfunc) {
  const { name, args = {} } = toolCall;
  if (name === 'read_file') {
    assertString(args.path, 'read_file.path debe ser un string.');
    const { abs, ns } = resolvePath(args.path, { op: 'read' });
    await safeReal(abs, ACCESS_PROFILE[ns].root);
    return await readFile(abs, 'utf8');
  }
  if (name === 'call_named_tool' && namedToolfunc) {
    assertString(args.tool, 'call_named_tool.tool debe ser un string.');
    assertString(args.args, 'call_named_tool.args debe ser un string en formato JSON.');
    try {
      return await namedToolfunc(args);
    } catch (err) {
      throw new Error(`Error ejecutando la herramienta: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (name === 'run_script') {
    assertString(args.script, 'run_script: script debe ser un string.');
    assertArray(args.args, 'run_script: args debe ser un array.');
    for (const argument of args.args)
      assertString(argument, 'Todos los argumentos del script deben ser strings.');
    const extension = path.extname(args.script);
    const interpreter = SCRIPT_INTERPRETERS[extension];
    if (!interpreter) {
      throw new Error(
        `Extensión no permitida '${extension}'. ` +
        `Use: ${Object.keys(SCRIPT_INTERPRETERS).join(', ')}`
      );
    }
    const { abs } = resolvePath(args.script, { op: 'execute' });
    let scriptPath;
    try {
      scriptPath = await realpath(abs);
    } catch (err) {
      return err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT'
        ? 'ERROR: El fichero de script no existe'
        : `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }

    await safeReal(scriptPath, ACCESS_PROFILE.skills.root);
    const scriptStat = await stat(scriptPath);
    if (!scriptStat.isFile())
      return 'ERROR: La ruta indicada no es un archivo de script.';

    const { stdout, stderr } = await execPromise(
      interpreter,
      [scriptPath, ...(args.args || [])],
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      }
    );
    return stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
  }

  if (name === 'write_file') {
    assertString(args.path, 'write_file.path debe ser un string.');
    assertString(args.content, 'write_file.content debe ser un string.');
    await writeWorkspaceFile(args.path, args.content);
    return 'Archivo escrito correctamente';
  }

  if (name === 'write_files') {
    assertArray(args.files, 'write_files.files debe ser un array.');
    args.files.forEach(file =>
      assertString(file.path, 'Cada archivo debe tener path como string.') &&
      assertString(file.content, 'Cada archivo debe tener content como string.')
    )
    for (const file of args.files) {
      await writeWorkspaceFile(file.path, file.content);
    }
    return `${args.files.length} Archivos escritos correctamente.`;
  }

  const mcpRoute = mcpRoutes.get(name);
  if (mcpRoute) {
    const realToolName = name.split('__').pop();
    const text = await executeMCPTools(mcpRoute, realToolName, args);
    return text;
  }

  throw new Error(`Herramienta no reconocida: ${name}`);
}

export async function executeToolCalls(toolCalls, mcpRoutes = new Map(), namedToolfunc, maxOutputLength = 20_000) {
  const functionResponses = [];
  for (const call of toolCalls) {
    console.log(`🔧 Tool: ${call.name}`);
    console.log('👉 ID  :', call.id);
    console.log('👉 Args: ' + JSON.stringify(call.args, null, 2));
    try {
      const rawResult = await executeToolCall(call, mcpRoutes, namedToolfunc);
      console.log('📃 Resultado');
      console.log(truncateOutput(rawResult, 1_000));
      functionResponses.push({
        functionResponse: {
          name: call.name,
          id: call.id,
          response: {
            result: truncateOutput(rawResult, maxOutputLength)
          }
        }
      });
    } catch (error) {
      console.error(`❌ Error ejecutando ${call.name}:`, error);
      if (call.name === 'run_script') throw error;
      functionResponses.push({
        functionResponse: {
          name: call.name,
          id: call.id,
          response: {
            error: error instanceof Error ? error.message : String(error)
          }
        }
      });
    }
  }
  return functionResponses;
}

export function toGeminiTools(tools) {
  return [
    {
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || tool.inputSchema
      }))
    }
  ];
}
