import { sql, getDatabaseSchema, isSafeSelectQuery } from '../../db.js';
import { userRepository } from '../../repo/users.js';

// =====================================================================
// Herramienta para ejecutar consultas SQL de solo lectura (SELECT)
// =====================================================================
const execute_readonly_sql_tool = {
  definition: {
    name: 'execute_readonly_sql',
    description: 'Ejecuta una consulta SQL de solo lectura (SELECT). Pasan resultados en formato JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Consulta SQL a ejecutar. Debe ser estrictamente una sentencia SELECT válida.',
        },
      },
      required: ['query'],
    },
  },
  handler: async (args) => {

    const { query } = args || {};

    if (!query)
      return {
        isCustomError: true,
        error: { code: -32602, message: 'La propiedad "query" es requerida.' },
      };

    // 1. Filtrado lógico previo
    if (!isSafeSelectQuery(query)) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Error de seguridad: Solo se permiten sentencias SQL de lectura (SELECT) individuales.',
        }],
      };
    }

    try {
      console.log('Executing query:', query);
      const cleanQuery = query.trim().replace(/;$/, '');
      const results = await sql`
        WITH user_query AS (${sql.unsafe(cleanQuery)}) 
        SELECT * FROM user_query LIMIT 100;
      `
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2),
        }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          // @ts-ignore
          text: `Error de ejecución en PostgreSQL: ${err.message}`,
        }],
      };
    }
  },
}

// =====================================================================
// Herramienta para obtener todos los usuarios
// =====================================================================
const get_all_users_tool = {
  definition: {
    name: 'get_all_users',
    description: 'Obtiene el listado completo de usuarios registrados en PostgreSQL.',
    inputSchema: { type: 'object', properties: {} },
  },
  handler: async () => {
    const users = await userRepository.getAll();
    return {
      content: [{ type: 'text', text: JSON.stringify(users, null, 2) }],
    };
  },
}

