// @ts-nocheck
/**
 * Arnés Mínimo para Agentes IA con gestión de plan
 * ----------------------------------------------------
 * Fase 1: PLANIFICACIÓN → el modelo devuelve un plan (JSON) con tareas.
 * Fase 2: EJECUCIÓN     → bucle secuencial, una tarea cada vez.
 * - Contexto local (plan-state.json) con tareas hechas y pendientes.
 * - Sin dependencias externas (solo Node.js nativo).
 */

import { namedToolfunc } from './agent-named-tools.js';
import {
  invokeModel,
  loadSkills,
  buildSystemPrompt,
  buildToolDeclarations,
  executeToolCall,
  executeToolCalls,
  toGeminiTools,
} from './utils.js';
import { ACCESS_PROFILE } from './sandbox.js';

// ============================================================================
// PROMPTS
// ============================================================================

// Reglas comunes (las tuyas de siempre)
const RULES_BASE = `
Eres un agente asistente útil. Responde en el idioma del usuario.

REGLAS DE OPERACIÓN:
- Para escribir o leer ficheros utiliza el prefijo 'workspace:'.
- Para ejecutar cualquier skill utiliza el patrón: 'skills:scripts/run.js'.
- Si vas a usar una herramienta o skill cuyos argumentos o esquema NO conoces previamente en la descripción de la herramienta, DEBES leer su archivo SKILL.md usando "read_file".
- Si la acción y sus argumentos ya están claros en la descripción de la herramienta, puedes invocarla directamente sin leer el SKILL.md.
- IMPORTANTE: no reintentes la ejecución de scripts si fallan; termina INMEDIATAMENTE devolviendo el error.
`;

// PROMPT 1: planificador (no ejecuta nada, solo planifica)
const PLANNER_PROMPT = `${RULES_BASE}
ROL: PLANIFICADOR de tareas de desarrollo.

Tu única misión es crear un plan de actuación para cumplir el objetivo del usuario.

REGLAS DEL PLAN:
- Divide el objetivo en tareas pequeñas y lineales.
- Máximo 8 tareas. Sin tareas redundantes.
- Las tareas se ejecutan en orden, de forma secuencial y sin dependencias entre ellas.
- Cada tarea debe poder resolverse con UNA sola acción: write_file, read_file, call_named_tool, etc.
- Descripciones concretas y autocontenidas (indica rutas, nombres, datos necesarios).
- No crees directorios porque se crean automáticamente al grabar archivos.

FORMATO DE RESPUESTA: 
- Responde SOLO con JSON válido, sin texto adicional ni markdown.
- El formato debe ser: 
  {
    "goal":"objetivo resumido",
    "tasks":[
      {"id":1, "title":"...", "description":"..."},
      {"id":2, "title":"...", "description":"..."}
    ]
  }
`;

// PROMPT 2: ejecutor de tareas (una tarea por llamada)
const EXECUTOR_PROMPT = `${RULES_BASE}

ROL: EJECUTOR.
Eres un desarrollador de software especializado en ejecutar tareas de desarrollo de manera eficiente. Recibes el objetivo global, las tareas ya completadas (con su resultado) y la tarea ACTUAL.
- Realiza ÚNICAMENTE la tarea actual con UNA sola acción.
- No hagas tareas futuras ni repitas las ya completadas.
- Al terminar responde con un resumen breve (máx. 3 líneas) del resultado, incluyendo datos útiles para tareas posteriores (rutas, ids, valores).
- Si la tarea falla, responde empezando exactamente por "ERROR:" seguido de la causa.
- Para html usa la hoja de estilos de Tabler: https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/css/tabler.min.css"
`;

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
  skillsDir: ACCESS_PROFILE.skills.root,
  maxStepsPerTask: 3,
  loopDelay: 1500,
  maxOutputLength: 20_000,
  apiEndpoint: 'http://localhost:3000/api/gemini',
  mpcEndpoint: 'https://vue-reactive-poc-app.vercel.app/api/mcp/mcp',
  stateFile: './.harness/plan-state.json',
  taskFile: './.harness/task.txt',
  debugSystemPrompt: false,
};

