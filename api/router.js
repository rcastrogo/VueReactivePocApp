
import { parseEntitySegments } from '../lib/request.js';
import { responseWrapper } from '../lib/response.js';

import userHandler from '../lib/handler/app_user.js';
import sessionHandler from '../lib/handler/app_session.js';
import userTypeHandler from '../lib/handler/tipo_usuario.js';

const handlers = {
  user: userHandler,
  session: sessionHandler,
  "user-type": userTypeHandler
};

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {

  const { notFound } = responseWrapper.wrap(res);
  const { entity, subpath} = parseEntitySegments(req.url || '');
  
  if (!entity || !handlers[entity]) {
    const message = `Entity not found: ${entity}, subpath: ${subpath.join('/')}`;
    return notFound(message);
  }
  
  const response = await handlers[entity](req, res, subpath);
  return response;

}