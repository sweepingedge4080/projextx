const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.requestDeposit = async (req, res) => {
  try {
    const { amount, txHash, walletAddress } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'Valid amount required' });
    if (!txHash) return res.status(400).json({ error: 'txHash required' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tx = await Transaction.create({
      userId: user._id,
      type: 'deposit',
      amount,
      balanceAfter: user.balance,
      status: 'pending',
      txHash,
      walletAddress: walletAddress || user.walletAddress,
      adminNote: 'Pending manual on-chain verification',
    });

    console.log(`💰 DEPOSIT REQUEST: ${user.username} / ${amount} / ${txHash}`);

    res.status(201).json({
      ok: true,
      transactionId: tx._id,
      message: 'Deposit request submitted. Pending verification (usually < 30 min).',
    });
  } catch (err) {
    console.error('requestDeposit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.requestWithdraw = async (req, res) => {
  try {
    const { amount, walletAddress } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'Valid amount required' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.balance < amount)
      return res.status(400).json({ error: `Insufficient balance. Available: ${user.balance}` });

    const dest = walletAddress || user.walletAddress;
    if (!dest || dest.length < 10)
      return res.status(400).json({ error: 'Wallet address required' });

    user.balance = +(user.balance - amount).toFixed(2);
    await user.save();

    const tx = await Transaction.create({
      userId: user._id,
      type: 'withdraw',
      amount,
      balanceAfter: user.balance,
      status: 'pending',
      walletAddress: dest,
      adminNote: 'Pending manual payout',
    });

    console.log(`💸 WITHDRAW REQUEST: ${user.username} / ${amount} → ${dest}`);

    res.status(201).json({
      ok: true,
      transactionId: tx._id,
      newBalance: user.balance,
      message: 'Withdrawal request submitted. Support will process shortly.',
    });
  } catch (err) {
    console.error('requestWithdraw error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.myTransactions = async (req, res) => {
  try {
    const txs = await Transaction.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ transactions: txs });
  } catch (err) {
    console.error('myTransactions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.depositAddress = async (_req, res) => {
  res.json({
    TRC20: process.env.DEPOSIT_WALLET_USDT_TRC20 || 'not-configured',
    ERC20: process.env.DEPOSIT_WALLET_USDT_ERC20 || 'not-configured',
    BEP20: process.env.DEPOSIT_WALLET_USDT_BEP20 || 'not-configured',
    note: 'Send USDT on the matching network, then submit the transaction hash in the app.',
  });
};
