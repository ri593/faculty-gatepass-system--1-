const { verifyToken } = require('../config/jwt');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token>' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, name, role, departmentId, employeeId }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

module.exports = authMiddleware;
