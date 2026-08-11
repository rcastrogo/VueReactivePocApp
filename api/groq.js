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

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b' || 'openai/gpt-oss-120b' || 'llama-3.1-8b-instant' || 'llama-3.3-70b-versatile' || 'qwen/qwen3.6-27b';


async function invokeModel(payload) {

  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida en las variables de entorno.');
  if (!GROQ_URL) throw new Error('GROQ_URL no está definida en las variables de entorno.');

  payload.model = payload.model || GROQ_MODEL;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || 'desconocido';
      throw new Error(`Rate limit excedido. Reintentar en ${retryAfter} segundos. Límites: 30 RPM, 6,000 TPM, 14,400 RPD`);
    }
    throw new Error(`Groq Error (${response.status}): ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  // console.log(data);
  return data?.choices?.[0]?.message?.content || '{}';
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
  } = responseWrapper.wrapp(res);

  try {   
    if (req.method === 'POST') {
      const result = await invokeModel(req.body);
      return ok(result);
    }
    return methodNotAllowed();
  } catch (error) {
    console.error('Error en Groq:', error);
    return serverError();
  }

}