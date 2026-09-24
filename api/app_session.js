import { appSessionRepository } from '../lib/repo/app_session.js';
import { responseWrapper } from '../lib/response.js';

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  const {
    ok,
    created,
    badRequest,
    notFound,
    methodNotAllowed,
    serverError,
    setCorsHeaders,
    optionsOk
  } = responseWrapper.wrap(res);

  setCorsHeaders('GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return optionsOk();

  try {
    if (req.method === 'GET') {
      // @ts-ignore
      const id = req.query.id || req.params?.id;
      if (id) {
        const [appSession] = await appSessionRepository.getById(id);
        if (!appSession) return notFound('App session no encontrada');
        return ok(appSession);
      }

      const appSessions = await appSessionRepository.getAll();
      return ok(appSessions);
    }

    if (req.method === 'POST') {
      const { id, user_id, expires_at } = req.body || {};

      if (!id || !user_id || !expires_at) {
        return badRequest('Campos requeridos: id, user_id y expires_at son obligatorios');
      }

      const [newAppSession] = await appSessionRepository.create({ id, user_id, expires_at });
      return created(newAppSession);
    }

    if (req.method === 'PUT') {
      const id = req.query.id || req.body?.id;
      const { user_id, expires_at } = req.body || {};

      if (!id) {
        return badRequest('Se requiere id para actualizar (por query param ?id=X o en el body)');
      }
      if (!user_id || !expires_at) {
        return badRequest('Campos requeridos faltantes: user_id y expires_at');
      }

      const [updatedAppSession] = await appSessionRepository.update(id, { user_id, expires_at });
      if (!updatedAppSession) return notFound('App session no encontrada');

      return ok(updatedAppSession);
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;

      if (!id) {
        return badRequest('Se requiere id para eliminar');
      }

      const [deleted] = await appSessionRepository.delete(id);
      if (!deleted) return notFound('App session no encontrada');

      return ok({ message: 'App session eliminada correctamente', id: deleted.id });
    }

    return methodNotAllowed();
  } catch (error) {
    console.error('Error en base de datos:', error);
    return serverError();
  }
}