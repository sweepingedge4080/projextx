const mongoose = require('mongoose');

const drawSchema = new mongoose.Schema({
  roomId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  tier:          { type: Number, required: true },
  ticketIds:     { type: [mongoose.Schema.Types.ObjectId], required: true },
  commitHash:    { type: String, required: true },
  revealedSeed:  { type: String, required: true },
  winnerTicketId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  winnerUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  prizePool:     { type: Number, required: true },
  houseCut:      { type: Number, required: true },
  payout:        { type: Number, required: true },
  drawnAt:       { type: Date, default: Date.now },
});

module.exports = mongoose.model('Draw', drawSchema);
