const state = { token: null, room: null, nickname: null, latest: 0, poller: null, requestPoller: null, owner: false };
const $ = selector => document.querySelector(selector);
const landing = $('#landing');
const chatView = $('#chat-view');
const savedTheme = localStorage.getItem('theta-workplace-theme');
if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Bir hata oluştu.');
  return data;
}

async function loadConnectionStatus() {
  try {
    const session = await api('/api/session');
    $('#connection-label').textContent = 'Online';
    $('#connection-detail').textContent = session.tailscale ? 'Tailscale bağlantısı hazır' : 'Yerel ağ bağlantısı hazır';
    $('#connection-status').innerHTML = '<i></i> Online';
    $('#tailscale-ip').textContent = `Tailscale IP: ${session.tailscaleIp || '--'}`;
    $('#authorized-user').textContent = `Yetkili giriş: ${session.identity?.name || 'Yerel kullanıcı'}`;
  } catch {
    $('#connection-label').textContent = 'Offline';
    $('#connection-detail').textContent = 'Sunucuya ulaşılamıyor';
    $('#connection-status').innerHTML = '<i></i> Offline';
  }
}

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function escapeHtml(text) { const element = document.createElement('div'); element.textContent = text; return element.innerHTML; }

async function loadRooms() {
  const list = $('#room-list');
  try {
    const rooms = await api('/api/rooms');
    list.innerHTML = rooms.length ? rooms.map(room => `<article class="room-card" data-room="${room.id}"><h3>${escapeHtml(room.name)}</h3><div class="room-meta"><span>${room.memberCount} kişi · ${room.messageCount} mesaj</span><span class="${room.protected ? 'lock' : ''}">${room.protected ? '● Parolalı' : 'Açık oda'}</span></div></article>`).join('') : '<div class="empty-state">Henüz oda yok. İlk odayı siz açın.</div>';
    list.querySelectorAll('.room-card').forEach(card => card.addEventListener('click', () => joinRoom(card.dataset.room)));
  } catch (error) { list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}

async function joinRoom(id) {
  let sessionInfo = {};
  try { sessionInfo = await api('/api/session'); } catch { }
  const nickname = sessionInfo.identity?.name || prompt('Bu odada görünecek adınız:');
  if (!nickname) return;
  const password = prompt('Oda parolası (parolasızsa boş bırakın):') || '';
  try {
    if (sessionInfo.identity) {
      const request = await api(`/api/rooms/${id}/requests`, { method: 'POST', body: JSON.stringify({ nickname }) });
      showToast('Oda sahibine erişim isteği gönderildi.');
      waitForApproval(id, request.requestId, request.pollToken);
      return;
    }
    const result = await api(`/api/rooms/${id}/join`, { method: 'POST', body: JSON.stringify({ nickname, password }) });
    openChat(result, false);
  } catch (error) { showToast(error.message); }
}

function openChat(result, owner) {
  state.token = result.token; state.room = result.room; state.nickname = result.nickname; state.latest = 0; state.owner = owner;
  landing.classList.add('hidden'); chatView.classList.remove('hidden'); $('#chat-title').textContent = state.room.name; $('#close-room-button').classList.toggle('hidden', !owner); renderMessages(result.messages); updateMembers(); startPolling();
  if (owner) { $('#request-panel').classList.remove('hidden'); loadRequests(); state.requestPoller = setInterval(loadRequests, 2000); }
}

async function waitForApproval(roomId, requestId, pollToken) {
  clearInterval(state.requestPoller);
  state.requestPoller = setInterval(async () => {
    try {
      const result = await api(`/api/rooms/${roomId}/requests/${requestId}`, { headers: { Authorization: `Bearer ${pollToken}` } });
      if (result.status === 'denied') { clearInterval(state.requestPoller); showToast('Oda sahibi erişim isteğini reddetti.'); }
      if (result.token) { clearInterval(state.requestPoller); openChat(result, false); showToast('Erişim onaylandı.'); }
    } catch { clearInterval(state.requestPoller); }
  }, 1800);
}

async function loadRequests() {
  if (!state.owner) return;
  try {
    const requests = await api(`/api/rooms/${state.room.id}/requests`);
    $('#request-list').innerHTML = requests.length ? requests.map(request => `<div class="request-item"><span>${escapeHtml(request.nickname)}</span><button class="approve-button" data-request="${request.id}">Onayla</button><button class="deny-button" data-request="${request.id}">Reddet</button></div>`).join('') : '<span class="request-empty">Bekleyen istek yok</span>';
    $('#request-list').querySelectorAll('button').forEach(button => button.addEventListener('click', () => resolveRequest(button.dataset.request, button.classList.contains('approve-button'))));
  } catch { }
}

async function resolveRequest(requestId, approve) {
  try { await api(`/api/rooms/${state.room.id}/requests/${requestId}/${approve ? 'approve' : 'deny'}`, { method: 'POST' }); loadRequests(); } catch (error) { showToast(error.message); }
}

function renderMessages(messages) { const list = $('#message-list'); if (!messages.length) { list.innerHTML = '<div class="empty-state">Bu odada henüz mesaj yok.</div>'; return; } messages.forEach(addMessage); list.scrollTop = list.scrollHeight; }
function addMessage(message) { const list = $('#message-list'); if (list.querySelector('.empty-state')) list.innerHTML = ''; state.latest = Math.max(state.latest, message.createdAt); list.insertAdjacentHTML('beforeend', `<article class="message"><div class="message-meta"><strong>${escapeHtml(message.nickname)}</strong>${new Date(message.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div><div class="message-body">${escapeHtml(message.text)}</div></article>`); list.scrollTop = list.scrollHeight; }
function updateMembers() { $('#member-count').textContent = `${state.room.memberCount} kişi içeride`; }
function startPolling() { clearInterval(state.poller); state.poller = setInterval(async () => { try { const messages = await api(`/api/rooms/${state.room.id}/messages?since=${state.latest}`); messages.forEach(addMessage); } catch { clearInterval(state.poller); } }, 1500); }
function leaveRoom() { clearInterval(state.poller); clearInterval(state.requestPoller); state.token = null; state.room = null; state.owner = false; $('#close-room-button').classList.add('hidden'); $('#request-panel').classList.add('hidden'); chatView.classList.add('hidden'); landing.classList.remove('hidden'); loadRooms(); }

async function closeRoom() {
  if (!state.owner || !state.room || !confirm(`"${state.room.name}" odası kapatılsın mı? Bu işlem geri alınamaz.`)) return;
  try { await api(`/api/rooms/${state.room.id}`, { method: 'DELETE' }); showToast('Oda kapatıldı.'); leaveRoom(); } catch (error) { showToast(error.message); }
}

$('#new-room-button').addEventListener('click', () => { $('#dialog-error').textContent = ''; $('#room-form').reset(); $('#room-dialog').showModal(); });
$('#close-dialog').addEventListener('click', () => $('#room-dialog').close());
$('#refresh-button').addEventListener('click', loadRooms);
$('#back-button').addEventListener('click', leaveRoom);
$('#close-room-button').addEventListener('click', closeRoom);
$('#room-form').addEventListener('submit', async event => { event.preventDefault(); try { const result = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name: $('#room-name').value, ownerNickname: $('#owner-name').value, password: $('#room-password').value }) }); $('#room-dialog').close(); openChat(result, true); } catch (error) { $('#dialog-error').textContent = error.message; } });
$('#message-form').addEventListener('submit', async event => { event.preventDefault(); const input = $('#message-input'); if (!input.value.trim()) return; try { const message = await api(`/api/rooms/${state.room.id}/messages`, { method: 'POST', body: JSON.stringify({ text: input.value }) }); addMessage(message); input.value = ''; } catch (error) { showToast(error.message); } });
$('#feedback-form').addEventListener('submit', async event => { event.preventDefault(); const status = $('#feedback-status'); status.textContent = ''; try { const result = await api('/api/feedback', { method: 'POST', body: JSON.stringify({ category: $('#feedback-category').value, name: $('#feedback-name').value, email: $('#feedback-email').value, message: $('#feedback-message').value }) }); status.textContent = result.sent ? 'Feedback gönderildi, teşekkürler.' : 'Feedback kaydedildi; sunucu e-posta ayarı bekliyor.'; $('#feedback-form').reset(); } catch (error) { status.textContent = error.message; } });
loadRooms();

$('#theme-toggle').addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
  localStorage.setItem('theta-workplace-theme', isDark ? 'light' : 'dark');
  $('#theme-toggle').textContent = isDark ? '☾' : '☀';
  $('#theme-toggle').title = isDark ? 'Siyah temaya geç' : 'Açık temaya geç';
});
if (savedTheme === 'dark') { $('#theme-toggle').textContent = '☀'; $('#theme-toggle').title = 'Açık temaya geç'; }
loadConnectionStatus();
