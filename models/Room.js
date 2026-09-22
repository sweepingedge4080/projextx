const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  tier: {
    type: Number,
    required: true,
    enum: [1, 5, 10, 25, 50, 100, 500, 1000],
  },
  status: {
    type: String,
    enum: ['filling', 'drawing', 'closed'],
    default: 'filling',
  },
  capacity: {
    type: Number,
    required: true,
  },
  filled: {
    type: Number,
    default: 0,
  },
  prizePool: {
    type: Number,
    default: 0,
  },
  durationSeconds: {
    type: Number,
    required: true,
  },
  drawEndsAt: {
    type: Date,
    default: null,
  },
  commitHash: { type: String, default: null },
  revealedSeed: { type: String, default: null },
  winnerTicketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  winnerUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },
  createdAt: { type: Date, default: Date.now },
  closedAt:  { type: Date, default: null },
});

roomSchema.index({ tier: 1, status: 1 });
roomSchema.index({ drawEndsAt: 1 });

module.exports = mongoose.model('Room', roomSchema);
