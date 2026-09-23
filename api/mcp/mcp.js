import { userRepository } from '../../lib/repo/users.js';

export default async function handler(req, res) {
  // Cabeceras CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();  
  }

  try {
    if (req.method === 'POST') {
      const body = req.body;

      if (!body || !body.method) {
        return res.status(400).json({ error: 'Payload JSON-RPC inválido' });
      }

      // 1. Handshake inicial
      if (body.method === 'initialize') {
        return res.status(200).json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'user-management-mcp', version: '1.0.0' },
          },
        });
      }

      // 2. Listar herramientas (tools/list)
      if (body.method === 'tools/list') {
        return res.status(200).json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            tools: [
              {
                name: 'get_all_users',
                description: 'Obtiene el listado completo de usuarios registrados en PostgreSQL.',
                inputSchema: { type: 'object', properties: {} },
              },
              {
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
            ],
          },
        });
      }

      // 3. Ejecutar herramientas (tools/call)
      if (body.method === 'tools/call') {
        const { name, arguments: args } = body.params || {};

        if (name === 'get_all_users') {
          const users = await userRepository.getAll();
          return res.status(200).json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(users, null, 2) }],
            },
          });
        }

        if (name === 'get_user_by_id') {
          if (!args?.id) {
            return res.status(200).json({
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32602, message: 'El parámetro "id" es obligatorio.' },
            });
          }

          const [user] = await userRepository.getById(args.id);
          if (!user) {
            return res.status(200).json({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                isError: true,
                content: [{ type: 'text', text: `Usuario con ID ${args.id} no encontrado.` }],
              },
            });
          }

          return res.status(200).json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(user, null, 2) }],
            },
          });
        }

        return res.status(200).json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: `Herramienta no encontrada: ${name}` },
        });
      }

      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32601, message: 'Método no soportado' },
      });
    }

    if (req.method === 'GET') {
      // Soporte de Server-Sent Events (SSE) según el protocolo MCP
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.write(`event: endpoint\ndata: /api/mcp/mcp?sessionId=stateless\n\n`);
      res.end();
      return;
      // return res.status(200).json({
      //   status: 'online',
      //   mcp: 'user-management-mcp',
      // });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    // @ts-ignore
    return res.status(500).json({ error: error.message });
  }
}