// @ts-nocheck
async function invokeAzureModel(payload) {
  const url = '/api/azure'; // Ruta hacia tu Vercel Serverless Function
  const data = await rcg.http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}

rcg.ai = rcg.ai || {};
rcg.ai.azure = {
  /**
   * Genera una tarjeta HTML formateada con Tailwind usando Azure AI / Phi-4.
   * @param {Object} user Objeto con los datos del usuario.
   * @param {Object} [options] Opciones adicionales.
   * @returns {Promise<{ html: string }>}
   */
  generateProfile: async (user, options = {}) => {

    const isBaja = Boolean(user.fecha_de_baja);
    const estadoTexto = isBaja ? `Dado de baja (${user.fecha_de_baja})` : "Activo / En alta";

    const systemText = 'Eres un desarrollador experto en HTML y Tailwind. Tu salida es siempre código HTML puro.';

    const prompt = `
      Genera una tarjeta de perfil HTML para los datos del usuario.

      DATOS DE ENTRADA:
      - json: ${JSON.stringify(user)}

      INSTRUCCIONES DE DISEÑO:
      - Devuelve ÚNICAMENTE el fragmento HTML (sin markdown \`\`\`html, sin <html>, <head> o <body>).
      - Usa clases puras de Tailwind.
      - El aspecto debe ser en tonos azules y sobrio sin florituras. Asegúrate de que se ve bien el texto y el fondo. Sin avatares ni imágenes externas.
      - Muestra el nombre completo del usuario ("${user.nombre}").
      - Muestra el NIF del usuario ("${user.nif}").
      - Añade una sección para el estado del usuario ("${estadoTexto}").
      - Añade una sección con un texto resumen del usuario teniendo en cuenta sus propiedades.
      - Añade una sección con el significado, breve, de su nombre y su origen etimológico (si es posible deducirlo).
    `;
    
    const payload = {
      model:'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 500,
      top_p: 0.95
    };

    try {
      const data = await invokeAzureModel(payload);
      const html = (data.content ?? '')
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      return { html };
    } catch (error) {
      console.error('rcg.ai.azure.generateProfile Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  },
  /**
   * Procesa peticiones del usuario ejecutando lógica sobre la lista de usuarios y retornando JSON estructurado.
   * @param {string} userText 
   * @param {Array} users 
   * @param {Object} [options] 
   */
  handleUserPrompt: async (userText, users, options = {}) => {

    const systemText = `
      Eres el motor de lógica de una interfaz de usuarios. 
      Debes procesar la petición del usuario y usar la función 'handleModelResponse' para devolver los resultados estructurados.

      REGLAS ESTRICTAS:
      - 'userIds' y 'usersData' DEBEN SER SIEMPRE ARRAYS. Ejemplo: [3, 4, 5] o [].
      - NUNCA devuelvas los IDs concatenados como un solo entero (ejemplo incorrecto: [345678]).
      - Si la acción no modifica usuarios, 'usersData' debe ser [].
      - Si la acción es 'restaurar': devuelve 'userIds' como [] y 'usersData' como [], solo un mensaje en 'texto'.
      - Para seleccionar todos los usuarios, incluye todos los IDs en 'userIds'.
      - Mantén las fechas en formato ISO 8601 o null.
      - No inventes IDs ni usuarios inexistentes.
      - Si el usuario pide ordenar los usuarios, devuélvelos en 'userIds' en el orden solicitado.
      - Si el usuario pide un resumen, informe o agrupación, devuélvelo en 'texto' formateado en HTML visualmente agradable con un título en negrita.
    `;

    const payload = {
      model: options?.model || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: `DATOS: ${JSON.stringify(users)}\nPETICIÓN: "${userText}"` }
      ],
      temperature: 0.1,
      tools: [
        {
          type: "function",
          function: {
            name: "handleModelResponse",
            description: "Devuelve la acción a realizar y los datos estructurados.",
            parameters: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["borrar", "modificar", "filtrar", "exportar", "restaurar", "ordenar", "ninguna"],
                  description: "La acción requerida según la petición."
                },
                userIds: {
                  type: "array",
                  description: "Array de enteros independientes con los IDs afectados. Vacío [] si no aplica.",
                  items: {
                    anyOf: [{ type: "integer" }, { type: "string" }] 
                  }
                },
                usersData: {
                  type: "array",
                  description: "Array de objetos modificados. Vacío [] si no es modificar.",
                  items: {
                    type: "object",
                    properties: {  
                      id: { anyOf: [{ type: "integer" }, { type: "string" }] },
                      nombre: { type: "string" },
                      nif: { type: "string" },
                      descripcion: { anyOf: [{ type: "string" }, { type: "null" }] },
                      fecha_de_alta: { anyOf: [{ type: "string" }, { type: "null" }] },
                      fecha_de_baja: { anyOf: [{ type: "string" }, { type: "null" }] }
                    }
                  }
                },
                texto: {
                  type: "string",
                  description: "Mensaje al usuario o resumen/informe formateado en HTML."
                }
              },
              required: ["action", "userIds", "usersData", "texto"]
            }
          }
        }
      ],
      tool_choice: { 
        type: "function", 
        function: { name: "handleModelResponse" } 
      }
    };

    try {
      const response = await invokeAzureModel(payload);
      if (response?.content) return response.content;
      if (response?.tool_calls && response.tool_calls.length > 0) {
        const toolArguments = response.tool_calls[0].function.arguments;
        return JSON.parse(toolArguments);
      }   
      return { error: 'Respuesta de la API inesperada o sin llamadas a función.' };
    } catch (error) {
      console.error('rcg.ai.azure.handleUserPrompt Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  },
  /**
   * Orquesta peticiones multi-paso pidiendo al modelo JSON con protocolo function_call/final (sin tool calling nativo).
   * @param {string} userText
   * @param {Array} users
   * @param {Object} [options]
   */
  handleWithAgent: async (userText, users, options = {}) => {

    const maxIterations = Number(options?.maxIterations || 8);
    const safeUsers = Array.isArray(users) ? users : [];
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const LOG_ICONS = {
      agent: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6"><path d="M12 6V2H8"/><path d="M15 11v2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M9 11v2"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-text-icon lucide-message-square-text"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7 11h10"/><path d="M7 15h6"/><path d="M7 7h8"/></svg>',
      debug: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert-icon lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
    };

    const escapeHtml = (text) =>
      String(text ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));

    const renderJson = (data) => `<pre class="overflow-x-auto whitespace-pre-wrap mb-1 rounded-lg bg-yellow-200/40 p-2 text-xs">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;

    const log = (value, mode = 'info') => {
      const valueType = typeof value;
      let html = '';
      if (valueType === 'string') {
        const isError = mode === 'error';
        const containerClasses = isError
          ? 'text-red-600 font-medium bg-red-50 border border-red-200 rounded p-0.5'
          : 'text-slate-700';
        html = `
          <div class="text-xs ${containerClasses} mb-0.5 flex items-center gap-1">
            <span class="inline-flex items-center shrink-0">${LOG_ICONS[mode] || LOG_ICONS.info}</span>
            <span class="inline-block">${escapeHtml(value)}</span>
          </div>
        `;
      } else {
        let title = '';
        let detail = '';
        const isComplexObject = value && valueType === 'object';

        if (isComplexObject) {
          const isFunctionCall = value.type === 'function_call';
          const isModelResult = ['action', 'texto', 'userIds', 'usersData'].some(key => key in value);

          if (isFunctionCall) {
            title = `${LOG_ICONS.agent} ${value.name || 'Sin nombre'}`;
            detail = `<p>${escapeHtml(value.reason || 'Sin razón indicada')}</p>${renderJson(value.arguments || {})}`;
          }
          else if (isModelResult) {
            title = `${LOG_ICONS.agent} Resultado final del modelo`;
            detail = `<p>${escapeHtml(value.texto || '')}</p>${renderJson(value)}`;
          }
          else {
            detail = renderJson(value);
          }
        } else {
          detail = escapeHtml(String(value));
        }

        html = `
          <div class="mt-2">
            ${title ? `<div class="flex items-center justify-between"><strong class="text-sm flex items-center gap-1">${title}</strong></div>` : ''}
            <div class="text-sm leading-6">${detail}</div>
          </div>
        `;
      }

      options?.log?.(html);
    };

    const normalizeFinalResponse = (value) => {
      const base = value && typeof value === 'object' ? value : {};
      return {
        action: typeof base.action === 'string' ? base.action : 'ninguna',
        userIds: Array.isArray(base.userIds)
          ? base.userIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
          : [],
        usersData: Array.isArray(base.usersData) ? base.usersData : [],
        texto: typeof base.texto === 'string'
          ? base.texto
          : 'No se pudo completar la acción con el agente.',
        steps: Array.isArray(base.steps) ? base.steps : []
      };
    };

    const parseJsonFromModel = (rawText) => {
      const text = String(rawText || '').trim();
      if (!text) return null;

      const clean = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      try {
        return JSON.parse(clean);
      } catch (_) {
        const first = clean.indexOf('{');
        const last = clean.lastIndexOf('}');
        if (first === -1 || last === -1 || last <= first) return null;
        try {
          return JSON.parse(clean.slice(first, last + 1));
        } catch (__) {
          return null;
        }
      }
    };

    const applyUserPatch = (sourceUser, patch) => {
      if (!sourceUser || !patch || typeof patch !== 'object') return sourceUser || null;
      return {
        ...sourceUser,
        ...patch,
        id: sourceUser.id,
        fecha_de_alta: patch.fecha_de_alta !== undefined ? patch.fecha_de_alta : sourceUser.fecha_de_alta,
        fecha_de_baja: patch.fecha_de_baja !== undefined ? patch.fecha_de_baja : sourceUser.fecha_de_baja
      };
    };

    const toolContext = {
      listUsers: () => {
        return clone(safeUsers)
      },
      getUserById: ({ id }) => {
        const user = safeUsers.find((u) => Number(u.id) === Number(id)) || null;
        return clone(user);
      },
      deleteUser: ({ id }) => {
        return Math.random() < 0.5
          ? { success: true, deletedId: Number(id) }
          : { success: false, error: `No se pudo borrar el usuario con id ${id}` };
      },
      findUsers: ({ ids = [], nombreContains = '', nif = '', activo } = {}) => {
        let result = safeUsers.slice();
        if (Array.isArray(ids) && ids.length > 0) {
          const wanted = new Set(ids.map((x) => Number(x)));
          result = result.filter((u) => wanted.has(Number(u.id)));
        }
        if (nombreContains) {
          const text = String(nombreContains).toLowerCase();
          result = result.filter((u) => String(u.nombre || '').toLowerCase().includes(text));
        }
        if (nif) {
          const text = String(nif).toLowerCase();
          result = result.filter((u) => String(u.nif || '').toLowerCase() === text);
        }
        if (activo === true) result = result.filter((u) => !u.fecha_de_baja);
        if (activo === false) result = result.filter((u) => Boolean(u.fecha_de_baja));
        return clone(result);
      },
      sortUsers: ({ by = 'id', direction = 'asc' } = {}) => {
        const dir = String(direction).toLowerCase() === 'desc' ? -1 : 1;
        const sorted = safeUsers.slice().sort((a, b) => {
          const va = a?.[by];
          const vb = b?.[by];
          if (va === vb) return 0;
          if (va === undefined || va === null) return -1 * dir;
          if (vb === undefined || vb === null) return 1 * dir;
          return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
        });
        return clone(sorted);
      },
      buildModifiedUsers: ({ updates = [] } = {}) => {
        if (!Array.isArray(updates)) return [];
        const mapById = new Map(safeUsers.map((u) => [Number(u.id), u]));
        const modified = updates
          .map((item) => {
            const id = Number(item?.id);
            const original = mapById.get(id);
            if (!original) return null;
            const changes = item?.changes || {};
            return applyUserPatch(original, changes);
          })
          .filter(Boolean);
        return clone(modified);
      },
      sendEmail: ({ id, subject, body }) => {
        const user = safeUsers.find(u => Number(u.id) === Number(id));
        if (!user) return { success: false, error: "Usuario no encontrado" };
        // Simulación de envío de correo
        console.log(`Simulando envío de correo a ${user.email || 'desconocido'} con asunto "${subject}" y cuerpo "${body}"`);
        return { success: true, emailSentTo: user.email || null };
      }
    };

    const availableTools = [
      {
        name: 'listUsers',
        description: 'Devuelve la lista completa de usuarios del contexto.'
      },
      {
        name: 'getUserById',
        description: 'Devuelve un usuario por id.',
        args: { id: 'number' }
      },
      {
        name: 'deleteUser',
        description: 'Borra un usuario por id.',
        args: { id: 'number' }
      },
      {
        name: 'findUsers',
        description: 'Filtra usuarios por ids, texto en nombre, nif exacto y estado activo/inactivo.',
        args: { ids: 'number[]', nombreContains: 'string', nif: 'string', activo: 'boolean' }
      },
      {
        name: 'sortUsers',
        description: 'Ordena usuarios por propiedad y direccion. by: id|nombre|nif|fecha_de_alta|fecha_de_baja',
        args: { by: 'string', direction: 'asc|desc' }
      },
      {
        name: 'buildModifiedUsers',
        description: 'Construye usuarios modificados a partir de updates=[{id,changes}] sin perder propiedades originales.',
        args: { updates: '[{ id:number, changes:object }]' }
      },
      {
        name: 'sendEmail',
        description: 'Simula el envío de un correo a un usuario por id.',
        args: { id: 'number', subject: 'string', body: 'string' }
      }
    ];

    const systemText = `
      Eres un orquestador de acciones sobre usuarios y puedes pedir invocaciones de funciones.

      OBJETIVO:
      - Resolver peticiones multi-paso del usuario sobre la lista de usuarios.
      - Cuando necesites datos intermedios, responde con una solicitud de función.
      - Para responder al usuaio utiliza habla en primera persona: Necesito|Tengo que|Ahora voy a
      - Con los resultados recibidos, sigue iterando hasta dar la respuesta final.

      USUARIOS INICIALES (JSON):
      ${JSON.stringify(safeUsers)}

      HERRAMIENTAS DISPONIBLES:
      ${JSON.stringify(availableTools)}

      PROTOCOLO DE SALIDA (JSON estricto, sin texto extra):
      1) Para pedir función:
      {
        "type": "function_call",
        "name": "listUsers|getUserById|findUsers|sortUsers|buildModifiedUsers|deleteUser",
        "arguments": { ... },
        "reason": "opcional"
      }

      2) Para finalizar:
      {
        "type": "final",
        "result": {
          "action": "borrar|modificar|filtrar|exportar|restaurar|ordenar|ninguna",
          "userIds": [1,2],
          "usersData": [],
          "texto": "explicacion breve",
          "steps": ["paso 1", "paso 2"]
        }
      }

      REGLAS:
      - Si una acción (borrar, modificar, etc.) YA FUE EJECUTADA con éxito mediante una herramienta (ej: 'deleteUser'), la 'action' en el JSON final DEBE SER 'ninguna', ya que el agente ya la completó. El campo 'texto' informará de lo sucedido.
      - No inventes usuarios ni IDs inexistentes.
      - usersData debe contener objetos completos cuando action sea modificar.
      - Si no aplica, userIds y usersData deben ser arrays vacios.
      - Si ya tienes suficiente contexto, responde con type='final'.
      REGLAS DE SINTAXIS CRÍTICAS:
      - TODAS las propiedades/claves DEBEN ir entre comillas dobles obligatoriamente.
      - INCORRECTO: { name: "findUsers" }
      - CORRECTO:   { "name": "findUsers" }
      - NUNCA omitas las comillas dobles en las claves como "name", "type", "arguments" o "reason".
    `;

    const history = [
      {
        role: 'user',
        content: JSON.stringify({
          phase: 'initial_request',
          request: userText,
          usersSnapshot: safeUsers
        })
      }
    ];

    try {

      log('Estableciendo conexión con el agente...', 'info');
      log(`Iniciando orquestación del agente con ${maxIterations} iteraciones máximas`, 'debug');
      for (let i = 0; i < maxIterations; i += 1) {

        const payload = {
          model: options?.model || 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: systemText },
            ...history
          ],
          temperature: 0.1,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        };

        if (i > 0) await delay(1500);
        const target = i === 0 ? 'petición' : 'resultado';
        log(`Enviando ${target} al agente...`, 'info');

        const modelResponse = await invokeAzureModel(payload);
        const modelRaw = modelResponse?.content ?? '';
        const modelJson = parseJsonFromModel(modelRaw);
        if (!modelJson) {
          log('Respuesta no valida del modelo:', 'error');
          return {
            error: 'El modelo devolvio una respuesta no valida para el protocolo de agente.',
            raw: modelRaw
          };
        }

        if (modelJson.type === 'final') {
          log(modelJson.result);
          return normalizeFinalResponse(modelJson.result);
        }

        if (modelJson.type !== 'function_call') {
          const maybeFinal = normalizeFinalResponse(modelJson);
          if (maybeFinal.action || maybeFinal.texto) return maybeFinal;
          log('Respuesta inesperada del modelo:', 'error');
          return {
            error: 'El modelo no devolvio ni function_call ni final.',
            raw: modelJson
          };
        }

        const toolName = modelJson.name;
        const toolFn = toolContext[toolName];
        const toolArgs = modelJson.arguments && typeof modelJson.arguments === 'object' ? modelJson.arguments : {};

        log(modelJson);

        let toolResult;
        if (!toolFn) {
          log(`Función no encontrada: ${toolName}`, 'error');
          toolResult = { error: `Función no encontrada: ${toolName}` };
        } else {
          try {
            log(`Invocando: ${toolName}`, 'debug');
            toolResult = await toolFn(toolArgs);
          } catch (toolError) {
            toolResult = {
              error: toolError?.message || `Error ejecutando ${toolName}`
            };
            log(`Error: ${toolResult.error}`, 'debug');
          }
        }

        history.push({ role: 'assistant', content: JSON.stringify(modelJson) });
        history.push({
          role: 'user',
          content: JSON.stringify({
            phase: 'function_result',
            functionName: toolName,
            arguments: toolArgs,
            result: toolResult
          })
        });
        log(`Iteración ${i + 1} completada`, 'debug');
      }

      log(`Se alcanzó el máximo de iteraciones (${maxIterations}) sin obtener respuesta final`, 'error');
      return {
        action: 'ninguna',
        userIds: [],
        usersData: [],
        texto: `No se pudo completar la orquestacion en ${maxIterations} iteraciones.`
      };
    } catch (error) {
      log(`Error en la orquestación del agente: ${error.message}`, 'error');
      console.error('rcg.ai.azure.handleWithAgent Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  },
  /**
   * Orquesta peticiones multi-paso usando tool calling nativo de Azure OpenAI (formato function calling estándar).
   * @param {string} userText
   * @param {Array} users
   * @param {Object} [options]
   */
  handleWithAgentAndTools: async (userText, users, options = {}) => {
    const maxIterations = Number(options?.maxIterations || 8);
    const safeUsers = Array.isArray(users) ? users : [];
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const LOG_ICONS = {
      agent: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6"><path d="M12 6V2H8"/><path d="M15 11v2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M9 11v2"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-text-icon lucide-message-square-text"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7 11h10"/><path d="M7 15h6"/><path d="M7 7h8"/></svg>',
      debug: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert-icon lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
    };

    const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const renderJson = (data) => `<pre class="overflow-x-auto whitespace-pre-wrap mb-1 rounded-lg bg-yellow-200/40 p-2 text-xs">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;

    const log = (value, mode = 'info') => {
      let html = '';
      if (typeof value === 'string') {
        const containerClasses = mode === 'error' ? 'text-red-600 font-medium bg-red-50 border border-red-200 rounded p-0.5' : 'text-slate-700';
        html = `<div class="text-xs ${containerClasses} mb-0.5 flex items-center gap-1"><span class="inline-flex items-center shrink-0">${LOG_ICONS[mode] || LOG_ICONS.info}</span><span class="inline-block">${escapeHtml(value)}</span></div>`;
      } else {
        let title = '', detail = '';
        if (value?.type === 'function_call') {
          title = `${LOG_ICONS.agent} Llamando a: ${value.name}`;
          detail = renderJson(value.arguments);
        } if (value?.type === 'end_call') {
          title = `${LOG_ICONS.agent} Respuesta Final`;
          detail = `<p>${escapeHtml(value.texto)}</p>${renderJson(value.value)}`;
        }
        else if (value?.texto || value?.action) {
          title = `${LOG_ICONS.agent} Respuesta Final`;
          detail = `<p>${escapeHtml(value.texto)}</p>${renderJson(value)}`;
        } else {
          detail = renderJson(value);
        }
        html = `<div class="mt-2">${title ? `<strong class="text-sm flex items-center gap-1">${title}</strong>` : ''}<div class="text-sm leading-6">${detail}</div></div>`;
      }
      options?.log?.(html);
    };

    const parseJsonFromModel = (rawText) => {
      const text = String(rawText || '').trim();
      if (!text) return null;

      const clean = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      try {
        return JSON.parse(clean);
      } catch (_) {
        const first = clean.indexOf('{');
        const last = clean.lastIndexOf('}');
        if (first === -1 || last === -1 || last <= first) return null;
        try {
          return JSON.parse(clean.slice(first, last + 1));
        } catch (__) {
          return null;
        }
      }
    };

    // --- LÓGICA DE NEGOCIO ---
    const applyUserPatch = (sourceUser, patch) => ({ ...sourceUser, ...patch, id: sourceUser.id });

    const toolContext = {
      listUsers: () => clone(safeUsers),
      getUserById: ({ id }) => clone(safeUsers.find(u => Number(u.id) === Number(id)) || null),
      deleteUser: ({ id }) => {
        const exists = safeUsers.some(u => Number(u.id) === Number(id));
        return exists ? { success: true, deletedId: Number(id) } : { success: false, error: "Usuario no encontrado" };
      },
      findUsers: ({ ids, nombreContains, nif, activo }) => {
        let res = safeUsers.slice();
        if (ids?.length) res = res.filter(u => ids.map(Number).includes(Number(u.id)));
        if (nombreContains) res = res.filter(u => u.nombre?.toLowerCase().includes(nombreContains.toLowerCase()));
        if (nif) res = res.filter(u => u.nif?.toLowerCase() === nif.toLowerCase());
        if (activo !== undefined) res = res.filter(u => activo ? !u.fecha_de_baja : !!u.fecha_de_baja);
        return clone(res);
      },
      buildModifiedUsers: ({ updates }) => {
        if (!Array.isArray(updates)) return [];
        return updates.map(item => {
          const original = safeUsers.find(u => Number(u.id) === Number(item.id));
          return original ? applyUserPatch(original, item.changes) : null;
        }).filter(Boolean);
      },
      sendEmail: ({ id, subject, body }) => {
        const user = safeUsers.find(u => Number(u.id) === Number(id));
        if (!user) return { success: false, error: "Usuario no encontrado" };
        // Simulación de envío de correo
        console.log(`Simulando envío de correo a ${user.email || 'desconocido'} con asunto "${subject}" y cuerpo "${body}"`);
        return { success: true, emailSentTo: user.email || null };
      }
    };

    // --- DECLARACIÓN DE TOOLS (formato estándar OpenAI / Azure) ---
    const tools = [
      {
        type: 'function',
        function: {
          name: 'listUsers',
          description: 'Obtiene todos los usuarios disponibles.',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getUserById',
          description: 'Obtiene un usuario específico por su ID numérico.',
          parameters: {
            type: 'object',
            properties: { id: { type: 'number' } },
            required: ['id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'findUsers',
          description: 'Busca usuarios aplicando filtros opcionales.',
          parameters: {
            type: 'object',
            properties: {
              ids: { type: 'array', items: { type: 'number' } },
              nombreContains: { type: 'string' },
              nif: { type: 'string' },
              activo: { type: 'boolean' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteUser',
          description: 'Elimina un usuario del sistema.',
          parameters: {
            type: 'object',
            properties: { id: { type: 'number' } },
            required: ['id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'buildModifiedUsers',
          description: 'Genera la lista de usuarios con los cambios aplicados.',
          parameters: {
            type: 'object',
            properties: {
              updates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    changes: { type: 'object', description: 'Atributos a cambiar (nombre, nif, etc.)' }
                  }
                }
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'sendEmail',
          description: 'Envía un correo electrónico a un usuario.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              subject: { type: 'string' },
              body: { type: 'string' }
            },
            required: ['id', 'subject', 'body']
          }
        }
      }
    ];

    const systemText = `
      Eres un asistente experto en gestión de usuarios. 
      Tu objetivo es procesar la petición del usuario utilizando las herramientas disponibles.
      
      FLUJO:
      1. Analiza la petición.
      2. Llama a las funciones necesarias.
      3. Al terminar, responde SIEMPRE con el formato JSON final detallado abajo.
      
      IMPORTANTE: 
      1. Si borras o modificas usuarios mediante funciones, indica en el JSON final que la acción ya fue realizada.
      2. Las palabras tipo|categoria|agrupación|rol y similares, generamente se refieren a la propiedad "descripcion" de los usuarios.
      3. No genereres NUNCA '''json''', '''xml''' ni otros bloques de código en la respuesta final. Solo JSON plano.
      4. Ejecuta funciones de forma secuencial y estricta. No realices llamada a funciones en paralelo.

      FORMATO DE RESPUESTA FINAL (JSON):
      {
        "action": "borrar|modificar|filtrar|ninguna",
        "userIds": [],
        "usersData": [],
        "texto": "Resumen de lo que has hecho",
        "steps": []
      }
    `;

    let history = [
      { role: 'system', content: systemText },
      { role: 'user', content: `Petición: ${userText}. Usuarios actuales: ${JSON.stringify(safeUsers)}` }
    ];

    // ======================================================================
    // --- BUCLE PRINCIPAL DE ORQUESTACIÓN ---
    // ======================================================================
    try {
      log('Estableciendo conexión con el agente (Native Tools)...', 'info');
      log(`Iniciando orquestación del agente con ${maxIterations} iteraciones máximas`, 'debug');

      for (let i = 0; i < maxIterations; i++) {
        const payload = {
          model: options?.model || 'gpt-4.1-mini',
          messages: history,
          tools,
          tool_choice: 'auto',
          temperature: 0
        };

        if (i > 0) await delay(1500);
        const target = i === 0 ? 'petición' : 'resultado';
        log(`Enviando ${target} al agente...`, 'info');

        const message = await invokeAzureModel(payload);

        // ==================================================================
        // 2. El modelo solicita una o varias funciones (tool_calls)
        // ==================================================================
        if (message?.tool_calls && message.tool_calls.length > 0) {
          history.push({
            role: 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls
          });

          for (const toolCall of message.tool_calls) {
            const name = toolCall.function?.name;
            let args = {};
            try {
              args = JSON.parse(toolCall.function?.arguments || '{}');
            } catch (_) {
              args = {};
            }

            const TOOL_NOT_FOUND = `Función no encontrada: ${name}`;
            const toolFn = toolContext[name];

            log({ type: 'function_call', name, arguments: args }, 'debug');
            if (!toolFn) log(TOOL_NOT_FOUND, 'error');
            const result = await (toolFn?.(args) ?? { error: TOOL_NOT_FOUND });

            history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
          }

          log(`Iteración ${i + 1} completada`, 'debug');
          continue;
        }

        // ===============================================================
        // 3. Manejar la respuesta final del modelo (JSON válido)
        // ===============================================================
        if (message?.content) {
          const result = parseJsonFromModel(message.content);
          if (result) {
            log({ type: 'end_call', texto: result.texto, value: result });
            log(`Iteración ${i + 1} completada`, 'debug');
            return result;
          }
        }
      }
      throw new Error('Límite de iteraciones alcanzado');
    } catch (error) {
      log(`Error: ${error.message}`, 'error');
      return {
        texto: "Error en la orquestación",
        error: error.message
      };
    }
  }
};