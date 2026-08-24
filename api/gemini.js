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
    console.error('Error en Gemini:', error);
    return serverError();
  }

}