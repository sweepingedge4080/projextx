const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'ticket_purchase', 'prize_win', 'admin_credit'],
    required: true,
  },
  amount:       { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'rejected'],
    default: 'completed',
  },
  walletAddress: { type: String, default: null },
  txHash:        { type: String, default: null },
  adminNote:     { type: String, default: null },
  roomId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  createdAt:     { type: Date, default: Date.now },
});

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
