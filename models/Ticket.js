const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  roomId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tier:    { type: Number, required: true },
  ticketCode: {
    type: String,
    required: true,
    unique: true,
  },
  isWinner: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

ticketSchema.index({ roomId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', ticketSchema);
