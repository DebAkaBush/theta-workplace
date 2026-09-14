const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const nodemailer = require('nodemailer');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const TAILSCALE_MODE = process.env.TAILSCALE_MODE === 'true';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const FEEDBACK_TO = 'admin.theta.server@gmail.com';
const feedbackTransport = process.env.FEEDBACK_SMTP_HOST && process.env.FEEDBACK_SMTP_USER && process.env.FEEDBACK_SMTP_PASS
  ? nodemailer.createTransport({ host: process.env.FEEDBACK_SMTP_HOST, port: Number(process.env.FEEDBACK_SMTP_PORT) || 587, secure: process.env.FEEDBACK_SMTP_SECURE === 'true', auth: { user: process.env.FEEDBACK_SMTP_USER, pass: process.env.FEEDBACK_SMTP_PASS } })
  : null;
const sessions = new Map();
const requestResults = new Map();
const requestTokens = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
let rooms = loadRooms();

function loadRooms() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveRooms() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
}

function saveFeedback(feedback) {
  let entries = [];
  try { entries = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch { }
  entries.push(feedback);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(entries.slice(-1000), null, 2));
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    protected: Boolean(room.passwordHash),
    memberCount: room.members.length,
    messageCount: room.messages.length,
    updatedAt: room.updatedAt
  };
}

function sessionFromRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return token ? sessions.get(token) : null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function validPassword(password, room) {
  if (!room.passwordHash) return true;
  const candidate = crypto.scryptSync(password || '', room.passwordSalt, 64);
  const stored = Buffer.from(room.passwordHash, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Geçersiz JSON')); }
    });
    req.on('error', reject);
  });
}

function roomFromRequest(req, id) {
  const session = sessionFromRequest(req);
  if (!session || session.roomId !== id) return null;
  return rooms.find(room => room.id === id) || null;
}

function tailscaleAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && entry.address.startsWith('100.')) return entry.address;
    }
  }
  return null;
}

