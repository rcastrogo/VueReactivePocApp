// @ts-nocheck

import { responseWrapper } from '../lib/response.js';

/**
 * Auxiliar para inyectar cabeceras CORS en todas las respuestas
 * @param {import('@vercel/node').VercelResponse} res
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const AZURE_LOCATION = process.env.AZURE_LOCATION || 'swedencentral';
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY || '';
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://ai-azure-rcastrogo.services.ai.azure.com/openai/v1'; 
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'Phi-4-reasoning';

// ---------- Azure Translator ----------
const AZURE_TRANSLATOR_KEY = AZURE_OPENAI_KEY;
const AZURE_TRANSLATOR_ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://ai-azure-rcastrogo.cognitiveservices.azure.com/';
const AZURE_TRANSLATOR_API_VERSION = process.env.AZURE_TRANSLATOR_API_VERSION || '2025-10-01-preview';

async function invokeModel(payload) {
  if (!AZURE_OPENAI_KEY) {
    throw new Error('AZURE_OPENAI_KEY no está definida en las variables de entorno.');
  }
  if (!AZURE_OPENAI_ENDPOINT) {
    throw new Error('AZURE_OPENAI_ENDPOINT no está definida en las variables de entorno.');
  }

  // Nombre del modelo/despliegue
  const deploymentName = payload.model || AZURE_OPENAI_DEPLOYMENT;
  // Limpiar la URL base por si incluye barra final
  const cleanEndpoint = AZURE_OPENAI_ENDPOINT.replace(/\/$/, '');
  // Al ser estándar OpenAI v1, la ruta es directamente /chat/completions
  const azureUrl = `${cleanEndpoint}/chat/completions`;
  // En el estándar OpenAI, el parámetro 'model' DEBE ir dentro del body
  const azurePayload = {
    ...payload,
    model: deploymentName
  };

  console.log('Invocando Azure AI con payload:', azurePayload);

  const response = await fetch(azureUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AZURE_OPENAI_KEY}`,
      'api-key': AZURE_OPENAI_KEY, // Enviamos ambas para máxima compatibilidad
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(azurePayload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || 'desconocido';
      throw new Error(`Rate limit de Azure excedido. Reintentar en ${retryAfter} segundos.`);
    }
    throw new Error(`Azure AI Error (${response.status}): ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  return message ?? {};
}

// Traducir un texto (detecta idioma origen automáticamente)
// fetch('/api/azure-ai', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     action: 'translate',
//     text: 'Doctor is available next Monday.',
//     to: 'es'
//   })
// });

// // Varios textos a varios idiomas
// body: JSON.stringify({
//   action: 'translate',
//   texts: ['Hello', 'Good morning'],
//   from: 'en',
//   to: ['es', 'fr']
// })


/**
 * Traduce uno o varios textos con Azure Translator.
 * @param {{ text?: string, texts?: string[], from?: string, to: string|string[] }} params
 */
async function translateText({ text, texts, from, to }) {
  if (!AZURE_TRANSLATOR_KEY) {
    throw new Error('AZURE_TRANSLATOR_KEY no está definida en las variables de entorno.');
  }

  const list = texts ?? (text ? [text] : []);
  if (!list.length) throw new Error('Debes indicar "text" o "texts".');
  if (!to) throw new Error('Debes indicar el idioma destino "to".');

  const targets = (Array.isArray(to) ? to : [to]).map((language) => ({ language }));
  const requestBody = {
    inputs: list.map((t) => ({
      Text: t,
      ...(from ? { language: from } : {}),
      targets
    }))
  };
  console.log('Invocando Azure Translator con payload:', requestBody);

  const cleanEndpoint = AZURE_TRANSLATOR_ENDPOINT.replace(/\/$/, '');
  const url = `${cleanEndpoint}/translator/text/translate?api-version=${AZURE_TRANSLATOR_API_VERSION}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
      'Ocp-Apim-Subscription-Region': AZURE_LOCATION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || 'desconocido';
      throw new Error(`Rate limit del Translator excedido. Reintentar en ${retryAfter} segundos.`);
    }
    throw new Error(`Azure Translator Error (${response.status}): ${err?.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  // =========================================================
  // Cabeceras CORS
  // =========================================================
  setCorsHeaders(res);

  // =========================================================
  // Respuesta inmediata para peticiones Preflight CORS
  // =========================================================
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { 
    ok, 
    methodNotAllowed, 
    serverError 
  } = responseWrapper.wrap(res);

  try {   
    if (req.method === 'POST') {
      // console.log('Azure AI - Invocando modelo con payload:', req.body);      
      const { action, ...rest } = req.body || {};
      // ================================================================================
      // Traducción: { "action": "translate", "text": "...", "to": "es", "from": "en" }
      // ================================================================================
      if (action === 'translate') {
        const result = await translateText(rest);
        return ok(result);
      }
      // ================================================================================
      // Invocación general del modelo de Azure AI
      // ================================================================================
      const result = await invokeModel(req.body);
      // console.log('Azure AI - Resultado recibido:', result);
      return ok(result);
    }
    return methodNotAllowed();
  } catch (error) {
    console.error('Error en Azure AI:', error);
    return serverError();
  }
}