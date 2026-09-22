const Room = require('../models/Room');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { customAlphabet } = require('nanoid');

const ticketCodeGen = customAlphabet('0123456789ABCDEF', 6);

exports.buyTicket = async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ error: 'roomId required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status !== 'filling')
      return res.status(400).json({ error: 'Room is not accepting tickets' });
    if (room.filled >= room.capacity)
      return res.status(400).json({ error: 'Room is full' });

    const existing = await Ticket.findOne({ roomId: room._id, userId: req.user.userId });
    if (existing)
      return res.status(409).json({ error: 'You already have a ticket in this room' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.balance < room.tier)
      return res.status(400).json({ error: `Insufficient balance. Need ${room.tier} USDT` });

    user.balance = +(user.balance - room.tier).toFixed(2);
    await user.save();

    const ticketCode = `TKT-${room.tier}-${ticketCodeGen()}`;
    const ticket = await Ticket.create({
      roomId: room._id,
      userId: user._id,
      tier: room.tier,
      ticketCode,
    });

    await Transaction.create({
      userId: user._id,
      type: 'ticket_purchase',
      amount: room.tier,
      balanceAfter: user.balance,
      roomId: room._id,
      status: 'completed',
    });

    room.filled += 1;
    room.prizePool = +(room.prizePool + room.tier).toFixed(2);
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('room:updated', {
        roomId: room._id,
        tier: room.tier,
        filled: room.filled,
        capacity: room.capacity,
        prizePool: room.prizePool,
      });
    }

    res.status(201).json({
      ticket: {
        id: ticket._id,
        ticketCode: ticket.ticketCode,
        tier: ticket.tier,
        roomId: ticket.roomId,
      },
      newBalance: user.balance,
      room: {
        filled: room.filled,
        capacity: room.capacity,
        prizePool: room.prizePool,
        status: room.status,
      },
    });
  } catch (err) {
    console.error('buyTicket error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.myTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('roomId', 'tier status filled capacity winnerTicketId prizePool closedAt')
      .lean();

    const enriched = tickets.map((t) => {
      const isWinner = t.isWinner;
      const wonAmount = isWinner && t.roomId
        ? +(t.roomId.prizePool * 0.83).toFixed(2)
        : null;
      return { ...t, room: t.roomId, wonAmount };
    });

    res.json({ tickets: enriched });
  } catch (err) {
    console.error('myTickets error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.roomHistory = async (_req, res) => {
  try {
    const rooms = await Room.find({ status: 'closed' })
      .sort({ closedAt: -1 })
      .limit(50)
      .lean();
    res.json({ rooms });
  } catch (err) {
    console.error('roomHistory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
