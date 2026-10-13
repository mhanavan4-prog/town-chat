/* Thornreach coven voice — website client.
   Opens a WebSocket to the game server, identifies as a voice-only client with
   the account token, and runs the same WebRTC mesh the in-game client uses, so
   website members share one voice channel with covenmates who are in the game.
   Audio is peer-to-peer; the server only relays the connection handshake. */
(function () {
  "use strict";
  var RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  var supported = typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
  function getAccount() { try { return JSON.parse(localStorage.getItem('tc_account') || 'null'); } catch (e) { return null; } }

  var ws = null, selfId = null, active = false, talking = false;
  var localStream = null;
  var coven = null;               // { id, name, sigil, members:[{name,online}] }
  var roster = [];                // [{id,name}] currently in voice
  var peers = {};                 // peerId -> { pc, name, audioEl, analyser, speaking }
  var reconnectTimer = null, manualClose = false;

  // ── UI ──────────────────────────────────────────────────────────────────
  function setStatus(msg, kind) {
    var el = $('vStatus'); if (!el) return;
    el.textContent = msg || '';
    el.className = 'vstatus' + (kind ? ' ' + kind : '');
  }
  function render() {
    var joinBtn = $('vJoinBtn'), ptt = $('vPtt');
    if (joinBtn) {
      joinBtn.textContent = active ? 'Leave voice' : 'Join voice';
      joinBtn.classList.toggle('leave', active);
      joinBtn.disabled = !coven;
    }
    if (ptt) ptt.classList.toggle('hidden', !active);
    if (ptt) ptt.classList.toggle('talking', talking);
    // Member list: everyone in the coven, with live "in voice" + "talking" dots.
    var list = $('vMembers'); if (!list) return;
    var inVoice = {}; roster.forEach(function (r) { inVoice[(r.name || '').toLowerCase()] = r.id; });
    var speakingNames = {};
    Object.keys(peers).forEach(function (id) { if (peers[id].speaking) speakingNames[(peers[id].name || '').toLowerCase()] = true; });
    var mine = (getAccount() || {}).username || '';
    list.innerHTML = (coven && coven.members ? coven.members : []).map(function (m) {
      var nl = (m.name || '').toLowerCase();
      var isMe = nl === mine.toLowerCase();
      var voiceHere = Object.prototype.hasOwnProperty.call(inVoice, nl);
      var speaking = !!speakingNames[nl] || (talking && isMe);
      var state, label;
      if (speaking) { state = 'speaking'; label = 'speaking'; }
      else if (voiceHere) { state = 'invoice'; label = 'in voice'; }
      else if (isMe) { state = 'online'; label = 'here'; }           // you're on the voice page
      else if (m.online) { state = 'online'; label = 'in town'; }
      else { state = 'off'; label = 'offline'; }
      return '<div class="vmem ' + state + '">' +
        '<span class="vdot"></span>' +
        '<span class="vname">' + esc(m.name) + (isMe ? ' <span class="vyou">(you)</span>' : '') + '</span>' +
        '<span class="vtag">' + label + '</span></div>';
    }).join('');
  }

  // ── Peer plumbing (mirrors client/coven-voice.js) ─────────────────────────
  function signal(toId, data) { sendWs({ type: 'coven_voice_signal', toId: toId, data: data }); }
  function ensurePeer(id, name) {
    var peer = peers[id];
    if (peer) { if (name) peer.name = name; return peer; }
    var pc = new RTCPeerConnection(RTC_CONFIG);
    peer = { pc: pc, name: name || '', audioEl: null, analyser: null, speaking: false };
    peers[id] = peer;
    if (localStream) localStream.getTracks().forEach(function (t) { pc.addTrack(t, localStream); });
    pc.onicecandidate = function (e) { if (e.candidate) signal(id, { candidate: e.candidate }); };
    pc.ontrack = function (e) { attachRemote(id, e.streams[0]); };
    return peer;
  }
  function dropPeer(id) {
    var peer = peers[id]; if (!peer) return;
    try { peer.pc.close(); } catch (e) {}
    if (peer.audioEl) { try { peer.audioEl.srcObject = null; peer.audioEl.remove(); } catch (e) {} }
    if (peer.analyser && peer.analyser.ctx) { try { peer.analyser.ctx.close(); } catch (e) {} }
    delete peers[id]; render();
  }
  function makeOffer(id) {
    var peer = peers[id]; if (!peer) return;
    peer.pc.createOffer().then(function (offer) {
      return peer.pc.setLocalDescription(offer).then(function () { signal(id, { sdp: peer.pc.localDescription }); });
    }).catch(function () {});
  }
  function attachRemote(id, stream) {
    var peer = peers[id]; if (!peer || !stream) return;
    var el = peer.audioEl;
    if (!el) { el = document.createElement('audio'); el.autoplay = true; el.style.display = 'none'; document.body.appendChild(el); peer.audioEl = el; }
    el.srcObject = stream;
    if (el.play) el.play().catch(function () {});
    setupAnalyser(peer, stream);
  }
  function setupAnalyser(peer, stream) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      var ctx = new Ctx(); var src = ctx.createMediaStreamSource(stream); var an = ctx.createAnalyser();
      an.fftSize = 256; src.connect(an);
      peer.analyser = { ctx: ctx, node: an, data: new Uint8Array(an.frequencyBinCount) };
    } catch (e) { peer.analyser = null; }
  }
  function handleSignal(fromId, data) {
    if (!data) return;
    var peer = ensurePeer(fromId);
    if (data.sdp) {
      peer.pc.setRemoteDescription(data.sdp).then(function () {
        if (data.sdp.type === 'offer') {
          return peer.pc.createAnswer().then(function (ans) {
            return peer.pc.setLocalDescription(ans).then(function () { signal(fromId, { sdp: peer.pc.localDescription }); });
          });
        }
      }).catch(function () {});
    } else if (data.candidate) {
      peer.pc.addIceCandidate(data.candidate).catch(function () {});
    }
  }

  // Poll remote analysers + highlight who's speaking.
  setInterval(function () {
    var changed = false;
    Object.keys(peers).forEach(function (id) {
      var p = peers[id]; if (!p.analyser) return;
      p.analyser.node.getByteFrequencyData(p.analyser.data);
      var sum = 0; for (var i = 0; i < p.analyser.data.length; i++) sum += p.analyser.data[i];
      var speaking = (sum / p.analyser.data.length) > 12;
      if (speaking !== p.speaking) { p.speaking = speaking; changed = true; }
    });
    if (changed) render();
  }, 250);

  // ── Join / leave ──────────────────────────────────────────────────────────
  function joinVoice() {
    if (active || !coven) return;
    if (!supported) { setStatus('Voice chat isn’t supported in this browser.', 'err'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      localStream = stream;
      localStream.getAudioTracks().forEach(function (t) { t.enabled = false; }); // PTT: muted until held
      active = true;
      sendWs({ type: 'coven_voice_join' });
      setStatus('In voice — hold the button (or Space) to talk.', 'ok');
      render();
    }).catch(function () { setStatus('🎙️ Mic access denied — voice needs your microphone.', 'err'); });
  }
  function leaveVoice() {
    if (!active) { render(); return; }
    active = false; talking = false;
    sendWs({ type: 'coven_voice_leave' });
    Object.keys(peers).forEach(dropPeer);
    if (localStream) { try { localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} localStream = null; }
    selfId = null;
    setStatus('Left voice.', '');
    render();
  }
  function setTalking(on) {
    if (!active || !localStream) { talking = false; return; }
    on = !!on; if (on === talking) return;
    talking = on;
    localStream.getAudioTracks().forEach(function (t) { t.enabled = on; });
    var ptt = $('vPtt'); if (ptt) { ptt.classList.toggle('talking', on); ptt.textContent = on ? '🎙️ Talking…' : '🎙️ Hold to talk'; }
    render();
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────
  function wsUrl() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host; }
  function sendWs(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
  function connect() {
    var acct = getAccount();
    if (!acct || !acct.token) { showGate(); return; }
    setStatus('Connecting…', '');
    try { ws = new WebSocket(wsUrl()); } catch (e) { setStatus('Could not connect.', 'err'); scheduleReconnect(); return; }
    ws.onopen = function () { sendWs({ type: 'voice_hello', token: acct.token }); };
    ws.onmessage = function (ev) {
      var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      switch (msg.type) {
        case 'voice_hello_ok':
          selfId = msg.selfId; coven = msg.coven || null; roster = msg.voice || [];
          $('vGate').classList.add('hidden'); $('vMain').classList.remove('hidden');
          if (coven) { $('vCovenName').textContent = coven.name; $('vCovenSigil').textContent = coven.sigil || '🌙'; }
          setStatus('Ready — click “Join voice” to come on.', '');
          render();
          break;
        case 'voice_hello_error':
          showGate(msg.message || 'Voice is unavailable.');
          break;
        case 'coven_voice_joined':
          selfId = msg.selfId;
          (msg.peers || []).forEach(function (pr) { ensurePeer(pr.id, pr.name); if (selfId != null && String(selfId) < String(pr.id)) makeOffer(pr.id); });
          render();
          break;
        case 'coven_voice_peer_join':
          ensurePeer(msg.id, msg.name);
          if (selfId != null && String(selfId) < String(msg.id)) makeOffer(msg.id);
          render();
          break;
        case 'coven_voice_peer_leave': dropPeer(msg.id); break;
        case 'coven_voice_roster': roster = msg.voice || []; render(); break;
        case 'coven_voice_signal': handleSignal(msg.fromId, msg.data); break;
        case 'coven_voice_error': active = false; setStatus(msg.message || 'Voice error.', 'err'); render(); break;
        default: break;
      }
    };
    ws.onclose = function () {
      ws = null;
      if (manualClose) return;
      if (active) { active = false; talking = false; Object.keys(peers).forEach(dropPeer); if (localStream) { try { localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} localStream = null; } }
      setStatus('Disconnected — reconnecting…', 'err');
      scheduleReconnect();
    };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }
  function scheduleReconnect() { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 2500); }
  function showGate(msg) {
    $('vMain').classList.add('hidden'); $('vGate').classList.remove('hidden');
    if (msg) $('vGateMsg').textContent = msg;
  }

  // ── Wiring ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var joinBtn = $('vJoinBtn'), ptt = $('vPtt');
    if (joinBtn) joinBtn.addEventListener('click', function () { if (active) leaveVoice(); else joinVoice(); });
    if (ptt) {
      ptt.textContent = '🎙️ Hold to talk';
      var down = function (e) { e.preventDefault(); setTalking(true); };
      var up = function (e) { if (e) e.preventDefault(); setTalking(false); };
      ptt.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      ptt.addEventListener('pointercancel', up);
    }
    // Spacebar push-to-talk (ignore when typing in a field).
    window.addEventListener('keydown', function (e) { if (e.code === 'Space' && active && !e.repeat && !/input|textarea/i.test((e.target && e.target.tagName) || '')) { e.preventDefault(); setTalking(true); } });
    window.addEventListener('keyup', function (e) { if (e.code === 'Space' && active) { e.preventDefault(); setTalking(false); } });
    window.addEventListener('beforeunload', function () { manualClose = true; try { if (active) sendWs({ type: 'coven_voice_leave' }); if (ws) ws.close(); } catch (e) {} });
    connect();
  });
})();
