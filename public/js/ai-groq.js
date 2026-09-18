// @ts-nocheck
async function invokeGroqModel(payload) {
  const url = '/api/groq';
  const data = await rcg.http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}
rcg.ai = rcg.ai || {};
rcg.ai.groq = {
  /**
  * Genera una tarjeta HTML formateada con Tailwind usando Groq con payload estilo OpenAI.
   * @param {Object} user Objeto con los datos del usuario.
   * @param {Object} [options] Opciones adicionales (ej: { apiKey: '...' })
   * @returns {Promise<{ html: string }>}
   */
  generateProfile: async (user, options = {}) => {

    const isBaja = Boolean(user.fecha_de_baja);
    const estadoTexto = isBaja ? `Dado de baja (${user.fecha_de_baja})` : "Activo / En alta";

    const systemText = 'Eres un desarrollador experto en HTML y Tailwind CSS. Tu salida es siempre código HTML puro.';

    const prompt = `
      Genera una tarjeta de perfil HTML visualmente atractiva, moderna y pulida para los datos del usuario.

      DATOS DE ENTRADA:
      - json: ${JSON.stringify(user)}

      INSTRUCCIONES DE DISEÑO:
      - Devuelve ÚNICAMENTE el fragmento HTML (sin markdown \`\`\`html, sin <html>, <head> o <body>).
      - Usa clases puras de Tailwind CSS.
      - El aspecto debe ser en blanco y grises y sobrío sin florituras. Asegurate de que se ve bien el texto y el fondo. Sin avatares ni imágenes externas.
      - Muestra el nombre completo del usuario ("${user.nombre}").
      - Muestra el NIF del usuario ("${user.nif}").
      - Añade una sección para el estado del usuario ("${estadoTexto}").
      - Añade una sección con un texto resumen del usuario teniendo en cuenta sus propiedades
      - Añade una sección con el significado, breve, de su nombre y su origen etimológico (si es posible deducirlo).
      - Si el nombre del usuario es de algún personaje relacionado con la música, menciónalo brevemente.
    `;
    
    const payload = {
      model: options?.model || '',
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      top_p: 0.95
    };

    try {
      const data = await invokeGroqModel(payload) ?? '';
      const html = data
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      return { html };
    } catch (error) {
      console.error('rcg.ai.groq.generateProfile Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  },
  handleUserPrompt: async (userText, users, options = {}) => {
    const responseSchema = {
      action: "string ('borrar', 'modificar', 'filtrar', 'exportar', 'restaurar', 'ordenar', 'ninguna')",
      userIds: [/* array de enteros independientes, ej: [3, 4, 5]. Vacío [] si no aplica */],
      usersData: [/* array de objetos modificados. Vacío [] si no es modificar */],
      texto: "string"
    };

    const systemText = `
      Eres el motor de lógica de una interfaz de usuarios. 
      Responde ÚNICAMENTE con un objeto JSON válido que siga exactamente este esquema de ejemplo:
      ${JSON.stringify(responseSchema, null, 2)}

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
      model: options?.model || '',
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: `DATOS: ${JSON.stringify(users)}\nPETICIÓN: "${userText}"` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' } // <-- Cambiado aquí
    };

    try {
      const data = await invokeGroqModel(payload) ?? '{}';
      return JSON.parse(data);
    } catch (error) {
      console.error('rcg.ai.groq.handleUserPrompt Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  },
  handleUserPrompt_bak: async (userText, users, options = {}) => {

  const responseSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: {
        type: 'string',
        description: "Acción en minúsculas: 'borrar', 'modificar', 'filtrar', 'exportar', 'restaurar', 'ordenar'. Si no hay acción clara, 'ninguna'."
      },
      userIds: {
        type: 'array',
        items: { type: 'integer' },
        description: "IDs de usuarios afectados. Si no aplica, DEBE ser un array vacío []."
      },
      usersData: {
        type: 'array',
        description: "Objetos enteros modificados. Si la acción no es 'modificar', DEBE ser un array vacío []. NUNCA devolver un objeto.",
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            nif: { type: 'string' },
            descripcion: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            fecha_de_alta: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            fecha_de_baja: { anyOf: [{ type: 'string' }, { type: 'null' }] }
          },
          required: ['id', 'nombre', 'nif', 'descripcion', 'fecha_de_alta', 'fecha_de_baja']
        }
      },
      texto: {
        type: 'string',
        description: "Explicación breve y amigable de la operación realizada o respuesta al usuario."
      }
    },
    required: ['action', 'texto', 'usersData', 'userIds']
  };

  const systemText = `
    Eres el motor de lógica de una interfaz de usuarios. 
    Analiza la petición y el array JSON de usuarios recibido:
    - REGLA ESTRICTA DE TIPOS: 'usersData' y 'userIds' DEBEN SER SIEMPRE ARRAYS (ejemplo: []). NUNCA devuelvas un objeto {} para estos campos.
    - Si la acción no es 'modificar', 'usersData' debe ser un array vacío [].
    - Si la acción es 'modificar': duplica el usuario original manteniendo TODAS sus propiedades intactas y actualiza SOLO la propiedad solicitada en 'usersData'.
    - Si la acción es 'borrar', 'filtrar' o 'exportar': devuelve los IDs afectados en 'userIds'.
    - Si la acción es 'restaurar': devuelve 'userIds' como [] y 'usersData' como [], solo un mensaje en 'texto'.
    - Para seleccionar todos los usuarios, incluye todos los IDs en 'userIds'.
    - Mantén las fechas en formato ISO 8601 o null.
    - No inventes IDs ni usuarios inexistentes.
    - Si el usuario pide ordenar los usuarios, devuélvelos en 'userIds' en el orden solicitado.
    - Si el usuario pide un resumen, informe o agrupación, devuélvelo en 'texto' formateado en HTML visualmente agradable con un título en negrita.
    - Devuelve un objeto JSON válido según el esquema.
  `;

  const prompt = `
    DATOS: ${JSON.stringify(users)}
    PETICIÓN: "${userText}"
  `;
  
  const payload = {
    model: options?.model || '',
    messages: [
      { role: 'system', content: systemText },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 4000,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'user_action_response',
        strict: true,
        schema: responseSchema
      }
    }
  };

  try {
    const data = await invokeGroqModel(payload) ?? '{}';
    return JSON.parse(data);
  } catch (error) {
    console.error('rcg.ai.groq.handleUserPrompt Error:', error);
    return { error: `Error procesando la petición: ${error.message}` };
  }
}
};