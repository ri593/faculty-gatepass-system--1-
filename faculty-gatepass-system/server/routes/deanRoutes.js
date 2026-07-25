const express = require('express');
const { param, body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/deanController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');

router.use(authMiddleware, roleMiddleware('dean'));

const idAndRemarks = [
  param('id').isInt().withMessage('Invalid pass id.'),
  body('remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

router.get('/pending', ctrl.pending);
router.get('/history', ctrl.history);
router.put('/approve/:id', idAndRemarks, validate, ctrl.approve);
router.put('/reject/:id', idAndRemarks, validate, ctrl.reject);

module.exports = router;