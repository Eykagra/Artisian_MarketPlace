const express = require('express');
const productController = require('../controllers/productController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', productController.list);
router.get('/my', requireAuth, productController.myProducts);
router.get('/:id', productController.getById);
router.post('/', requireAuth, productController.create);
router.put('/:id', requireAuth, productController.update);
router.delete('/:id', requireAuth, productController.remove);

module.exports = router;
