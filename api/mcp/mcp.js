import { getToolsDefinitions, executeTool } from '../../lib/mcp/tools/tools.js';
import { responseWrapper } from '../../lib/response.js';

export default async function handler(req, res) {
  
  const { badRequest, ok, methodNotAllowed, serverError, optionsOk, setCorsHeaders } = responseWrapper.wrap(res);

  // Cabeceras CORS
  setCorsHeaders();

  if (req.method === 'OPTIONS') return optionsOk();

  try {
    if (req.method === 'POST') {

      const body = req.body;

      if (!body || !body.method) return badRequest('Payload JSON-RPC inválido');
  
      const jsonRpc = (payload) => ok({
        jsonrpc: '2.0',
        id: body.id,
        ...payload,
      });
      // ===========================================================================
      // 1. Handshake inicial 
      // ===========================================================================
      if (body.method === 'initialize') {
        return jsonRpc({
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { 
              tools: {} 
            },
            serverInfo: { 
              name: 'user-management-mcp', 
              version: '1.0.0'
            },
          },
        });
      }
      // ===========================================================================
      // 2. Listar herramientas (tools/list)
      // ===========================================================================
      if (body.method === 'tools/list') 
        return jsonRpc({ result: { tools: getToolsDefinitions() } });
      // ===========================================================================
      // 3. Ejecutar herramientas (tools/call)
      // ===========================================================================
      if (body.method === 'tools/call') {
        const { name, arguments: args } = body.params || {};
        const executionResult = await executeTool(name, args);
        if (executionResult.isCustomError)
          return jsonRpc({ error: executionResult.error });
        else
          return jsonRpc({ result: executionResult });
      }
      // ===========================================================================
      // 4. Método no soportado
      // =========================================================================== 
      return jsonRpc({ error: { code: -32601, message: 'Método no soportado' } });
    }

    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.write(`event: endpoint\ndata: /api/mcp/mcp?sessionId=stateless\n\n`);
      return res.end();
    }

    return methodNotAllowed();

  } catch (error) {
    // @ts-ignore
    return serverError(error.message);
  }
}