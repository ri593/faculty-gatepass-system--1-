const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/facultyController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');

router.use(authMiddleware, roleMiddleware('faculty', 'hod', 'dean', 'student'));

router.get('/dashboard', ctrl.dashboard);
router.post(
  '/create-pass',
  [
    body('purpose').trim().isLength({ min: 3, max: 255 }).withMessage('Purpose must be 3-255 characters.'),
    body('date').isISO8601().withMessage('A valid date (YYYY-MM-DD) is required.'),
    body('outTime').trim().isLength({ min: 1, max: 20 }).withMessage('Out time is required.'),
    body('expectedReturn').trim().isLength({ min: 1, max: 20 }).withMessage('Expected return time is required.'),
    body('destination').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  ],
  validate,
  ctrl.createPass
);
router.get('/history', ctrl.history);
router.get('/pass/:id', [param('id').isInt()], validate, ctrl.passDetail);
router.get('/profile', ctrl.profile);

module.exports = router;
