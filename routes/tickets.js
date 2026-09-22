const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/ticketController');

router.post('/buy', auth, c.buyTicket);
router.get('/mine', auth, c.myTickets);
router.get('/history', c.roomHistory);

module.exports = router;