function tailscaleIdentity(req) {
  if (!TAILSCALE_MODE) return null;
  const login = req.headers['tailscale-user-login'];
  if (!login) return null;
  return {
    login: String(login).slice(0, 160),
    name: String(req.headers['tailscale-user-name'] || login).slice(0, 32)
  };
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) return json(res, 404, { error: 'Sayfa bulunamadı' });
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function networkAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.') && !entry.address.startsWith('192.168.56.') && !entry.address.startsWith('192.168.176.')) candidates.push(entry.address);
    }
  }
  return candidates.find(address => address.startsWith('192.168.')) || candidates[0] || 'localhost';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method;
  const pathname = url.pathname;

  if (method === 'GET' && (pathname === '/' || pathname === '/embed')) return sendFile(res, path.join(ROOT, 'public', 'index.html'), 'text/html; charset=utf-8');
  if (method === 'GET' && pathname === '/guide') return sendFile(res, path.join(ROOT, 'public', 'guide.html'), 'text/html; charset=utf-8');
  if (method === 'GET' && pathname === '/app.js') return sendFile(res, path.join(ROOT, 'public', 'app.js'), 'text/javascript; charset=utf-8');
  if (method === 'GET' && pathname === '/guide.js') return sendFile(res, path.join(ROOT, 'public', 'guide.js'), 'text/javascript; charset=utf-8');
  if (method === 'GET' && pathname === '/styles.css') return sendFile(res, path.join(ROOT, 'public', 'styles.css'), 'text/css; charset=utf-8');

  if (method === 'GET' && pathname === '/api/session') {
    return json(res, 200, { online: true, tailscale: TAILSCALE_MODE, tailscaleIp: tailscaleAddress(), localIp: networkAddress(), identity: tailscaleIdentity(req) });
  }

  if (method === 'POST' && pathname === '/api/feedback') {
    try {
      const input = await body(req);
      const message = String(input.message || '').trim().slice(0, 5000);
      const name = String(input.name || 'Anonim').trim().slice(0, 80) || 'Anonim';
      const email = String(input.email || '').trim().slice(0, 160);
      const category = String(input.category || 'Genel').trim().slice(0, 40) || 'Genel';
      if (message.length < 5) return json(res, 400, { error: 'Feedback en az 5 karakter olmalı.' });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Geçerli bir e-posta adresi girin.' });
      const feedback = { id: crypto.randomBytes(8).toString('hex'), name, email, category, message, createdAt: Date.now(), sent: false };
      saveFeedback(feedback);
      if (!feedbackTransport) return json(res, 202, { saved: true, sent: false, message: 'Feedback kaydedildi. SMTP ayarı olmadığı için e-posta gönderilmedi.' });
      await feedbackTransport.sendMail({ from: process.env.FEEDBACK_FROM || process.env.FEEDBACK_SMTP_USER, to: FEEDBACK_TO, replyTo: email || undefined, subject: `[theta-workplace] ${category} feedback`, text: `Gönderen: ${name}\nE-posta: ${email || 'Belirtilmedi'}\nKategori: ${category}\n\n${message}` });
      feedback.sent = true; saveFeedback(feedback);
      return json(res, 201, { saved: true, sent: true });
    } catch (error) { return json(res, 502, { error: 'Feedback kaydedilemedi veya gönderilemedi.' }); }
  }

  if (pathname === '/api/rooms' && method === 'GET') {
    return json(res, 200, rooms.map(publicRoom).sort((a, b) => b.updatedAt - a.updatedAt));
  }

  if (pathname === '/api/rooms' && method === 'POST') {
    try {
      const input = await body(req);
      const name = String(input.name || '').trim().slice(0, 60);
      const password = String(input.password || '');
      const ownerNickname = String(input.ownerNickname || '').trim().slice(0, 32);
      if (name.length < 2) return json(res, 400, { error: 'Oda adı en az 2 karakter olmalı.' });
      if (ownerNickname.length < 2) return json(res, 400, { error: 'Oda sahibi adı en az 2 karakter olmalı.' });
      if (password && password.length < 4) return json(res, 400, { error: 'Parola en az 4 karakter olmalı.' });
      const room = {
        id: crypto.randomBytes(8).toString('hex'), name,
        ...password ? (() => { const result = hashPassword(password); return { passwordSalt: result.salt, passwordHash: result.hash }; })() : {},
        ownerId: crypto.randomBytes(12).toString('hex'), members: [ownerNickname], messages: [], requests: [], createdAt: Date.now(), updatedAt: Date.now()
      };
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, { roomId: room.id, nickname: ownerNickname, role: 'owner' });
      rooms.push(room); saveRooms();
      return json(res, 201, { token, nickname: ownerNickname, owner: true, room: publicRoom(room), messages: [] });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(join|messages|command))?$/);
  const requestMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/requests(?:\/([^/]+)(?:\/(approve|deny))?)?$/);
  if (roomMatch || requestMatch) {
    const id = roomMatch ? roomMatch[1] : requestMatch[1];
    const action = roomMatch?.[2];
    const room = rooms.find(item => item.id === id);
    if (!room) return json(res, 404, { error: 'Oda bulunamadı.' });

    if (action === 'command' && method === 'POST') {
      const session = sessionFromRequest(req);
      if (!session || session.roomId !== id) return json(res, 401, { error: 'Bu oda için giriş yapmanız gerekiyor.' });
      try {
        const input = await body(req);
        const command = String(input.command || '').trim().toLowerCase();
        if (command !== '/turnoff') return json(res, 400, { error: 'Bilinmeyen komut.' });
        if (room.passwordHash && !validPassword(String(input.password || ''), room)) return json(res, 401, { error: 'Oda parolası hatalı.' });
        rooms = rooms.filter(item => item.id !== id);
        for (const [token, activeSession] of sessions) {
          if (activeSession.roomId === id) sessions.delete(token);
        }
        saveRooms();
        return json(res, 200, { closed: true, command });
      } catch (error) { return json(res, 400, { error: error.message }); }
    }

    if (!action && method === 'DELETE') {
      const session = sessionFromRequest(req);
      if (!session || session.roomId !== id || session.role !== 'owner') return json(res, 403, { error: 'Yalnızca oda sahibi odayı kapatabilir.' });
      rooms = rooms.filter(item => item.id !== id);
      for (const [token, activeSession] of sessions) {
        if (activeSession.roomId === id) sessions.delete(token);
      }
      saveRooms();
      return json(res, 200, { closed: true });
    }

    if (action === 'join' && method === 'POST') {
      try {
        const input = await body(req);
        const identity = tailscaleIdentity(req);
        if (identity && room.ownerId) return json(res, 202, { requestRequired: true });
        const nickname = String(input.nickname || identity?.name || '').trim().slice(0, 32);
        if (nickname.length < 2) return json(res, 400, { error: 'İsim en az 2 karakter olmalı.' });
        if (!validPassword(String(input.password || ''), room)) return json(res, 401, { error: 'Parola hatalı.' });
        const token = crypto.randomBytes(24).toString('hex');
        const isLegacyOwner = !room.ownerId;
        if (isLegacyOwner) room.ownerId = crypto.randomBytes(12).toString('hex');
        sessions.set(token, { roomId: id, nickname, identity: identity?.login || null, role: isLegacyOwner ? 'owner' : 'member' });
        if (!room.members.includes(nickname)) room.members.push(nickname);
        room.updatedAt = Date.now(); saveRooms();
        return json(res, 200, { token, nickname, room: publicRoom(room), messages: room.messages.slice(-100) });
      } catch (error) { return json(res, 400, { error: error.message }); }
    }

    const requestPollToken = requestMatch?.[2] && !requestMatch[3] && req.headers.authorization?.replace('Bearer ', '') === requestTokens.get(requestMatch[2]);
    const isAccessRequest = pathname.endsWith('/requests') && method === 'POST' && tailscaleIdentity(req);
    const authorizedRoom = roomFromRequest(req, id);
    if (!authorizedRoom && !requestPollToken && !isAccessRequest) return json(res, 401, { error: 'Bu oda için giriş yapmanız gerekiyor.' });

    if (action === 'messages' && method === 'GET') {
      const since = Number(url.searchParams.get('since')) || 0;
      return json(res, 200, room.messages.filter(message => message.createdAt > since).slice(-100));
    }

    if (action === 'messages' && method === 'POST') {
      try {
        const input = await body(req);
        const text = String(input.text || '').trim().slice(0, 2000);
        if (!text) return json(res, 400, { error: 'Mesaj boş olamaz.' });
        const session = sessionFromRequest(req);
        const message = { id: crypto.randomBytes(8).toString('hex'), nickname: session.nickname, text, createdAt: Date.now() };
        room.messages.push(message);
        room.messages = room.messages.slice(-500);
        room.updatedAt = message.createdAt; saveRooms();
        return json(res, 201, message);
      } catch (error) { return json(res, 400, { error: error.message }); }
    }

    if (pathname.endsWith('/requests') && method === 'POST') {
      try {
        const input = await body(req);
        const identity = tailscaleIdentity(req);
        const nickname = String(input.nickname || identity?.name || '').trim().slice(0, 32);
        if (!identity) return json(res, 400, { error: 'Onay isteği yalnızca Tailscale üzerinden kullanılabilir.' });
        if (nickname.length < 2) return json(res, 400, { error: 'İsim en az 2 karakter olmalı.' });
        const request = { id: crypto.randomBytes(8).toString('hex'), nickname, identity: identity.login, status: 'pending', createdAt: Date.now() };
        room.requests = room.requests || [];
        room.requests.push(request); saveRooms();
        const pollToken = crypto.randomBytes(24).toString('hex');
        requestTokens.set(request.id, pollToken);
        return json(res, 202, { requestId: request.id, pollToken, status: request.status });
      } catch (error) { return json(res, 400, { error: error.message }); }
    }

    if (pathname.endsWith('/requests') && method === 'GET') {
      const session = sessionFromRequest(req);
      if (!session || session.roomId !== id || session.role !== 'owner') return json(res, 403, { error: 'Yalnızca oda sahibi istekleri görebilir.' });
      return json(res, 200, (room.requests || []).filter(request => request.status === 'pending'));
    }

    const requestAction = pathname.match(/^\/api\/rooms\/([^/]+)\/requests\/([^/]+)(?:\/(approve|deny))?$/);
    if (requestAction) {
      const requestId = requestAction[2];
      const request = (room.requests || []).find(item => item.id === requestId);
      if (!request) return json(res, 404, { error: 'İstek bulunamadı.' });
      if (requestAction[3] === 'approve' || requestAction[3] === 'deny') {
        const session = sessionFromRequest(req);
        if (!session || session.roomId !== id || session.role !== 'owner') return json(res, 403, { error: 'Yalnızca oda sahibi onay verebilir.' });
        request.status = requestAction[3] === 'approve' ? 'approved' : 'denied';
        if (request.status === 'approved') {
          const token = crypto.randomBytes(24).toString('hex');
          sessions.set(token, { roomId: id, nickname: request.nickname, identity: request.identity });
          requestResults.set(requestId, { token, nickname: request.nickname, room: publicRoom(room), messages: room.messages.slice(-100) });
        }
        saveRooms(); return json(res, 200, { status: request.status });
      }
      const pollToken = req.headers.authorization?.replace('Bearer ', '');
      if (requestTokens.get(requestId) !== pollToken) return json(res, 403, { error: 'Bu isteği takip etme yetkiniz yok.' });
      const result = requestResults.get(requestId);
      if (result) { requestResults.delete(requestId); requestTokens.delete(requestId); return json(res, 200, result); }
      return json(res, 200, { status: request.status });
    }
  }

  return json(res, 404, { error: 'İstek bulunamadı.' });
});

server.listen(PORT, HOST, () => {
  console.log(`theta-workplace hazır: http://localhost:${PORT}`);
  console.log(`Ağdaki diğer cihazlar: http://${networkAddress()}:${PORT}`);
  if (TAILSCALE_MODE) console.log('Tailscale kimlik doğrulaması etkin.');
});
