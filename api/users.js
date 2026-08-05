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

function renderUsersHtml(users) {
  const fn = (user) => {
    const isInactive = Boolean(user.fecha_de_baja);
    const initial = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
    
    // Formateo de fechas
    const fechaAlta = user.fecha_de_alta 
      ? new Date(user.fecha_de_alta).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

    return `
      <article class="flex flex-col justify-between p-2 border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div>
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-bold text-white shadow-sm">
                ${initial}
              </div>
              <div>
                <h3 class="font-semibold text-slate-800 leading-tight">${user.nombre}</h3>
                <span class="text-xs font-mono text-slate-400">#${user.id}</span>
              </div>
            </div>
            
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isInactive 
                ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20' 
                : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
            }">
              <span class="h-1.5 w-1.5 rounded-full ${isInactive ? 'bg-rose-500' : 'bg-emerald-500'}"></span>
              ${isInactive ? 'Baja' : 'Activo'}
            </span>
          </div>

          <div class="mb-3 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
            <span class="font-semibold text-slate-400">NIF:</span> ${user.nif}
          </div>

          <p class="text-sm text-slate-600 line-clamp-2 min-h-10">
            ${user.descripcion || '<span class="italic text-slate-400">Sin descripción</span>'}
          </p>
        </div>

        <!-- Meta datos de fechas -->
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Alta: <strong class="text-slate-500 font-medium">${fechaAlta}</strong></span>
          ${isInactive ? `<span class="text-rose-500">Baja: ${new Date(user.fecha_de_baja).toLocaleDateString('es-ES')}</span>` : ''}
        </div>
      </article>
    `;
  };

  const userRows = users.map(fn).join('');

  return `
    <section class="p-2">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">Listado de Usuarios recuperados desde PostgreSQL</h2>
        <span class="rounded-full bg-slate-200/60 px-3 py-1 text-xs font-semibold text-slate-600">
          Total: ${users.length}
        </span>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        ${userRows}
      </div>
    </section>
  `;
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
    // =================================================================================
    // GET: Obtener todos los usuarios o uno por query params (?id=1)
    // =================================================================================
    if (req.method === 'GET') {
      const { id, action } = req.query;
      if (id) {
        const [user] = await userRepository.getById(id);
        if (!user) return notFound('Usuario no encontrado');
        return ok(user);
      }
      const users = await userRepository.getAll();
      if(action === 'ssr') {
        return responseHtml(
          renderUsersHtml(users)
        );
      }
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