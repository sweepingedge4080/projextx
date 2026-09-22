/* ============================================
   SparkLotto — Client App
   ============================================ */

const API = '';
const socket = io();

const state = {
  user: null,
  token: localStorage.getItem('sparklotto_token') || null,
  rooms: [],
  activeTier: 10,
  heroRoom: null,
};

// ---------- API HELPER ----------
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(API + path, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ============================================
// SPARKLOTTO — GLOBAL API
// ============================================
window.SparkLotto = {
  navigate(path) {
    window.location.href = path;
  },

  confirmAge() {
    localStorage.setItem('sparklotto_age_ok', '1');
    document.getElementById('age-modal').classList.add('hidden');
  },

  openAuthModal() {
    if (state.user) {
      window.location.href = '/account';
      return;
    }
    document.getElementById('auth-modal').classList.remove('hidden');
    this.showLogin();
  },

  closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
  },

  showLogin() {
    document.getElementById('auth-title').textContent = 'Sign In';
    document.getElementById('auth-fields-login').classList.remove('hidden');
    document.getElementById('auth-fields-register').classList.add('hidden');
  },

  showRegister() {
    document.getElementById('auth-title').textContent = 'Create Account';
    document.getElementById('auth-fields-login').classList.add('hidden');
    document.getElementById('auth-fields-register').classList.remove('hidden');
  },

  async doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit');

    if (!username || !password) return toast('Fill in both fields', 'error');

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('sparklotto_token', data.token);
      toast(`Welcome back, ${data.user.username}`, 'success');
      this.closeAuthModal();
      renderHeader();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  },

  async doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('reg-submit');

    if (!username || !email || !password)
      return toast('Fill in all fields', 'error');

    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { username, email, password },
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('sparklotto_token', data.token);
      toast(`Account created. Welcome, ${data.user.username}!`, 'success');
      this.closeAuthModal();
      renderHeader();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  },

  logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('sparklotto_token');
    toast('Signed out');
    setTimeout(() => window.location.href = '/', 600);
  },

  selectTier(tier) {
    state.activeTier = tier;
    const room = state.rooms.find((r) => r.tier === tier);
    if (room) {
      state.heroRoom = room;
      renderHero();
    }
    renderTierGrid();
  },

  async buyCurrentTicket() {
    if (!state.user) {
      toast('Please sign in first', 'error');
      return this.openAuthModal();
    }
    if (!state.heroRoom) return toast('No room selected', 'error');

    if (state.user.balance < state.heroRoom.tier) {
      toast(`Insufficient balance. Need ${state.heroRoom.tier} USDT`, 'error');
      return;
    }

    const btn = document.getElementById('hero-buy-btn');
    btn.disabled = true;
    document.getElementById('hero-buy-text').textContent = 'Buying…';

    try {
      const res = await api('/api/tickets/buy', {
        method: 'POST',
        body: { roomId: state.heroRoom._id },
      });

      state.user.balance = res.newBalance;
      renderHeader();
      toast(`🎟️ Ticket ${res.ticket.ticketCode} locked in!`, 'success');
      await loadRooms();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      document.getElementById('hero-buy-text').textContent = 'Join Room';
    }
  },
};

// ============================================
// RENDER HELPERS
// ============================================

function renderHeader() {
  const display = document.getElementById('wallet-display');
  const status = document.getElementById('header-status');

  if (state.user) {
    display.textContent = `${(state.user.balance || 0).toFixed(2)} USDT`;
  } else {
    display.textContent = 'Sign In';
  }

  if (state.rooms.length) {
    const open = state.rooms.filter((r) => r.status === 'filling').length;
    status.textContent = `${open}/${state.rooms.length} rooms open`;
  } else {
    status.textContent = 'Loading…';
  }
}

// ✅ FIXED: renderHero always updates DOM, including placeholder state
function renderHero() {
  const room = state.heroRoom;
  const timerEl = document.getElementById('hero-timer');
  const buyBtn  = document.getElementById('hero-buy-btn');
  const buyText = document.getElementById('hero-buy-text');
  const tierEl  = document.getElementById('hero-tier');
  const jackEl  = document.getElementById('hero-jackpot');
  const playersEl = document.getElementById('hero-players');
  const progressEl = document.getElementById('hero-progress');

  // No room loaded yet — show loading state
  if (!room) {
    tierEl.textContent = '$-- ROOM';
    jackEl.textContent = '0.00';
    playersEl.textContent = '0 / 10 players';
    progressEl.style.width = '0%';
    timerEl.textContent = 'Loading…';
    buyBtn.disabled = true;
    buyText.textContent = 'Loading…';
    return;
  }

  tierEl.textContent = `$${room.tier} ROOM`;
  jackEl.textContent = Number(room.prizePool || 0).toFixed(2);
  playersEl.textContent = `${room.filled} / ${room.capacity} players`;
  progressEl.style.width = ((room.filled / room.capacity) * 100) + '%';

  if (room.status === 'drawing') {
    timerEl.textContent = 'Drawing now…';
    buyBtn.disabled = true;
    buyText.textContent = 'Drawing…';
  } else if (room.status === 'closed') {
    timerEl.textContent = 'Round closed';
    buyBtn.disabled = true;
    buyText.textContent = 'Waiting for new room';
  } else if (room.filled >= room.capacity) {
    timerEl.textContent = 'Full — drawing soon';
    buyBtn.disabled = true;
    buyText.textContent = 'Room Full';
  } else {
    timerEl.textContent = 'Waiting for players';
    buyBtn.disabled = false;
    buyText.textContent = `Join for ${room.tier} USDT`;
  }
}