const line = '▬'.repeat(60);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// CONTEXTO LOCAL (estado del plan)
// ============================================================================
async function saveState(state) {
  const toolContext = { 
    name: 'write_file', 
    args: { 
      path: CONFIG.stateFile, 
      content: JSON.stringify(state, null, 2) 
    } 
  };
  await executeToolCall(toolContext);
}

async function loadState() {
  const toolContext = { 
    name: 'read_file', 
    args: { 
      path: CONFIG.stateFile 
    } 
  }; 
  const raw = await executeToolCall(toolContext);
  return JSON.parse(raw);
}

async function loadHarnessTaskFile(taskFile) {
  const toolContext = {
    name: 'read_file',
    args: {
      path: taskFile
    }
  };
  return await executeToolCall(toolContext);
}

function buildTaskContext(state, task) {
  const done = state.tasks.filter((t) => t.status === 'done');
  const remaining = state.tasks.filter((t) => t.status === 'pending' && t.id !== task.id);
  return [
    `OBJETIVO GLOBAL: ${state.goal}`,
    '',
    'TAREAS COMPLETADAS:',
    done.length ? done.map((t) => `- [${t.id}] ${t.description} → ${t.result}`).join('\n') : '(ninguna)',
    '',
    'TAREAS RESTANTES (NO las hagas ahora):',
    remaining.length ? remaining.map((t) => `- [${t.id}] ${t.description}`).join('\n') : '(ninguna)',
    '',
    `TAREA ACTUAL [${task.id}]: ${task.description}`,
  ].join('\n');
}

// ============================================================================
// UTILIDADES
// ============================================================================
const textOf = (parts) => parts.filter((p) => p.text).map((p) => p.text).join('');

const track = (stats, response) => {
  const u = response.usageMetadata;
  stats.push({
    promptTokenCount: u?.promptTokenCount ?? 0,
    candidatesTokenCount: u?.candidatesTokenCount ?? 0,
    totalTokenCount: u?.totalTokenCount ?? 0,
  });
};

// ============================================================================
// FASE 1: PLANIFICACIÓN
// ============================================================================
async function createPlan(userTask, skills, stats) {
  const systemPrompt = buildSystemPrompt(skills, PLANNER_PROMPT);
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userTask }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
      responseMimeType: 'application/json',
    },
  };
  const response = await invokeModel(payload, CONFIG.apiEndpoint);
  const plan = JSON.parse(response);
  return {
    goal: plan.goal ?? userTask,
    status: 'running',
    tasks: plan.tasks.map((t, i) => ({
      id: t.id ?? i + 1,
      description: t.description,
      status: 'pending',
      result: null,
      attempts: 0,
    })),
  };
}

// ============================================================================
// FASE 2: EJECUCIÓN DE UNA TAREA
// ============================================================================
async function runTask(state, task, ctx) {
  const { systemPrompt, tools, mcpRoutes, stats } = ctx;
  // Historial LOCAL a la tarea: cada tarea empieza limpia (ahorra tokens)
  const messages = [{ role: 'user', parts: [{ text: buildTaskContext(state, task) }] }];
  let acted = false; // ¿ya se ejecutó la acción real de la tarea?

  for (let step = 1; step <= CONFIG.maxStepsPerTask; step++) {
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages,
      tools: toGeminiTools(tools),
      toolConfig: { functionCallingConfig: { mode: acted ? 'NONE' : 'ANY' } },
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, topP: 0.95, topK: 40 },
      functionCall: true,
    };
    const response = await invokeModel(payload, CONFIG.apiEndpoint);
    track(stats, response);
    const modelContent = response.candidates?.[0]?.content;

    if (!modelContent) throw new Error('Sin contenido');
    const parts = modelContent.parts ?? [];
    messages.push({ role: 'model', parts });

    const toolCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    // Modo NONE: el texto es el resumen final de la tarea
    if (acted) return textOf(parts) || '(sin resumen)';
    // Red de seguridad por si el proxy no reenvía toolConfig
    if (toolCalls.length === 0) {
      console.log(response);
      messages.push({
        role: 'user',
        parts: [{ text: 'Debes llamar a una herramienta para completar la tarea. No respondas solo con texto.' }],
      });
      continue;
    }
    const functionResponses = await executeToolCalls(
      toolCalls, mcpRoutes, namedToolfunc, CONFIG.maxOutputLength
    );
    messages.push({ role: 'user', parts: functionResponses });
    if (!toolCalls.every((c) => c.name === 'read_file')) acted = true;
    await sleep(CONFIG.loopDelay);
  }
  throw new Error(`La tarea ${task.id} superó el máximo de pasos (${CONFIG.maxStepsPerTask})`);
}

