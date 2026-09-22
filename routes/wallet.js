const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/walletController');

router.get('/deposit-address', auth, c.depositAddress);
router.post('/deposit', auth, c.requestDeposit);
router.post('/withdraw', auth, c.requestWithdraw);
router.get('/transactions', auth, c.myTransactions);

module.exports = router;
