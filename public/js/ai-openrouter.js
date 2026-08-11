// @ts-nocheck
async function invokeOpenrouterModel(payload) {
  const url = '/api/openrouter';
  const data = await rcg.http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}
rcg.ai = rcg.ai || {};
rcg.ai.openrouter = {
  /**
  * Genera una tarjeta HTML formateada con Tailwind usando OpenRouter con payload estilo OpenAI.
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
    `;
    
    const payload = {
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      top_p: 0.95
    };

    try {
      const data = await invokeOpenrouterModel(payload) ?? '';
      const html = data
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      return { html };
    } catch (error) {
      console.error('rcg.ai.openrouter.generateProfile Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  },
  handleUserPrompt: async (userText, users, options = {}) => {

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
          description: "IDs de usuarios afectados por 'borrar', 'filtrar' o 'exportar'. Vacío si no aplica."
        },
        usersData: {
          type: 'array',
          description: "Objetos enteros modificados. Vacío si la acción no es 'modificar'.",
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'integer' },
              nombre: { type: 'string' },
              nif: { type: 'string' },
              descripcion: { type: ['string', 'null'] },
              fecha_de_alta: { type: ['string', 'null'] },
              fecha_de_baja: { type: ['string', 'null'] }
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
      - Si la acción es 'modificar': duplica el usuario original manteniendo TODAS sus propiedades intactas y actualiza SOLO la propiedad solicitada en 'usersData'.
      - Si la acción es 'borrar', 'filtrar' o 'exportar': devuelve los IDs afectados en 'userIds'.
      - Si la acción es 'restaurar' no es necesario devolver usuarios ni IDs, solo un mensaje en 'texto'.
      - Para seleccionar todos los usuarios, incluye todos los IDs en 'userIds'.
      - Mantiene las fechas en formato ISO 8601 o null.
      - No inventes IDs ni usuarios inexistentes.
      - Si el usuario piede ordenar los usuarios debes hacerlo y devolver los IDs en 'userIds' en el orden solicitado.
      - Si el usuario pide un resumen, informe, agrupación devuélvelo en 'texto' formateado en HTML visualmene agradable. Debe tener un título en negrita.
    `;

    const prompt = `
      DATOS: ${JSON.stringify(users)}
      PETICIÓN: "${userText}"
    `;
    
    const payload = {
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
      const data = await invokeOpenrouterModel(payload) ?? '{}';
      return JSON.parse(data);
    } catch (error) {
      console.error('rcg.ai.openrouter.handleUserPrompt Error:', error);
      return { error: `Error procesando la petición: ${error.message}` };
    }
  }
};