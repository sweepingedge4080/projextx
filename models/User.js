const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  walletAddress: {
    type: String,
    default: null,
    trim: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  totalWon:       { type: Number, default: 0 },
  createdAt:      { type: Date, default: Date.now },
  lastLoginAt:    { type: Date, default: null },
});

module.exports = mongoose.model('User', userSchema);
