
import { responseWrapper } from '../../lib/response.js';
import { requestWrapper } from '../../lib/request.js';
import { authRepository } from '../../lib/repo/auth.js';
import crypto from 'crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const { saveGoogleUser, createSession } = authRepository;

export default async function handler(req, res) {

  const {
    origin,
    getCookieValue,
    serializeCookie,
    clearCookie,
    getFirstQueryValue
  } = requestWrapper.wrap(req);

  const {
    badRequest,
    methodNotAllowed,
    serverError
  } = responseWrapper.wrap(res);

  if (req.method !== 'GET') return methodNotAllowed();

  const code = getFirstQueryValue(req.query.code);
  const state = getFirstQueryValue(req.query.state);
  const oauthError = getFirstQueryValue(req.query.error);

  if (oauthError) return badRequest(`Google OAuth error: ${oauthError}`);
  if (!code) return badRequest('Falta el código');

  const clearOauthStateCookie = clearCookie('oauth_state');
  const expectedState = getCookieValue('oauth_state');
  if (state !== expectedState) {
    res.setHeader('Set-Cookie', clearOauthStateCookie);
    return badRequest('State OAuth inválido');
  }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET');
    return serverError('Configuración OAuth incompleta');
  }

  const redirectUri = `${origin}/api/auth/callback`;
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Error intercambiando el código OAuth:', tokenData);
      return badRequest('No se pudo validar el código de Google');
    }

    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`}
    });

    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.id || !profile.email) {
      console.error('Error obteniendo el perfil de Google:', profile);
      return badRequest('No se pudo obtener el perfil de Google');
    }

    if (profile.verified_email === false) {
      return badRequest('El email de Google no está verificado');
    }

    const sessionId = crypto.randomUUID(); 
    const daysToExpire = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToExpire);

    const [user] = await saveGoogleUser(profile);
    const session = { sessionId, userId: user.id, expiresAt };
    await createSession(session);

    const cookieMaxAge = daysToExpire * 24 * 60 * 60; 
    res.setHeader('Set-Cookie', [
      serializeCookie('session_token', sessionId, { maxAge: cookieMaxAge }),
      clearOauthStateCookie
    ]);
    res.writeHead(302, { Location: '/' });
    res.end();

  } catch (error) {
    console.error(error);
    return serverError();
  }
}