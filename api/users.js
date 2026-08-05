import { userRepository } from '../lib/repo/users.js';
import { responseWrapper } from '../lib/response.js';

/**
 * Auxiliar para inyectar cabeceras CORS en todas las respuestas
 * @param {import('@vercel/node').VercelResponse} res
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // En producción puedes restringir a tu dominio
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    created, 
    badRequest, 
    notFound, 
    methodNotAllowed, 
    serverError 
  } = responseWrapper.wrapp(res);  

  try {
    // =================================================================================
    // GET: Obtener todos los usuarios o uno por query params (?id=1)
    // =================================================================================
    if (req.method === 'GET') {
      const { id } = req.query;
      if (id) {
        const [user] = await userRepository.getById(id);
        if (!user) return notFound('Usuario no encontrado');
        return ok(user);
      }
      const users = await userRepository.getAll();
      return ok(users);
    }
    // =================================================================================
    // POST: Crear usuario (id y fechas gestionados por Postgres)
    // =================================================================================    
    if (req.method === 'POST') {

      const { intent, id } = req.body || {};

      if (intent === 'deactivate') {
        if (!id) return badRequest('Se requiere id para la baja');

        const [user] = await userRepository.deactivate(id);
        if (!user) return notFound('Usuario no encontrado o ya inactivo');

        return ok({ message: 'Usuario dado de baja exitosamente', user });
      }
      const { nif, nombre, descripcion } = req.body || {};

      if (!nif || !nombre) {
        return badRequest('Campos requeridos: nif y nombre son obligatorios');
      }
      const [newUser] = await userRepository.create({ nif, nombre, descripcion });
      return created(newUser);
    }
    // =================================================================================
    // PUT: Actualizar usuario completo mediante ?id=X o body.id
    // =================================================================================
    if (req.method === 'PUT') {
      const id = req.query.id || req.body?.id;
      const { nif, nombre, descripcion } = req.body || {};

      if (!id) {
        return badRequest('Se requiere id para actualizar (por query param ?id=X o en el body)');
      }
      if (!nif || !nombre) {
        return badRequest('Campos requeridos faltantes: nif y nombre');
      }

      const [updatedUser] = await userRepository.update(id, { nif, nombre, descripcion });
      if (!updatedUser) {
        return notFound('Usuario no encontrado');
      }

      return ok(updatedUser);
    }
    // =================================================================================
    // DELETE: Eliminar usuario mediante ?id=X o body.id
    // =================================================================================
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;

      if (!id) {
        return badRequest('Se requiere id para eliminar');
      }

      const [deleted] = await userRepository.delete(id);
      if (!deleted) {
        return notFound('Usuario no encontrado');
      }

      return ok({ message: 'Usuario eliminado correctamente', id: deleted.id });
    }

    return methodNotAllowed();
  } catch (error) {
    console.error('Error en base de datos:', error);
    return serverError();
  }
}