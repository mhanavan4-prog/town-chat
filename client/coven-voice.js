// ---------------------------------------------------------------------------
// Coven voice chat — WebRTC mesh (peer-to-peer), push-to-talk, coven-wide.
//
// The server (server.js coven_voice_* handlers) is ONLY a signaling relay +
// presence tracker; audio never passes through it. Each coven member who joins
// voice opens a direct RTCPeerConnection to every other member in voice (a
// mesh — fine for the ≤8-member coven cap). STUN handles most NATs; audio is
// gated by push-to-talk (the local mic track is disabled unless a key is held).
//
// Glare avoidance: for any pair, the member with the smaller connection id is
// the one who creates the WebRTC offer; the other answers.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createCovenVoice({ getWs, getCovenState, setUnlockToast }) {
  const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const supported = typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  let active = false;        // have we joined voice?
  let selfId = null;         // our connection id (from coven_voice_joined)
  let localStream = null;    // our mic MediaStream (tracks start disabled — PTT)
  let talking = false;       // PTT held right now
  const peers = new Map();   // peerId -> { pc, name, audioEl, analyser, speaking }
  let roster = [];           // [{id,name}] currently in voice (from server)

  function send(obj) {
    const ws = getWs();
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }
  function signal(toId, data) { send({ type: 'coven_voice_signal', toId, data }); }

  // ── Join / leave ──────────────────────────────────────────────────────────
  async function joinVoice() {
    if (active) return;
    if (!supported) { toast('Voice chat isn’t supported in this browser.'); return; }
    if (!getCovenState()) { toast('Join a coven first.'); return; }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      toast('🎙️ Mic access denied — voice needs your microphone.');
      return;
    }
    // Start muted: push-to-talk enables the track only while the key is held.
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    active = true;
    send({ type: 'coven_voice_join' });
    render();
  }

  function leaveVoice() {
    if (!active) { render(); return; }
    active = false;
    talking = false;
    send({ type: 'coven_voice_leave' });
    for (const id of Array.from(peers.keys())) dropPeer(id);
    if (localStream) { try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {} localStream = null; }
    selfId = null;
    roster = [];
    render();
  }

  // ── Peer plumbing ───────────────────────────────────────────────────────────
  function ensurePeer(id, name) {
    let peer = peers.get(id);
    if (peer) { if (name) peer.name = name; return peer; }
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peer = { pc, name: name || '', audioEl: null, analyser: null, speaking: false };
    peers.set(id, peer);
    if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.onicecandidate = (e) => { if (e.candidate) signal(id, { candidate: e.candidate }); };
    pc.ontrack = (e) => { attachRemote(id, e.streams[0]); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { /* keep until server says leave */ }
    };
    return peer;
  }

  function dropPeer(id) {
    const peer = peers.get(id);
    if (!peer) return;
    try { peer.pc.close(); } catch (e) {}
    if (peer.audioEl) { try { peer.audioEl.srcObject = null; peer.audioEl.remove(); } catch (e) {} }
    if (peer.analyser && peer.analyser.ctx) { try { peer.analyser.ctx.close(); } catch (e) {} }
    peers.delete(id);
    render();
  }

  async function makeOffer(id) {
    const peer = peers.get(id); if (!peer) return;
    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      signal(id, { sdp: peer.pc.localDescription });
    } catch (e) { /* transient; the other side may still offer */ }
  }

  function attachRemote(id, stream) {
    const peer = peers.get(id); if (!peer || !stream) return;
    let el = peer.audioEl;
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      peer.audioEl = el;
    }
    el.srcObject = stream;
    el.play && el.play().catch(() => {});
    setupAnalyser(peer, stream);
  }

  // Lightweight speaking detector (self-contained; failure is non-fatal).
  function setupAnalyser(peer, stream) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      peer.analyser = { ctx, node: an, data: new Uint8Array(an.frequencyBinCount) };
    } catch (e) { peer.analyser = null; }
  }

  // ── Server message handling (single entry; main.js routes coven_voice_* here)
  function handleMessage(msg) {
    switch (msg.type) {
      case 'coven_voice_joined': {
        selfId = msg.selfId;
        for (const pr of (msg.peers || [])) {
          ensurePeer(pr.id, pr.name);
          if (selfId != null && String(selfId) < String(pr.id)) makeOffer(pr.id); // smaller id offers
        }
        render();
        break;
      }
      case 'coven_voice_peer_join': {
        ensurePeer(msg.id, msg.name);
        if (selfId != null && String(selfId) < String(msg.id)) makeOffer(msg.id);
        render();
        break;
      }
      case 'coven_voice_peer_leave':
        dropPeer(msg.id);
        break;
      case 'coven_voice_roster':
        roster = msg.voice || [];
        render();
        break;
      case 'coven_voice_signal':
        handleSignal(msg.fromId, msg.data);
        break;
      case 'coven_voice_error':
        active = false;
        toast(msg.message || 'Voice error.');
        render();
        break;
      default: break;
    }
  }

  async function handleSignal(fromId, data) {
    if (!data) return;
    const peer = ensurePeer(fromId);
    try {
      if (data.sdp) {
        await peer.pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          signal(fromId, { sdp: peer.pc.localDescription });
        }
      } else if (data.candidate) {
        await peer.pc.addIceCandidate(data.candidate);
      }
    } catch (e) { /* ignore malformed/duplicate signaling */ }
  }

  // ── Push-to-talk ────────────────────────────────────────────────────────────
  function setTalking(on) {
    if (!active || !localStream) { talking = false; return; }
    on = !!on;
    if (on === talking) return;
    talking = on;
    localStream.getAudioTracks().forEach(t => { t.enabled = on; });
    render();
  }
  function isActive() { return active; }

  // ── UI (fills #covenVoiceBar inside the coven modal) ──────────────────────
  function toast(m) { if (typeof setUnlockToast === 'function') setUnlockToast(m); }

  function render() {
    const bar = document.getElementById('covenVoiceBar');
    if (!bar) return;
    if (!getCovenState()) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    bar.style.cssText += ';margin-bottom:10px;padding:10px 12px;border-radius:10px;' +
      'background:rgba(20,12,36,0.6);border:1px solid rgba(150,110,220,0.35)';
    if (!supported) {
      bar.innerHTML = '<div style="color:#c9b7ef;font-size:12.5px">🎙️ Voice chat isn’t supported in this browser.</div>';
      return;
    }
    const names = roster.map(r => r.name).filter(Boolean);
    const rosterLine = active
      ? (names.length
        ? `In voice: ${names.join(', ')}`
        : 'In voice — waiting for coven-mates to join…')
      : 'Talk live with your coven (push-to-talk).';
    bar.innerHTML =
      `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button id="covenVoiceToggle" class="btn" style="margin:0;flex:0 0 auto;${active ? 'background:linear-gradient(90deg,#c0392b,#922b21)' : ''}">${active ? '🔇 Leave voice' : '🎙️ Join voice'}</button>
        ${active ? `<span id="covenVoiceTx" style="font-size:12px;font-weight:700;color:${talking ? '#86efac' : '#9c93c2'}">${talking ? '🔴 Transmitting…' : 'Hold C to talk'}</span>` : ''}
      </div>
      <div style="margin-top:6px;font-size:11.5px;color:#b8a9df">${rosterLine}</div>`;
    const btn = document.getElementById('covenVoiceToggle');
    if (btn) btn.onclick = () => { active ? leaveVoice() : joinVoice(); };
  }

  // Poll speaking levels while active (updates the transmitting dot smoothly).
  setInterval(() => {
    if (!active) return;
    let changed = false;
    for (const peer of peers.values()) {
      if (!peer.analyser) continue;
      try {
        peer.analyser.node.getByteFrequencyData(peer.analyser.data);
        let sum = 0; for (let i = 0; i < peer.analyser.data.length; i++) sum += peer.analyser.data[i];
        const speaking = (sum / peer.analyser.data.length) > 12;
        if (speaking !== peer.speaking) { peer.speaking = speaking; changed = true; }
      } catch (e) {}
    }
    if (changed && Modals.isOpen('covenModalOpen')) render();
  }, 250);

  return { handleMessage, render, setTalking, isActive, joinVoice, leaveVoice, stop: leaveVoice };
}
