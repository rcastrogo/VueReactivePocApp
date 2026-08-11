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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || '';

export async function invokeModel(payload) {

  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY no está definida en las variables de entorno.');
  if (!OPENROUTER_API_URL) throw new Error('OPENROUTER_API_URL no está definida en las variables de entorno.');

  payload.model = 'openrouter/free';

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter Error (${response.status}): ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
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
    console.error('Error en Openrouter:', error);
    return serverError();
  }

}