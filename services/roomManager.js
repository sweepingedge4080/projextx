const cron = require('node-cron');
const Room = require('../models/Room');
const Ticket = require('../models/Ticket');
const Draw = require('../models/Draw');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { generateSeed, commitHash, pickWinnerIndex } = require('./rng');

const TIER_CONFIG = {
  1:    { capacity: 10, durationSeconds: 180 },
  5:    { capacity: 10, durationSeconds: 300 },
  10:   { capacity: 10, durationSeconds: 480 },
  25:   { capacity: 10, durationSeconds: 600 },
  50:   { capacity: 10, durationSeconds: 900 },
  100:  { capacity: 10, durationSeconds: 1800 },
  500:  { capacity: 10, durationSeconds: 3600 },
  1000: { capacity: 10, durationSeconds: 18000 },
};

const TIERS = Object.keys(TIER_CONFIG).map(Number);

async function ensureOpenRooms(io) {
  for (const tier of TIERS) {
    const exists = await Room.findOne({ tier, status: 'filling' });
    if (!exists) {
      const room = await Room.create({
        tier,
        capacity: TIER_CONFIG[tier].capacity,
        durationSeconds: TIER_CONFIG[tier].durationSeconds,
        status: 'filling',
      });
      console.log(`🆕 Room spawned: tier $${tier} (room ${room._id})`);
      if (io) io.emit('room:created', { tier, roomId: room._id });
    }
  }
}

async function runDraw(roomId, io) {
  const room = await Room.findById(roomId);
  if (!room || room.status !== 'filling' || room.filled < room.capacity) return;

  room.status = 'drawing';
  await room.save();
  io?.emit('room:drawing', { roomId: room._id });

  const tickets = await Ticket.find({ roomId: room._id });
  const codes = tickets.map((t) => t.ticketCode);

  if (codes.length !== room.capacity) {
    room.status = 'filling';
    await room.save();
    console.warn(`⚠️ Room ${room._id} capacity mismatch`);
    return;
  }

  const seed = generateSeed();
  const commit = commitHash(seed, codes);

  room.commitHash = commit;
  await room.save();
  io?.emit('room:commit', { roomId: room._id, commitHash: commit });

  await new Promise((r) => setTimeout(r, 5000));

  const winnerIndex = pickWinnerIndex(seed, codes);
  const winnerTicket = tickets[winnerIndex];

  const houseCutPct = Number(process.env.HOUSE_CUT_PERCENT || 17);
  const prizePool = room.prizePool;
  const houseCut = +(prizePool * (houseCutPct / 100)).toFixed(2);
  const payout = +(prizePool - houseCut).toFixed(2);

  const winnerUser = await User.findById(winnerTicket.userId);
  if (winnerUser) {
    winnerUser.balance = +(winnerUser.balance + payout).toFixed(2);
    winnerUser.totalWon = +(winnerUser.totalWon + payout).toFixed(2);
    await winnerUser.save();

    await Transaction.create({
      userId: winnerUser._id,
      type: 'prize_win',
      amount: payout,
      balanceAfter: winnerUser.balance,
      roomId: room._id,
      status: 'completed',
    });
  }

  winnerTicket.isWinner = true;
  await winnerTicket.save();

  room.status = 'closed';
  room.winnerTicketId = winnerTicket._id;
  room.winnerUserId = winnerTicket.userId;
  room.revealedSeed = seed;
  room.closedAt = new Date();
  await room.save();

  await Draw.create({
    roomId: room._id,
    tier: room.tier,
    ticketIds: tickets.map((t) => t._id),
    commitHash: commit,
    revealedSeed: seed,
    winnerTicketId: winnerTicket._id,
    winnerUserId: winnerTicket.userId,
    prizePool,
    houseCut,
    payout,
  });

  console.log(`🎉 Room ${room._id} ($${room.tier}) → winner ${winnerTicket.ticketCode} (${payout} USDT)`);

  io?.emit('room:closed', {
    roomId: room._id,
    tier: room.tier,
    winnerTicketCode: winnerTicket.ticketCode,
    winnerUsername: winnerUser?.username || 'unknown',
    prizePool,
    payout,
    revealedSeed: seed,
    commitHash: commit,
  });

  await ensureOpenRooms(io);
}

function startRoomManager(io) {
  ensureOpenRooms(io).catch((err) => console.error('❌ ensureOpenRooms failed:', err));

  cron.schedule('*/5 * * * * *', async () => {
    try {
      const filled = await Room.find({
        status: 'filling',
        $expr: { $gte: ['$filled', '$capacity'] },
      });
      for (const r of filled) runDraw(r._id, io);

      const openCount = await Room.countDocuments({ status: 'filling' });
      if (openCount < TIERS.length) await ensureOpenRooms(io);
    } catch (err) {
      console.error('❌ roomManager tick error:', err);
    }
  });

  console.log('⏱️  Room manager started (5s tick)');
}

module.exports = { startRoomManager, ensureOpenRooms, runDraw, TIER_CONFIG, TIERS };
