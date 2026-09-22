
import { responseWrapper } from '../../lib/response.js';
import { requestWrapper } from '../../lib/request.js';
import { authRepository } from '../../lib/repo/auth.js';

const { getSessionUser } = authRepository;

export default async function handler(req, res) {

  const { getCookieValue } = requestWrapper.wrap(req);
  const {
    ok,
    unauthorized,
    serverError
  } = responseWrapper.wrap(res);

  const token = getCookieValue('session_token');
  if (!token) 
    return unauthorized({ authenticated: false });

  try {
    const [sessionData] = await getSessionUser(token);
    if (!sessionData) {
      return unauthorized({
        authenticated: false,
        message: 'Sesión inválida o expirada'
      });
    }
    return ok({
      authenticated: true,
      user: {
        id: sessionData.id,
        name: sessionData.name,
        email: sessionData.email,
        picture: sessionData.picture
      }
    });

  } catch (error) {
    console.error('Error al comprobar la sesión:', error);
    return serverError();
  }
}