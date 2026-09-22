import crypto from 'crypto';
import { responseWrapper } from '../../lib/response.js';
import { requestWrapper } from '../../lib/request.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export default async function handler(req, res) {

  const { origin, serializeCookie } = requestWrapper.wrap(req);
  const { methodNotAllowed, serverError } = responseWrapper.wrap(res);
  
  if (req.method !== 'GET') return methodNotAllowed();

  const { GOOGLE_CLIENT_ID } = process.env;

  if (!GOOGLE_CLIENT_ID) {
    console.error('Falta GOOGLE_CLIENT_ID');
    return serverError('Configuración OAuth incompleta');
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state
  });

  res.setHeader(
    'Set-Cookie',
    serializeCookie('oauth_state', state, { maxAge: 600 })
  );

  return res.redirect(
    302,
    `${GOOGLE_AUTH_URL}?${params.toString()}`
  );

}