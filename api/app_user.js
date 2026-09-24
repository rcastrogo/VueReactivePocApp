import { appUserRepository } from '../lib/repo/app_user.js';
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
        const [appUser] = await appUserRepository.getById(id);
        if (!appUser) return notFound('App user no encontrado');
        return ok(appUser);
      }

      const appUsers = await appUserRepository.getAll();
      return ok(appUsers);
    }

    if (req.method === 'POST') {
      const { google_id, email, name, picture } = req.body || {};

      if (!google_id || !email) {
        return badRequest('Campos requeridos: google_id y email son obligatorios');
      }

      const [newAppUser] = await appUserRepository.create({ google_id, email, name, picture });
      return created(newAppUser);
    }

    if (req.method === 'PUT') {
      const id = req.query.id || req.body?.id;
      const { google_id, email, name, picture } = req.body || {};

      if (!id) {
        return badRequest('Se requiere id para actualizar (por query param ?id=X o en el body)');
      }
      if (!google_id || !email) {
        return badRequest('Campos requeridos faltantes: google_id y email');
      }

      const [updatedAppUser] = await appUserRepository.update(id, { google_id, email, name, picture });
      if (!updatedAppUser) return notFound('App user no encontrado');

      return ok(updatedAppUser);
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;

      if (!id) {
        return badRequest('Se requiere id para eliminar');
      }

      const [deleted] = await appUserRepository.delete(id);
      if (!deleted) return notFound('App user no encontrado');

      return ok({ message: 'App user eliminado correctamente', id: deleted.id });
    }

    return methodNotAllowed();
  } catch (error) {
    console.error('Error en base de datos:', error);
    return serverError();
  }
}