// =====================================================================
// Herramienta para obtener un usuario por ID
// =====================================================================
const get_user_by_id_tool = {
  definition: {
    name: 'get_user_by_id',
    description: 'Recupera la información detallada de un usuario específico mediante su ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'El ID único del usuario a consultar.' },
      },
      required: ['id'],
    },
  },
  handler: async (args) => {
    if (!args?.id) {
      return {
        isCustomError: true,
        error: { code: -32602, message: 'El parámetro "id" es obligatorio.' },
      };
    }

    const [user] = await userRepository.getById(args.id);
    if (!user) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Usuario con ID ${args.id} no encontrado.` }],
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(user, null, 2) }],
    };
  },
}

// =====================================================================
// Herramienta para obtener el esquema de la base de datos
// =====================================================================
const get_database_schema_tool = {
  definition: {
    name: 'get_database_schema',
    description: 'Obtiene el esquema de la base de datos PostgreSQL.',
    inputSchema: { type: 'object', properties: {} },
  },
  handler: async () => {
    const schema = await getDatabaseSchema();
    return {
      content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }],
    };
  },
}

// =====================================================================
// Herramienta para obtener la plantilla de ejemplo del backend
// =====================================================================
const EXAMPLE_HANDLER = `import { tipoUsuarioRepository } from '../repo/tipo_usuario.js';
import { requestWrapper } from '../request.js';
import { responseWrapper } from '../response.js';

async function handleGet(req, { ok, notFound }, subpath = []) {
  const id = req.query.id || req.params?.id || subpath[0];
  if (id) {
    const [item] = await tipoUsuarioRepository.getById(id);
    if (!item) return notFound('Tipo de usuario no encontrado');
    return ok(item);
  }
  return ok(await tipoUsuarioRepository.getAll());
}

async function handlePost(req, { created, badRequest }) {
  const { codigo, descripcion, activo } = req.body || {};
  if (!codigo || !descripcion)
    return badRequest('Campos requeridos: codigo y descripcion');
  const [created_] = await tipoUsuarioRepository.create({ codigo, descripcion, activo });
  return created(created_);
}

async function handlePut(req, { ok, badRequest, notFound }, subpath = []) {
  const id = req.query.id || req.body?.id || subpath[0];
  const { codigo, descripcion, activo } = req.body || {};
  if (!id) return badRequest('Se requiere id para actualizar');
  if (!codigo || !descripcion) return badRequest('Campos requeridos faltantes');
  const [updated] = await tipoUsuarioRepository.update(id, { codigo, descripcion, activo });
  if (!updated) return notFound('Tipo de usuario no encontrado');
  return ok(updated);
}

async function handleDelete(req, { ok, badRequest, notFound }, subpath = []) {
  const id = req.query.id || req.body?.id || subpath[0];
  if (!id) return badRequest('Se requiere id para eliminar');
  const [deleted] = await tipoUsuarioRepository.delete(id);
  if (!deleted) return notFound('Tipo de usuario no encontrado');
  return ok({ message: 'Eliminado correctamente', id: deleted.id });
}

const methodHandlers = {
  GET: handleGet,
  POST: handlePost,
  PUT: handlePut,
  DELETE: handleDelete,
  OPTIONS: (_req, { optionsOk }) => optionsOk(),
};

export default async function handler(req, res, subpath = []) {
  const responseHelpers = responseWrapper.wrap(res);
  const { methodNotAllowed, serverError, setCorsHeaders, unauthorized } = responseHelpers;
  if (!requestWrapper.wrap(req).isAuthenticated()) return unauthorized();
  setCorsHeaders('GET, POST, PUT, DELETE, OPTIONS');
  try {
    const handle = methodHandlers[req.method];
    if (handle) return await handle(req, responseHelpers, subpath);
    else return methodNotAllowed();
  } catch (error) {
    console.error('Error en base de datos:', error);
    return serverError();
  }
}`;

const EXAMPLE_REPO = `import { sql } from '../db.js';

export const tipoUsuarioRepository = {
  getAll: () => sql\`SELECT id, codigo, descripcion, activo FROM tipo_usuario ORDER BY id\`,

  getById: (id) => sql\`SELECT id, codigo, descripcion, activo FROM tipo_usuario WHERE id = \${id}\`,

  create: ({ codigo, descripcion, activo }) =>
    sql\`
      INSERT INTO tipo_usuario (codigo, descripcion, activo)
      VALUES (\${codigo}, \${descripcion}, \${activo ?? true})
      RETURNING id, codigo, descripcion, activo
    \`,

  update: (id, { codigo, descripcion, activo }) =>
    sql\`
      UPDATE tipo_usuario
      SET codigo = \${codigo}, descripcion = \${descripcion}, activo = \${activo ?? true}
      WHERE id = \${id}
      RETURNING id, codigo, descripcion, activo
    \`,

  delete: (id) => sql\`DELETE FROM tipo_usuario WHERE id = \${id} RETURNING id\`,
};`;

const get_project_conventions_tool = {
  definition: {
    name: 'get_project_conventions',
    description: `Devuelve los ejemplos canónicos (few-shot) del proyecto para la generación 
      de código backend: un handler HTTP completo y su repositorio de acceso a datos.

      Llama a esta herramienta ANTES de generar cualquier handler o repositorio nuevo, 
      para conocer las convenciones exactas del proyecto:
      - Estructura de funciones por método HTTP (handleGet, handlePost, handlePut, handleDelete)
      - Uso de responseWrapper y requestWrapper
      - Patrón de autenticación con isAuthenticated()
      - Configuración de CORS con setCorsHeaders()
      - Manejo de errores y respuestas (ok, created, notFound, badRequest, serverError)
      - Firma del export default handler(req, res, subpath)
      - Queries SQL con template literals tagged (sql\`...\`)
      - Estructura del repositorio con métodos getAll, getById, create, update, delete

      El código que generes debe seguir estos patrones de forma estricta, 
      adaptando nombres de entidad, campos y validaciones a la tabla objetivo.`,
      inputSchema: { type: 'object', properties: {} },
  },
  handler: async () => {
    const template = `
      ## EJEMPLO HANDLER
      \`\`\`javascript
      ${EXAMPLE_HANDLER}
      \`\`\`

      ## EJEMPLO REPOSITORIO
      \`\`\`javascript
      ${EXAMPLE_REPO}
      \`\`\`
    `;
    return {
      content: [{ type: 'text', text: template }],
    };
  },
}

export const tools = [
  get_all_users_tool,
  get_user_by_id_tool,
  get_database_schema_tool,
  get_project_conventions_tool,
  execute_readonly_sql_tool,
];

// Helper para extraer solo las definiciones (usado en tools/list)
export const getToolsDefinitions = () => tools.map((t) => t.definition);

// Helper para ejecutar un handler buscando por nombre (usado en tools/call)
export async function executeTool(name, args) {
  const tool = tools.find((t) => t.definition.name === name);

  if (!tool) {
    return {
      isCustomError: true,
      error: { code: -32601, message: `Herramienta no encontrada: ${name}` },
    };
  }

  return await tool.handler(args);
}