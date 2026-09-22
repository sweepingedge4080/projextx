const router = require('express').Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const c = require('../controllers/adminController');

router.use(auth, adminOnly);

router.get('/stats', c.stats);
router.get('/transactions/pending', c.pendingTransactions);
router.post('/transactions/:id/approve-deposit', c.approveDeposit);
router.post('/transactions/:id/reject', c.rejectTransaction);
router.post('/transactions/:id/complete-withdraw', c.completeWithdraw);
router.post('/free-ticket', c.freeTicket);
router.get('/users', c.listUsers);
router.post('/users/:id/toggle-ban', c.toggleBan);
router.post('/rooms/:id/force-draw', c.forceDraw);

module.exports = router;