function renderTierGrid() {
  const grid = document.getElementById('tier-grid');
  grid.innerHTML = '';

  if (!state.rooms.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#64748b;padding:20px 0;">Loading rooms…</p>';
    return;
  }

  for (const room of state.rooms) {
    const card = document.createElement('button');
    card.className = 'tier-card';
    card.dataset.tier = room.tier;
    if (room.tier === state.activeTier) card.classList.add('active');
    if (room.status === 'drawing') card.classList.add('drawing');

    const pct = Math.round((room.filled / room.capacity) * 100);
    card.innerHTML = `
      <span class="tier-label">$${room.tier}</span>
      <span class="tier-price">${Number(room.prizePool || 0).toFixed(2)}</span>
      <span class="tier-meta">${room.filled}/${room.capacity} (${pct}%)</span>
    `;

    card.onclick = () => window.SparkLotto.selectTier(room.tier);
    grid.appendChild(card);
  }
}

function renderWinners(winners) {
  const list = document.getElementById('winners-list');
  if (!winners || !winners.length) {
    list.innerHTML = `<div class="winner-row"><span style="color:#64748b;">Waiting for first draw…</span></div>`;
    return;
  }

  list.innerHTML = '';
  for (const w of winners.slice(0, 4)) {
    const row = document.createElement('div');
    row.className = 'winner-row';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="winner-avatar" style="background:rgba(99,102,241,0.2);color:#818cf8;">$${w.tier}</div>
        <span class="winner-name">${escapeHtml(w.username)}</span>
      </div>
      <span class="winner-amount">+${Number(w.payout).toFixed(2)} USDT</span>
    `;
    list.appendChild(row);
  }
}

// ============================================
// TOAST + CONFETTI
// ============================================

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#10B981', '#8B5CF6', '#6366F1', '#F59E0B', '#EF4444'];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    r: Math.random() * 6 + 3,
    d: Math.random() * 2 + 1,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.d;
      p.x += Math.sin(frame / 20) * 0.5;
      if (p.y > canvas.height) p.y = -20;
    }
    frame++;
    if (frame < 200) requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  }
  draw();
}

// ============================================
// DATA LOADERS
// ============================================

async function loadRooms() {
  try {
    const data = await api('/api/rooms');
    state.rooms = data.rooms || [];

    // Pick default hero room
    if (!state.heroRoom || !state.rooms.find((r) => r.tier === state.heroRoom.tier)) {
      state.heroRoom = state.rooms.find((r) => r.tier === 10) || state.rooms[0] || null;
      if (state.heroRoom) state.activeTier = state.heroRoom.tier;
    } else {
      state.heroRoom = state.rooms.find((r) => r.tier === state.heroRoom.tier) || null;
    }

    renderHeader();
    renderHero();
    renderTierGrid();
  } catch (err) {
    console.error('loadRooms error:', err);
    renderHero(); // force loading state
    renderTierGrid();
  }
}

async function loadWinners() {
  try {
    const data = await api('/api/rooms/history');
    renderWinners(data.winners || []);
  } catch (err) {
    console.error('loadWinners error:', err);
  }
}

async function restoreSession() {
  if (!state.token) return;
  try {
    const data = await api('/api/auth/me');
    state.user = {
      id: data.user._id,
      username: data.user.username,
      email: data.user.email,
      balance: data.user.balance,
      isAdmin: data.user.isAdmin,
      walletAddress: data.user.walletAddress,
    };
    renderHeader();
  } catch (err) {
    state.token = null;
    localStorage.removeItem('sparklotto_token');
  }
}

// ============================================
// SOCKET EVENTS
// ============================================

socket.on('connect', () => console.log('🔌 socket connected'));

socket.on('room:updated', ({ roomId, filled, prizePool }) => {
  const room = state.rooms.find((r) => r._id === roomId);
  if (room) {
    room.filled = filled;
    room.prizePool = prizePool;
    if (state.heroRoom?._id === roomId) {
      state.heroRoom = room;
      renderHero();
    }
    renderTierGrid();
  }
});

socket.on('room:created', () => loadRooms());

socket.on('room:drawing', ({ roomId }) => {
  const room = state.rooms.find((r) => r._id === roomId);
  if (room) {
    room.status = 'drawing';
    if (state.heroRoom?._id === roomId) {
      state.heroRoom = room;
      renderHero();
    }
    renderTierGrid();
  }
});

socket.on('room:closed', (payload) => {
  if (payload.winnerUsername) {
    toast(`🎉 ${payload.winnerUsername} won ${payload.payout} USDT!`, 'success');
    fireConfetti();
  }
  loadRooms();
  loadWinners();
});

// ============================================
// BOOT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Age gate
  if (!localStorage.getItem('sparklotto_age_ok')) {
    document.getElementById('age-modal').classList.remove('hidden');
  } else {
    document.getElementById('age-modal').classList.add('hidden');
  }

  // Render hero immediately in loading state so it never looks empty
  renderHero();

  await restoreSession();
  await loadRooms();
  await loadWinners();

  // Fallback polling
  setInterval(loadWinners, 15000);
  setInterval(loadRooms, 20000);
});
