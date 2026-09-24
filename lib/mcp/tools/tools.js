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

export const tools = [
  get_all_users_tool,
  get_user_by_id_tool,
  get_database_schema_tool,
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