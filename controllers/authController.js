const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { userId: user._id, username: user.username, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.register = async (req, res) => {
  try {
    const { username, email, password, walletAddress } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email, password required' });

    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ error: 'Username must be 3-20 chars' });

    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Invalid email' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be 6+ chars' });

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });
    if (existing)
      return res.status(409).json({ error: 'Username or email already in use' });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hash,
      walletAddress: walletAddress || null,
      isAdmin: email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase(),
    });

    const token = signToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.isBanned)
      return res.status(403).json({ error: 'Account suspended. Contact support.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateWallet = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || walletAddress.length < 10)
      return res.status(400).json({ error: 'Valid wallet address required' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.walletAddress = walletAddress.trim();
    await user.save();

    res.json({ ok: true, walletAddress: user.walletAddress });
  } catch (err) {
    console.error('updateWallet error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { username, email, walletAddress } = req.body;
    if (!username || !email || !walletAddress)
      return res.status(400).json({ error: 'All fields required' });

    console.log(`🔑 PASSWORD RESET REQUEST: ${username} / ${email} / ${walletAddress}`);

    res.json({
      ok: true,
      message: 'Request received. Support will contact you within 24h.',
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
