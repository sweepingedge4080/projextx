const router = require('express').Router();
const c = require('../controllers/roomController');

router.get('/', c.listOpen);
router.get('/history', c.recentWinners);
router.get('/draw/:drawId/verify', c.verifyDraw);
router.get('/:id', c.getRoom);

module.exports = router;
