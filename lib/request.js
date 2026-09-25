

function getFirstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeCookieValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRequest(reqOrRes) {
  return reqOrRes?.req || reqOrRes;
}

function serializeCookie(name, value, options = {}) {
  const {
    httpOnly = true,
    path = '/',
    maxAge,
    sameSite = 'Lax',
    secure = false
  } = options;

  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (path) parts.push(`Path=${path}`);
  if (httpOnly) parts.push('HttpOnly');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push('Secure');

  return parts.join('; ');
}

export const requestWrapper = {
  getRequestOrigin: (req) => {
    const forwardedProto = getFirstQueryValue(req.headers['x-forwarded-proto']);
    const protocol = forwardedProto || req.protocol || 'http';
    return `${protocol}://${req.headers.host}`;
  },
  getCookieValue: (req, name) => {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${escapeRegExp(name)}=([^;]*)`));
    return match ? decodeCookieValue(match[1]) : null;
  },
  serializeCookie,
  clearCookie: (name, options = {}) => serializeCookie(name, '', { ...options, maxAge: 0 }),
  wrap: (reqOrRes) => {
    const req = getRequest(reqOrRes);
    const origin = requestWrapper.getRequestOrigin(req);
    const secure = origin.startsWith('https://');
    return {
      req,
      origin,
      secure,
      getCookieValue: (name) => requestWrapper.getCookieValue(req, name),
      serializeCookie: (name, value, options = {}) => serializeCookie(name, value, { secure, ...options }),
      clearCookie: (name, options = {}) => requestWrapper.clearCookie(name, { secure, ...options }),
      getFirstQueryValue,
      isAuthenticated: () => {
        const token = requestWrapper.getCookieValue(req, 'session_token');
        console.log('Authentication token:', token);
        if (!token) 
          return null;
        return token;
      }
    };
  }
};

/**
 * Extrae los segmentos relevantes de la URL.
 * Fuente de verdad: req.url
 *
 * Asume estructura: /api/<collection>/<entity>/[...subpath]
 * Ejemplo: "/api/entity/user/profile/42" → { entity: "user", subpath: ["profile", "42"] }
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.entityIndex=2] - Índice del segmento que representa la entidad (0-based, ignorando el slash inicial)
 * @returns {{ entity: string|null, subpath: string[] }}
 */
export function parseEntitySegments(url, { entityIndex = 2 } = {}) {
  const pathname = url.split('?')[0];
  const segments = pathname.split('/').filter(Boolean);
  const entity = segments[entityIndex] ?? null;
  const subpath = segments.slice(entityIndex + 1);
  return { entity, subpath };
}