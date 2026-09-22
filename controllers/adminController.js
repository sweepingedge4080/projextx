const User = require('../models/User');
const Room = require('../models/Room');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction');
const Draw = require('../models/Draw');

exports.stats = async (_req, res) => {
  try {
    const [
      totalUsers,
      activeRooms,
      totalTickets,
      totalDraws,
      pendingDeposits,
      pendingWithdraws,
    ] = await Promise.all([
      User.countDocuments(),
      Room.countDocuments({ status: { $in: ['filling', 'drawing'] } }),
      Ticket.countDocuments(),
      Draw.countDocuments(),
      Transaction.countDocuments({ type: 'deposit', status: 'pending' }),
      Transaction.countDocuments({ type: 'withdraw', status: 'pending' }),
    ]);

    const balanceAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);
    const totalBalance = balanceAgg[0]?.total || 0;

    const revenueAgg = await Draw.aggregate([
      { $group: { _id: null, total: { $sum: '$houseCut' } } },
    ]);
    const revenue = revenueAgg[0]?.total || 0;

    res.json({
      totalUsers,
      activeRooms,
      totalTickets,
      totalDraws,
      pendingDeposits,
      pendingWithdraws,
      totalBalance: +totalBalance.toFixed(2),
      revenue: +revenue.toFixed(2),
    });
  } catch (err) {
    console.error('stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.pendingTransactions = async (_req, res) => {
  try {
    const txs = await Transaction.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('userId', 'username email walletAddress')
      .lean();
    res.json({ transactions: txs });
  } catch (err) {
    console.error('pendingTransactions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.approveDeposit = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.type !== 'deposit' || tx.status !== 'pending')
      return res.status(404).json({ error: 'Pending deposit not found' });

    const user = await User.findById(tx.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.balance = +(user.balance + tx.amount).toFixed(2);
    user.totalDeposited = +(user.totalDeposited + tx.amount).toFixed(2);
    await user.save();

    tx.status = 'completed';
    tx.balanceAfter = user.balance;
    tx.adminNote = req.body.note || 'Approved by admin';
    await tx.save();

    res.json({ ok: true, newBalance: user.balance });
  } catch (err) {
    console.error('approveDeposit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.rejectTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.status !== 'pending')
      return res.status(404).json({ error: 'Pending transaction not found' });

    const user = await User.findById(tx.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (tx.type === 'withdraw') {
      user.balance = +(user.balance + tx.amount).toFixed(2);
      await user.save();
    }

    tx.status = 'rejected';
    tx.adminNote = req.body.note || 'Rejected by admin';
    await tx.save();

    res.json({ ok: true });
  } catch (err) {
    console.error('rejectTransaction error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.completeWithdraw = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.type !== 'withdraw' || tx.status !== 'pending')
      return res.status(404).json({ error: 'Pending withdrawal not found' });

    const user = await User.findById(tx.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.totalWithdrawn = +(user.totalWithdrawn + tx.amount).toFixed(2);
    await user.save();

    tx.status = 'completed';
    tx.txHash = req.body.txHash || null;
    tx.adminNote = req.body.note || 'Payout sent';
    await tx.save();

    res.json({ ok: true });
  } catch (err) {
    console.error('completeWithdraw error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.freeTicket = async (req, res) => {
  try {
    const { roomId, username } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status !== 'filling')
      return res.status(400).json({ error: 'Room is not accepting tickets' });
    if (room.filled >= room.capacity)
      return res.status(400).json({ error: 'Room is full' });

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await Ticket.findOne({ roomId: room._id, userId: user._id });
    if (existing) return res.status(409).json({ error: 'User already in room' });

    const { customAlphabet } = require('nanoid');
    const ticketCodeGen = customAlphabet('0123456789ABCDEF', 6);
    const ticketCode = `TKT-${room.tier}-${ticketCodeGen()}`;

    const ticket = await Ticket.create({
      roomId: room._id,
      userId: user._id,
      tier: room.tier,
      ticketCode,
    });

    room.filled += 1;
    room.prizePool = +(room.prizePool + room.tier).toFixed(2);
    await room.save();

    res.status(201).json({ ok: true, ticket });
  } catch (err) {
    console.error('freeTicket error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.listUsers = async (_req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.toggleBan = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isBanned = !user.isBanned;
    await user.save();
    res.json({ ok: true, isBanned: user.isBanned });
  } catch (err) {
    console.error('toggleBan error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.forceDraw = async (req, res) => {
  try {
    const { runDraw } = require('../services/roomManager');
    const io = req.app.get('io');
    await runDraw(req.params.id, io);
    res.json({ ok: true });
  } catch (err) {
    console.error('forceDraw error:', err);
    res.status(500).json({ error: err.message });
  }
};
