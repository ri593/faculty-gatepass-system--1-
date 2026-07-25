const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');

router.use(authMiddleware, roleMiddleware('admin'));

router.get('/users', ctrl.listUsers);
router.post(
  '/user',
  [
    body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters.'),
    body('employeeId').trim().isLength({ min: 2, max: 30 }).withMessage('Employee ID is required.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('role').isIn(['faculty', 'hod', 'dean', 'student', 'registrar', 'security', 'admin']).withMessage('Invalid role.'),
    body('departmentId').optional({ checkFalsy: true }).isInt(),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  ],
  validate,
  ctrl.createUser
);
router.put('/user/:id', [param('id').isInt()], validate, ctrl.updateUser);
router.delete('/user/:id', [param('id').isInt()], validate, ctrl.deleteUser);
router.get('/departments', ctrl.listDepartments);
router.get('/reports', ctrl.reports);

module.exports = router;
