require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { attachSocketHandlers } = require('./services/sockets');
const { startRoomManager } = require('./services/roomManager');

// ---------- APP + SERVER ----------
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.set('io', io);

// ---------- SECURITY & PARSING ----------
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- STATIC FILES ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ROUTES ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));

// ---------- HEALTH CHECK ----------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'SparkLotto',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---------- PAGE ROUTES ----------
const pages = ['tickets', 'winners', 'account', 'admin'];
for (const page of pages) {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', `${page}.html`));
  });
}

// ---------- SPA FALLBACK ----------
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- 404 FOR UNKNOWN API ROUTES ----------
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// ---------- GLOBAL ERROR HANDLER ----------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ---------- BOOT ----------
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    console.log('✅ Database connected');

    attachSocketHandlers(io);
    console.log('✅ Socket handlers attached');

    startRoomManager(io);
    console.log('✅ Room manager started');

    server.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 SparkLotto running on port ${PORT}`);
      console.log(`   ENV:    ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Local:  http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (err) {
    console.error('❌ Boot failed:', err.message);
    process.exit(1);
  }
})();

// ---------- SAFETY NETS ----------
process.on('unhandledRejection', (err) => console.error('❌ Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('❌ Uncaught Exception:', err));

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM — shutting down');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT — shutting down');
  server.close(() => process.exit(0));
});
