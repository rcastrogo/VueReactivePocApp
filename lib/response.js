export const responseWrapper = {
  /**
   * @param {import('@vercel/node').VercelResponse} res
   * @param {any} [data]
   * @param {number} [statusCode=200]
   */
  ok: (res, data = null, statusCode = 200) => 
    res.status(statusCode).json(data),

  noContent: (res, statusCode = 204) => 
    res.status(statusCode).end(),

  optionsOk: (res) =>
    res.status(200).end(),

  created: (res, data) => 
    res.status(201).json(data),

  badRequest: (res, message = 'Datos de entrada inválidos') => 
    res.status(400).json({ success: false, error: message }),

  notFound: (res, message = 'Recurso no encontrado') => 
    res.status(404).json({ success: false, error: message }),

  unauthorized: (res, data = { success: false, error: 'Unauthorized' }) =>
    res.status(401).json(typeof data === 'string' ? { success: false, error: data } : data),

  forbidden: (res, data = { success: false, error: 'Forbidden' }) =>
    res.status(403).json(typeof data === 'string' ? { success: false, error: data } : data),

  methodNotAllowed: (res) => 
    res.status(405).json({ success: false, error: 'Method Not Allowed' }),

  serverError: (res, message = 'Internal Server Error') => 
    res.status(500).json({ success: false, error: message }),
  /**
   * @param {import('@vercel/node').VercelResponse} res
   */
  wrap: (res) => ({
    /**
     * @param {any} [data]
     * @param {number} [statusCode=200]
     */
    ok: (data = null, statusCode = 200) => responseWrapper.ok(res, data, statusCode),
    html: (html) =>  res.status(200).setHeader('Content-Type', 'text/html').send(html),
    created: (data) => responseWrapper.created(res, data),
    badRequest: (message = 'Datos de entrada inválidos') => responseWrapper.badRequest(res, message),
    notFound: (message = 'Recurso no encontrado') => responseWrapper.notFound(res, message),
    unauthorized: (data) => responseWrapper.unauthorized(res, data),
    forbidden: (data) => responseWrapper.forbidden(res, data),
    methodNotAllowed: () => responseWrapper.methodNotAllowed(res),
    serverError: (message = 'Internal Server Error') => responseWrapper.serverError(res, message),
    noContent: (statusCode = 204) => responseWrapper.noContent(res, statusCode),
    optionsOk: () => responseWrapper.optionsOk(res),
    setCorsHeaders: (methods = 'GET, POST, PUT, DELETE, OPTIONS') => {
      res.setHeader('Access-Control-Allow-Credentials', 'true')
          .setHeader('Access-Control-Allow-Origin', '*')
          .setHeader('Access-Control-Allow-Methods', methods)
          .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
  })
};