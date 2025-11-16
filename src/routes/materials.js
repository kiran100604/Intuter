const express = require('express');
const { authenticate } = require('../middleware/auth');
const materialController = require('../controllers/materialController');

const router = express.Router();

router.post('/upload', authenticate, materialController.uploadMaterial);
router.get('/:materialId', authenticate, materialController.getMaterial);
router.delete('/:materialId', authenticate, materialController.deleteMaterial);
router.get('/session/:sessionId', authenticate, materialController.getSessionMaterials);

module.exports = router;
