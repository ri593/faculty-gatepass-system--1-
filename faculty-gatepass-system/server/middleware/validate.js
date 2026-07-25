const { validationResult } = require('express-validator');

/**
 * Runs after an array of express-validator check(...) rules on a route.
 * Collects any failures into a single 400 response instead of letting
 * bad input reach the controller / database.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