// ============================================================================
// AGENTE
// ============================================================================
async function runAgent() {

  console.clear();
  console.log(line + '\n📄 Configuración:\n' + line);
  console.log(JSON.stringify(CONFIG, null, 2));

  const userTask = process.argv.slice(2).join(' ');
  if (!userTask) {
    console.log('\n' + line);
    console.log('⚠️  Uso incorrecto: node agent.js "Describa la tarea aquí"\n');
    process.exit(1);
  }
  console.log('\n' + line + '\n❓ Objetivo del usuario: ' + userTask + '\n' + line);

  const skills = await loadSkills(ACCESS_PROFILE.skills.root);
  const mcpRoutes = new Map();
  const tools = await buildToolDeclarations(mcpRoutes, CONFIG.mpcEndpoint);
  const stats = [];
  let state;

  try {
    // ============================================================================
    // FASE 1: plan
    // ============================================================================
    console.log('\n🧭 Fase 1: generando plan...');
    if(userTask === 'use:file'){
      const objective = await loadHarnessTaskFile(CONFIG.taskFile);
      state = await createPlan(objective, skills, stats);
      await saveState(state);
    }
    else if(userTask === 'resume'){
      state = await loadState();
      console.log(state);
      state.tasks = state.tasks.filter((t) => t.status !== 'done');
    } 
    else{
      state = await createPlan(userTask, skills, stats);
      await saveState(state);
    }
    state.tasks.forEach((t) => console.log(`   ${t.id}. ${t.description}`));

    // ============================================================================
    // FASE 2: ejecución
    // ============================================================================
    console.log('\n🛠️  Fase 2: ejecutando tareas...');
    const systemPrompt = buildSystemPrompt(skills, EXECUTOR_PROMPT);
    if (CONFIG.debugSystemPrompt) console.log(systemPrompt);
    const ctx = { systemPrompt, tools, mcpRoutes, stats };

    for (const task of state.tasks) {
      console.log(`\n⚡ Tarea ${task.id}/${state.tasks.length}: ${task.description}`);
      try {
        const result = await runTask(state, task, ctx);
        if (result.trim().startsWith('ERROR:')) throw new Error(result.trim());
        task.status = 'done';
        task.result = result;
        console.log(`   ✔ ${result}`);
      } catch (error) {
        task.status = 'failed';
        task.result = error.message;
        state.status = 'failed';
        saveState(state);
        console.error(`   ✖ ${error.message}`);
        break; // sin reintentos: se detiene en el primer fallo
      }
      saveState(state);
    }

    if (state.status !== 'failed') state.status = 'completed';
    saveState(state);
  } catch (error) {
    console.error('❌ Error al ejecutar el agente:\n', error.message);
  }

  // ---------------- Resumen ----------------
  console.log('\n✅ El agente ha finalizado.' + (state ? ` Estado: ${state.status}` : '') + '\n');
  console.log('📊 Estadísticas de tokens:');
  stats.forEach((s, i) =>
    console.log(`- Llamada ${i + 1} → entrada: ${s.promptTokenCount}, salida: ${s.candidatesTokenCount}, total: ${s.totalTokenCount}`)
  );
  const sum = (k) => stats.reduce((a, s) => a + s[k], 0);
  console.log(`- Totales     → entrada: ${sum('promptTokenCount')}, salida: ${sum('candidatesTokenCount')}, total: ${sum('totalTokenCount')}\n`);
}

runAgent().catch((error) => {
  console.error('❌ Error no controlado en la ejecución del agente:', error.message);
  process.exit(1);
});
