const Room = require('../models/Room');
const Ticket = require('../models/Ticket');
const Draw = require('../models/Draw');

exports.listOpen = async (_req, res) => {
  try {
    const rooms = await Room.find({ status: { $in: ['filling', 'drawing'] } })
      .sort({ tier: 1 })
      .lean();

    const enriched = await Promise.all(
      rooms.map(async (r) => {
        const tickets = await Ticket.find({ roomId: r._id })
          .populate('userId', 'username')
          .select('ticketCode userId createdAt')
          .lean();

        return {
          ...r,
          players: tickets.map((t) => ({
            ticketCode: t.ticketCode,
            username: t.userId?.username || 'anon',
            joinedAt: t.createdAt,
          })),
        };
      })
    );

    res.json({ rooms: enriched });
  } catch (err) {
    console.error('listOpen error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const tickets = await Ticket.find({ roomId: room._id })
      .populate('userId', 'username')
      .select('ticketCode userId isWinner createdAt')
      .lean();

    res.json({ room, tickets });
  } catch (err) {
    console.error('getRoom error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.recentWinners = async (_req, res) => {
  try {
    const draws = await Draw.find()
      .sort({ drawnAt: -1 })
      .limit(20)
      .populate('winnerUserId', 'username')
      .populate('winnerTicketId', 'ticketCode')
      .lean();

    const winners = draws.map((d) => ({
      tier: d.tier,
      prizePool: d.prizePool,
      payout: d.payout,
      drawnAt: d.drawnAt,
      username: d.winnerUserId?.username || 'anon',
      ticketCode: d.winnerTicketId?.ticketCode || 'unknown',
      commitHash: d.commitHash,
      revealedSeed: d.revealedSeed,
    }));

    res.json({ winners });
  } catch (err) {
    console.error('recentWinners error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.verifyDraw = async (req, res) => {
  try {
    const draw = await Draw.findById(req.params.drawId).lean();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const tickets = await Ticket.find({ _id: { $in: draw.ticketIds } })
      .select('ticketCode _id')
      .lean();

    res.json({
      drawId: draw._id,
      tier: draw.tier,
      commitHash: draw.commitHash,
      revealedSeed: draw.revealedSeed,
      ticketCodes: tickets.map((t) => t.ticketCode),
      winnerTicketId: draw.winnerTicketId,
      drawnAt: draw.drawnAt,
    });
  } catch (err) {
    console.error('verifyDraw error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
