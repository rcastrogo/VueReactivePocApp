// @ts-nocheck
/**
 * Arnés Mínimo para Agentes IA
 * ----------------------------------------------------
 * - Soporte para Skills con Progressive Disclosure.
 * - Integración con Servidores MCP.
 * - Uso de Vanilla JS / Node.js nativo (sin SDK de Anthropic).
 */

import { readdir, readFile, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { type } from 'node:os';
import test from 'node:test';
import { ACCESS_PROFILE, resolvePath, safeReal } from './sandbox.js'
import { namedToolfunc } from './agent-named-tools.js'

const execPromise = promisify(execFile);

const SYSTEM_PROMPT_BASE = `
Eres un agente asistente útil. Responde en el idioma del usuario.

REGLAS DE OPERACIÓN:
- Para escribir o leer ficheros utiliza el prefijo 'workspace:'.
- Para ejecutar cualquier skill utiliza el patrón: 'skills:scripts/run.js'.
- ANTES de ejecutar el run.js de una skill o de invocar una herramienta por su nombre, DEBES leer su archivo SKILL.md usando "read_file" para saber qué argumentos pasarle.
- IMPORTANTE: no reintentes la ejecución de scripts si fallan; termina INMEDIATAMENTE devolviendo el error.
`

// ============================================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================================
const CONFIG = {
  skillsDir: ACCESS_PROFILE.skills.root,
  maxIterations: 3,
  maxOutputLength: 20_000,
  apiEndpoint: 'http://localhost:3000/api/gemini',
  mpcEndpoint: 'https://vue-reactive-poc-app.vercel.app/api/mcp/mcp',
  debugSystemPrompt: false
};

const SCRIPT_INTERPRETERS = {
  '.js': 'node',
};

// ============================================================================
// INVOCACIÓN DEL MODELO
// ============================================================================
async function invokeModel(payload) {

  const response = await fetch(CONFIG.apiEndpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
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
function parseFrontmatter(markdownContent) {
  const frontmatterMatch = markdownContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const metadata = {};
  if (frontmatterMatch){
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
async function loadSkills(directoryPath) {
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

function buildSystemPrompt(skills = []) {
  if (skills.length) {
    const skillListText = skills
      .map(skill => `- ${skill.name}: ${skill.description} Documentación: ${skill.file}/SKILL.md`)
      .join('\n');

    return [
      SYSTEM_PROMPT_BASE,
      'SKILLS DISPONIBLES:',
      skillListText,
    ].join('\n\n');
  }
  return SYSTEM_PROMPT_BASE + '\n\nNo hay skills disponibles actualmente.';
}

async function buildToolDeclarations(mcpRoutes = new Map()) {
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
      Acciones conocidas: 
        - "Envío de mensajes" usa tool='send-message'
        - "Consulta de eventos" usa tool='query-events'
        - "Reserva de salas" usa tool='reserve-room'
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
  // ===========================================================================
  // Registrar herramientas MCP
  // ===========================================================================  
  const mcpTools = await getMCPToolDeclarations(CONFIG.mpcEndpoint);
  if (mcpTools && mcpTools.length){
    const prefixedMcpTools = mcpTools.map(tool => ({ ...tool, name: 'mpc_usuario__' + tool.name }));
    tools.push(...prefixedMcpTools);
    prefixedMcpTools.forEach(tool => mcpRoutes.set(tool.name, CONFIG.mpcEndpoint));
    console.log(`Herramientas MCP [mpc_usuario]: ${mcpTools.map(tool => tool.name).join(', ')}`);  
  }

  return tools;
}

async function getMCPToolDeclarations(endpoint = '') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({method: 'tools/list'}),
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

async function executeMCPTools(endpoint, name, args) {
  console.log(`Ejecutando herramienta MCP: ${name} con argumentos: ${JSON.stringify(args)}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
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
  if(res?.error) {
    const error_message = `Error devuelto por la herramienta MCP: ${JSON.stringify(res.error)}`;
    console.error(error_message);
    return error_message;
  }
  if (res?.result?.isError) return contentToText(res.result.content);
  const content = res?.result?.content;
  if (!Array.isArray(content) || content.length === 0) return '<sin salida>';
  return contentToText(content);  
}

function contentToText(content) {
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

// ============================================================================
// EJECUCIÓN DE HERRAMIENTAS NATIVAS
// ============================================================================

function truncateOutput(text, length = CONFIG.maxOutputLength) {
  let textStr = text;
  if( typeof text === 'object' ) textStr = JSON.stringify(text);
  if (textStr.length <= length) return textStr;
  return textStr.slice(0, length) + '\n[... Salida truncada por límite de tamaño]';
}

function assertString(value, message){
  if (typeof value === 'string') return true;
  if(message) throw new Error(message);
}

function assertArray(value, message) {
  if (Array.isArray(value)) return true;
  if(message) throw new Error(message);
}

function assertTrue(value, message) {
  if (value) return true;
  if(message) throw new Error(message);
}

async function writeWorkspaceFile(filePath, content) {
  const { abs, ns } = resolvePath(filePath, { op: 'write' });
  const dir = path.dirname(abs);
  await safeReal(dir, ACCESS_PROFILE[ns].root);
  await mkdir(dir, { recursive: true });
  await writeFile(abs, content, 'utf8');
}

/**
 * Ejecuta la herramienta seleccionada por el modelo.
 */
async function executeToolCall(toolCall, mcpRoutes = new Map()) {

  const { name, args = {} } = toolCall;
  // ================================================================
  // Leer archivo
  // ================================================================
  if (name === 'read_file') {
    assertString(args.path, 'read_file.path debe ser un string.');
    const { abs, ns, rel } = resolvePath(args.path, { op: 'read' });
    await safeReal(abs, ACCESS_PROFILE[ns].root);
    return await readFile(abs, 'utf8');    
  }
  // ===============================================================================
  // Invocar herramienta por nombre
  // ===============================================================================
  if (name === 'call_named_tool') {
    assertString(args.tool, 'call_named_tool.tool debe ser un string.');
    assertString(args.args, 'call_named_tool.args debe ser un string en formato JSON.');
    try {
      return await namedToolfunc(args);
    } catch (err) {
      throw new Error(`Error ejecutando la herramienta: ${err.message}`);
    }
  }

  // ===============================================================================
  // Ejecutar script
  // ===============================================================================
  if (name === 'run_script') {
    // =============================================================================
    // Validar argumentos del script
    // =============================================================================
    assertString(args.script, 'run_script: script debe ser un string.');
    assertArray(args.args, 'run_script: args debe ser un array.');
    for (const argument of args.args)
      assertString(argument, 'Todos los argumentos del script deben ser strings.');
    // =============================================================================
    // Validar extensión del script
    // =============================================================================
    const extension = path.extname(args.script);
    const interpreter = SCRIPT_INTERPRETERS[extension];
    if (!interpreter) {
      throw new Error(
        `Extensión no permitida '${extension}'. ` +
        `Use: ${Object.keys(SCRIPT_INTERPRETERS).join(', ')}`
      );
    }
    // =============================================================================
    // Validar existencia y accesibilidad del script
    // =============================================================================
    // console.log(`Resolviendo ruta para el script: ${args.script}`);
    const { abs } = resolvePath(args.script, { op: 'execute' });
    let scriptPath;
    try {
      // console.log(`Resolviendo ruta real para el script: ${abs}`);
      scriptPath = await realpath(abs);
    } catch (err) {
      return err.code === 'ENOENT'
        ? 'ERROR: El fichero de script no existe'
        : `ERROR: ${err.message}`;
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

  // ====================================================================
  // Escribir un archivo
  // ====================================================================  
  if (name === 'write_file') {
    assertString(args.path, 'write_file.path debe ser un string.');
    assertString(args.content, 'write_file.content debe ser un string.');
    await writeWorkspaceFile(args.path, args.content);
    return 'Archivo escrito correctamente';
  }

  // ============================================================================
  // Escribir varios archivos
  // ============================================================================
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

  // ===============================================================================
  // Ejecutar herramienta MCP si existe en la ruta
  // ===============================================================================
  const mcpRoute = mcpRoutes.get(name);
  if (mcpRoute) {
    const realToolName = name.split('__').pop();
    const text = await executeMCPTools(mcpRoute, realToolName, args);
    return text;
  }

  throw new Error(`Herramienta no reconocida: ${name}`);

}

function toGeminiTools(tools) {
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

async function runAgent() {

  console.clear();
  console.log('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
  console.log('📄 Configuración:');
  console.log('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
  console.log(JSON.stringify(CONFIG, null, 2));

  const userTask = process.argv.slice(2).join(' ');
  if (!userTask) {
    console.log('\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
    console.log('⚠️  Uso incorrecto: node agent.js "Describa la tarea aquí"\n');
    process.exit(1);
  }

  console.log('\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
  console.log('❓ Tarea del usuario: ' + userTask);
  console.log('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');

  const skills = await loadSkills(ACCESS_PROFILE.skills.root);
  const mcpRoutes = new Map();
  const tools = await buildToolDeclarations(mcpRoutes);  
  const systemPrompt = buildSystemPrompt(skills);
  const messages = [
    { 
      role: 'user', 
      parts: [{ text: userTask }]
    }
  ];
  const stats = [];

  if(CONFIG.debugSystemPrompt) console.log(systemPrompt);

  try {
    let iteration = 0;
    while (iteration < CONFIG.maxIterations) {
      iteration++;
      console.log(`⚡ Iteración ${iteration}`);
      // ====================================================================================
      // 1. Petición al LLM
      // ====================================================================================
      const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        tools: toGeminiTools(tools),
        generationConfig: {
          temperature: 0.2,       // Baja para que el HTML sea consistente
          maxOutputTokens: 1000,  // Limita la longitud máxima de la respuesta (ahorra tokens)
          topP: 0.95,             // Controla la diversidad del vocabulario
          topK: 40,               // Limita el número de opciones de palabras que considera
        },
        functionCall: true
      };
      // =====================================================================
      // 1.1. invocación del modelo
      // =====================================================================
      const response = await invokeModel(payload);
      // console.log('Resultado del modelo:', JSON.stringify(response, null, 2));
      const usage = response.usageMetadata;
      stats.push({
        promptTokenCount: usage?.promptTokenCount ?? 0,
        candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
        totalTokenCount: usage?.totalTokenCount ?? 0
      });
      // ============================================================
      // 2. Obtener las partes generadas por Gemini
      // ============================================================
      const modelContent = response.candidates?.[0]?.content;
      if (!modelContent) throw new Error('Sin contenido');
      const parts = modelContent.parts ?? [];
      // ============================================================
      // 3. Guardar la respuesta del modelo en el historial
      // ============================================================
      messages.push({ role: 'model', parts });
      // ============================================================
      // 4. Buscar llamadas a herramientas
      // ============================================================
      const toolCalls = parts.filter(part => part.functionCall)
                             .map(part => part.functionCall);
      // ============================================================
      // 5. Si no hay tool calls, tenemos respuesta final
      // ============================================================
      if (toolCalls.length === 0) {
        const text = parts
          .filter(part => part.text)
          .map(part => part.text)
          .join('');
          console.log('🤖 ' + text);
        break;
      }
      // ============================================================
      // 6. Ejecutar las herramientas solicitadas por el modelo
      // ============================================================
      const functionResponses = [];
      for (const call of toolCalls) {
        console.log(`🔧 Tool: ${call.name}`);
        console.log('👉 ID  :', call.id );
        console.log('👉 Args: ' + JSON.stringify(call.args, null, 2));
        try {
          // --------------------------------------------------------
          // Ejecutamos nuestra herramienta
          // --------------------------------------------------------
          const rawResult = await executeToolCall(call, mcpRoutes);
          console.log('📃 Resultado');
          console.log(truncateOutput(rawResult, 1_000));
          // --------------------------------------------------------
          // Creamos la respuesta para el modelo
          // --------------------------------------------------------
          functionResponses.push({
            functionResponse: {
              name: call.name,
              id: call.id,
              response: {
                result: truncateOutput(rawResult)
              }
            }
          });
        } catch (error) {
          console.error(`❌ Error ejecutando ${call.name}:`, error);
          if (call.name === 'run_script') throw error;
          // -------------------------------------------------------------------------
          // También devolvemos los errores a modelo para que pueda decidir qué hacer
          // -------------------------------------------------------------------------
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
      // ============================================================
      // 7. Añadir los resultados al historial
      // ============================================================
      messages.push({ role: 'user', parts: functionResponses });

      await new Promise(resolve => setTimeout(resolve, 500));

    }
  } catch (error) {
    console.error('❌ Error al ejecutar el agente:\n', error.message);
  }
  console.log('\n✅ El agente ha finalizado.\n');
  console.log('📊 Estadísticas de tokens:');
  stats.forEach((stat, index) => {
    console.log(
      `- Iteración ${index + 1} → entrada: ${stat.promptTokenCount}, ` +
      `salida: ${stat.candidatesTokenCount}, ` +
      `total: ${stat.totalTokenCount}`
    );
  });
  const totalInput = stats.reduce((sum, stat) => sum + stat.promptTokenCount, 0);
  const totalOutput = stats.reduce((sum, stat) => sum + stat.candidatesTokenCount, 0);
  const total = stats.reduce((sum, stat) => sum + stat.totalTokenCount, 0);
  console.log(
    `- Totales     → entrada: ${totalInput}, salida: ${totalOutput}, total: ${total}`
  );
  console.log('');
  // console.log(JSON.stringify(messages, null, 2));
}

// ============================================================================
// PUNTO DE ENTRADA
// ============================================================================
runAgent().catch((error) => {
  console.error('❌ Error no controlado en la ejecución del agente:', error.message);
  process.exit(1);
});