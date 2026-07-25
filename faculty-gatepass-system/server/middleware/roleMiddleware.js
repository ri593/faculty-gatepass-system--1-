/**
 * Usage: roleMiddleware('hod', 'admin') -> only these roles may proceed.
 * Must run after authMiddleware (relies on req.user.role).
 */
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires role: ${allowedRoles.join(' or ')}.` });
    }
    next();
  };
}

module.exports = roleMiddleware;
