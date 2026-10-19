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

const GEMINI_DEV_API_KEY = process.env.GEMINI_DEV_API_KEY || '';
const GEMINI_URL = process.env.GEMINI_URL || '';

export async function invokeModel(payload) {

  if (!GEMINI_DEV_API_KEY) throw new Error('GEMINI_DEV_API_KEY no está definida en las variables de entorno.');
  if (!GEMINI_URL) throw new Error('GEMINI_URL no está definida en las variables de entorno.');

  const isFunctionCall = payload?.functionCall === true;
  if (isFunctionCall) {
    delete payload.functionCall;
  }

  const response = await fetch(`${GEMINI_URL}${GEMINI_DEV_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return isFunctionCall ? data : data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// 'RETRIEVAL_DOCUMENT' para tus frases o 'RETRIEVAL_QUERY' para la pregunta
export async function invokeEmbeddingModel(text, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!GEMINI_DEV_API_KEY) throw new Error('GEMINI_DEV_API_KEY no está definida en las variables de entorno.');
  if (!GEMINI_URL) throw new Error('GEMINI_URL no está definida en las variables de entorno.');

  const models = [ 
    "models/gemini-embedding-2-preview",
    "models/gemini-embedding-2",
    "models/gemini-embedding-001"
  ];

  const model = 'models/gemini-embedding-001';
  const content = "embedContent"
  const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${GEMINI_DEV_API_KEY}`;

  const payload = {
    content: {
      parts: [
        { text: text }
      ]
    },
    taskType: taskType 
  };

  const response = await fetch(GEMINI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini Embedding API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data?.embedding?.values || [];
}

async function invokeGenerateContent(payload) {
   if (!GEMINI_DEV_API_KEY) throw new Error('GEMINI_DEV_API_KEY no está definida en las variables de entorno.');
   if (!GEMINI_URL) throw new Error('GEMINI_URL no está definida en las variables de entorno.');

  const model = 'models/gemini-flash-lite-latest'; // ;"models/gemini-3.8-flash";
  const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_DEV_API_KEY}`;
  const response = await fetch(GEMINI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini Embedding API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return textResponse || '';

}

async function invokeGenerateEmbedContent(payload, taskType = 'RETRIEVAL_DOCUMENT') {
if (!GEMINI_DEV_API_KEY) throw new Error('GEMINI_DEV_API_KEY no está definida en las variables de entorno.');
  if (!GEMINI_URL) throw new Error('GEMINI_URL no está definida en las variables de entorno.');
  
  const model = "models/gemini-embedding-2";
  const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${GEMINI_DEV_API_KEY}`;

  // CORRECCIÓN: Si por error te pasan 'contents' (plural), lo convertimos a 'content' (singular)
  let formattedPayload = { ...payload };
  if (formattedPayload.contents && !formattedPayload.content) {
    formattedPayload.content = formattedPayload.contents[0];
    delete formattedPayload.contents;
  }
  formattedPayload.taskType = taskType;

  const response = await fetch(GEMINI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formattedPayload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini Embedding API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  // console.log('Gemini Embedding Response:', data);
  // console.log(model, taskType);
  return data?.embedding?.values || [];
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
    html: responseHtml,
    created, 
    badRequest, 
    notFound, 
    methodNotAllowed, 
    serverError 
  } = responseWrapper.wrap(res);

  try {
    if (req.method === 'POST') {
      let result;
      if (req.query.intent == 'generateContent') {
        result = await invokeGenerateContent(req.body);
      }
      else if (req.query.intent == 'embedContent') {
        const taskType = req.query.mode || 'RETRIEVAL_DOCUMENT';
        result = await invokeGenerateEmbedContent(req.body, taskType);
      }
      else {
        result = await invokeModel(req.body);        
      }
      return ok(result);
    }
    if (req.method === 'GET') {
      const result = await invokeEmbeddingModel(req.query.text, req.query.mode || 'RETRIEVAL_QUERY');
      console.log('Embedding Model Result:', result);
      return ok(result);
    }

    return methodNotAllowed();
  } catch (error) {
    console.error('Error en Gemini:', error);
    return serverError();
  }

}