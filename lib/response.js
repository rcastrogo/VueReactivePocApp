export const responseWrapper = {
  /**
   * @param {import('@vercel/node').VercelResponse} res
   * @param {any} [data]
   * @param {number} [statusCode=200]
   */
  ok: (res, data = null, statusCode = 200) => 
    res.status(statusCode).json(data),

  created: (res, data) => 
    res.status(201).json(data),

  badRequest: (res, message = 'Datos de entrada inválidos') => 
    res.status(400).json({ success: false, error: message }),

  notFound: (res, message = 'Recurso no encontrado') => 
    res.status(404).json({ success: false, error: message }),

  methodNotAllowed: (res) => 
    res.status(405).json({ success: false, error: 'Method Not Allowed' }),

  serverError: (res, message = 'Internal Server Error') => 
    res.status(500).json({ success: false, error: message }),
  /**
   * @param {import('@vercel/node').VercelResponse} res
   */
  wrapp: (res) => ({
    /**
     * @param {any} [data]
     * @param {number} [statusCode=200]
     */
    ok: (data = null, statusCode = 200) => responseWrapper.ok(res, data, statusCode),
    created: (data) => responseWrapper.created(res, data),
    badRequest: (message = 'Datos de entrada inválidos') => responseWrapper.badRequest(res, message),
    notFound: (message = 'Recurso no encontrado') => responseWrapper.notFound(res, message),
    methodNotAllowed: () => responseWrapper.methodNotAllowed(res),
    serverError: (message = 'Internal Server Error') => responseWrapper.serverError(res, message)
  })
};