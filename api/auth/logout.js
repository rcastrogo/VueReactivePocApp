import { responseWrapper } from '../../lib/response.js';
import { requestWrapper } from '../../lib/request.js';
import { authRepository } from '../../lib/repo/auth.js';

const { deleteSession } = authRepository;

export default async function handler(req, res) {

  const {
    getCookieValue,
    clearCookie
  } = requestWrapper.wrap(req);

  const {
    ok,
    methodNotAllowed,
    serverError
  } = responseWrapper.wrap(res);

  if (req.method !== 'POST') return methodNotAllowed();

  const token = getCookieValue('session_token');
  const clearSessionCookie = clearCookie('session_token');

  try {
    if (token) await deleteSession(token);
    res.setHeader('Set-Cookie', clearSessionCookie);
    return ok({
      authenticated: false,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error('Error al cerrar la sesión:', error);
    return serverError();
  }

}