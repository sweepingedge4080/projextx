const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/authController');

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/me', auth, c.me);
router.post('/wallet', auth, c.updateWallet);
router.post('/forgot-password', c.forgotPassword);

module.exports = router;
