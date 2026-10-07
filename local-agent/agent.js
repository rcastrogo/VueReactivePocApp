// @ts-nocheck
/**
 * Arnés Mínimo para Agentes IA
 * ----------------------------------------------------
 * - Soporte para Skills con Progressive Disclosure.
 * - Integración con Servidores MCP.
 * - Uso de Vanilla JS / Node.js nativo (sin SDK de Anthropic).
 */
import { namedToolfunc } from './agent-named-tools.js';

import {
  invokeModel,
  loadSkills,
  buildSystemPrompt,
  buildToolDeclarations,
  executeToolCalls,
  toGeminiTools,
} from './utils.js';
import { ACCESS_PROFILE } from './sandbox.js';

const SYSTEM_PROMPT_BASE = `
Eres un agente asistente útil. Responde en el idioma del usuario.

REGLAS DE OPERACIÓN:
- Para escribir o leer ficheros utiliza el prefijo 'workspace:'.
- Para ejecutar cualquier skill utiliza el patrón: 'skills:scripts/run.js'.
- Si vas a usar una herramienta o skill cuyos argumentos o esquema NO conoces previamente en la descripción de la herramienta, DEBES leer su archivo SKILL.md usando "read_file".
- Si la acción y sus argumentos ya están claros en la descripción de la herramienta, puedes invocarla directamente sin leer el SKILL.md.
- IMPORTANTE: no reintentes la ejecución de scripts si fallan; termina INMEDIATAMENTE devolviendo el error.
`

// ============================================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================================
const CONFIG = {
  skillsDir: ACCESS_PROFILE.skills.root,
  maxIterations: 10,
  loopDelay: 1500, // Delay entre iteraciones del bucle principal en milisegundos
  maxOutputLength: 20_000,
  apiEndpoint: 'http://localhost:3000/api/gemini',
  mpcEndpoint: 'https://vue-reactive-poc-app.vercel.app/api/mcp/mcp',
  debugSystemPrompt: false
};

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
  const tools = await buildToolDeclarations(mcpRoutes, CONFIG.mpcEndpoint);
  const systemPrompt = buildSystemPrompt(skills, SYSTEM_PROMPT_BASE);
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
      const response = await invokeModel(payload, CONFIG.apiEndpoint);
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
      const functionResponses = await executeToolCalls(
        toolCalls,
        mcpRoutes,
        namedToolfunc,
        CONFIG.maxOutputLength
      );
      // ============================================================
      // 7. Añadir los resultados al historial
      // ============================================================
      messages.push({ role: 'user', parts: functionResponses });

      await new Promise(resolve => setTimeout(resolve, CONFIG.loopDelay));

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