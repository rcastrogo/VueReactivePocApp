import { tipoUsuarioRepository } from '../lib/repo/tipo_usuario.js';
import { requestWrapper } from '../lib/request.js';
import { responseWrapper } from '../lib/response.js';

// =========================================================================
// Method GET  
// =========================================================================
async function handleGet(req, { ok, notFound }) {
  const id = req.query.id || req.params?.id;

  if (id) {
    const [tipoUsuario] = await tipoUsuarioRepository.getById(id);
    if (!tipoUsuario) return notFound('Tipo de usuario no encontrado');
    return ok(tipoUsuario);
  }

  const tiposUsuario = await tipoUsuarioRepository.getAll();
  return ok(tiposUsuario);
}

// =============================================================================================
// Method POST
// =============================================================================================
async function handlePost(req, { created, badRequest }) {
  const { codigo, descripcion, activo } = req.body || {};

  if (!codigo || !descripcion) {
    return badRequest('Campos requeridos: codigo y descripcion son obligatorios');
  }

  const [newTipoUsuario] = await tipoUsuarioRepository.create({ codigo, descripcion, activo });
  return created(newTipoUsuario);
}

// =======================================================================================================
// Method PUT
// =======================================================================================================
async function handlePut(req, { ok, badRequest, notFound }) {
  const id = req.query.id || req.body?.id;
  const { codigo, descripcion, activo } = req.body || {};

  if (!id) {
    return badRequest('Se requiere id para actualizar (por query param ?id=X o en el body)');
  }
  if (!codigo || !descripcion) {
    return badRequest('Campos requeridos faltantes: codigo y descripcion');
  }

  const [updatedTipoUsuario] = await tipoUsuarioRepository.update(id, { codigo, descripcion, activo });
  if (!updatedTipoUsuario) return notFound('Tipo de usuario no encontrado');

  return ok(updatedTipoUsuario);
}
// =======================================================================================================
// Method DELETE
// =======================================================================================================
async function handleDelete(req, { ok, badRequest, notFound }) {
  const id = req.query.id || req.body?.id;

  if (!id) {
    return badRequest('Se requiere id para eliminar');
  }

  const [deleted] = await tipoUsuarioRepository.delete(id);
  if (!deleted) return notFound('Tipo de usuario no encontrado');

  return ok({ message: 'Tipo de usuario eliminado correctamente', id: deleted.id });
}

const methodHandlers = {
  GET: handleGet,
  POST: handlePost,
  PUT: handlePut,
  DELETE: handleDelete,
  OPTIONS: (_req, { optionsOk }) => optionsOk(),
};

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {

  const responseHelpers = responseWrapper.wrap(res);
  const { 
    methodNotAllowed, 
    serverError, 
    setCorsHeaders, 
    unauthorized 
  } = responseHelpers;
  // ====================================================================
  // Validar autenticación del usuario
  // ====================================================================
  if (!requestWrapper.wrap(req).isAuthenticated()) return unauthorized();
  // ====================================================================
  // Configurar cabeceras CORS
  // ====================================================================  
  setCorsHeaders('GET, POST, PUT, DELETE, OPTIONS');
  // ====================================================================
  // Manejo de métodos HTTP
  // ====================================================================
  try {
    const handle = methodHandlers[req.method];
    if (handle) 
      return await handle(req, responseHelpers);
    else
      return methodNotAllowed();
  } catch (error) {
    console.error('Error en base de datos:', error);
    return serverError();
  }
}