const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response.utils');

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.cookies?.safio_token || null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return sendError(res, 'Non authentifié.', 401);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    return next();
  } catch (error) {
    return sendError(res, 'Session invalide.', 401);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return sendError(res, 'Accès refusé pour ce rôle.', 403);
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
