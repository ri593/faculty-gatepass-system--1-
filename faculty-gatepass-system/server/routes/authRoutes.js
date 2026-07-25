const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 1 }).withMessage('Password is required.'),
  ],
  validate,
  authController.login
);
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters.'),
    body('employeeId').trim().isLength({ min: 2, max: 30 }).withMessage('ID number is required.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('departmentId').isInt().withMessage('Department is required.'),
    body('role').isIn(['faculty', 'hod', 'dean', 'student']).withMessage('Invalid account role.'),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  ],
  validate,
  authController.register
);
router.get('/departments', authController.departments);
router.post('/logout', authController.logout);
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('A valid email is required.').normalizeEmail()],
  validate,
  authController.forgotPassword
);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
