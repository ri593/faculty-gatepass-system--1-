const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/securityController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');

router.use(authMiddleware, roleMiddleware('security'));

const passCodeBody = [body('passCode').trim().notEmpty().withMessage('passCode is required.').isLength({ max: 20 })];

router.get('/active', ctrl.activePasses);
router.get('/log', ctrl.log);
router.post('/scan', passCodeBody, validate, ctrl.scan);
router.put('/exit', passCodeBody, validate, ctrl.recordExit);
router.put('/entry', passCodeBody, validate, ctrl.recordEntry);

module.exports = router;
