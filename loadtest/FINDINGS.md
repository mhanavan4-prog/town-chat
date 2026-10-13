# Load test & launch readiness — findings

_Investigation: 2026-10-13. Target: the live Hetzner box (CPX11, 2 shared vCPU /
2 GB), `5.161.162.55:3000`. Generator: one MacBook over home internet._

## TL;DR

- **Connection handling is rock-solid.** Every run — including ones where
  latency blew up — kept **every socket connected, zero drops, zero errors**,
  up to 250 clients. The box never ran out of memory or file descriptors.
- **The real ceiling is wire bandwidth to each receiver, not CPU.** Profiling
  showed ~half the event-loop time in the socket-write path (`writev`/`send`)
  and almost nothing in game logic. On fast hardware over loopback the server
  shrugged off 700 players; it only struggled sending over a real network.
- **Proven good: ~100–120 concurrent spread across zones**, compression on —
  stable ~200 ms latency, zero drops. That likely covers a realistic
  Halloween-night indie launch.
- **250 is not yet certified** — not because the box failed, but because a
  *single* generator machine caps out as a receiver around ~100 streams. Use
  the distributed kit (`DISTRIBUTED.md`) to get the true number.
- **The biggest early mistake was ours:** turning WS compression off made every
  broadcast ~5× larger on the wire and drowned the single Mac's downlink —
  which produced most of the scary "collapses." With compression back on, the
  same test that spiraled to 40 s latency ran clean.

## What was tested

Simulated players (`swarm.mjs`) speaking the real wire protocol (join → move →
chat → ping), ramped in stages, holding for 45–90 s. Everyone piled into one or
two rooms (town / the Wilds) — the worst case and the launch case. Signals:
join latency, WS round-trip under load, inbound throughput, drops, max
staleness, and — critically — an **independent `/healthz` monitor** run from a
separate process so server health could be read without the swarm contaminating
it.

## The numbers that mattered

| Scenario (single Mac generator) | Result |
|---|---|
| 50 in town | clean (healthz ~0.12 s baseline) |
| 100 in town, compression **on** | stable, ~200 ms RTT |
| 100 split town+Wilds, compression **off** | collapsed — healthz TIMEOUT 45 s, RTT → 40 s |
| 100 split town+Wilds, compression **on** | **clean** — RTT ~200 ms, 0 drops |
| 250 split, compression on | knee at ~140 live; spiral past that (likely the Mac as receiver) |

## Root cause, in order of discovery

1. The event loop stalled for seconds at a time under load (independent healthz
   timed out), but **nothing reproduced it on loopback** — not JSON vs SQLite
   storage, not a CPU throttled to 1/3 of one core, not even 700 players. The
   only trigger was the **real network to a single receiver**.
2. The collapse signature was a **linear, unbounded** latency climb — classic
   backpressure: the server queues broadcasts faster than the socket drains, and
   on a real link that backlog grows without bound.
3. The dominant driver was **wire volume**. Turning compression off (a wrong
   turn we made mid-investigation) ~5×'d the bytes and saturated the Mac's
   downlink; restoring it fixed the "collapse."

## What changed (all merged)

| Change | PR | Default | Effect |
|---|---|---|---|
| WS compression restored ON | #265 | `WS_DEFLATE` on | ~5× less wire volume; the single biggest lever |
| Broadcast cadence + crowd throttle | #263 | `BROADCAST_MS=150`, `WILDLIFE_MS=220`, `CROWD_THRESHOLD=30` | ~38% fewer sends in the medium-room case |
| Backpressure guard | #264 | `STREAM_BUFFER_LIMIT=256KB` | a slow client can't force unbounded server buffering |
| Area-of-interest cull | #266 | `AOI_RADIUS=0` (**off**) | ~2× fewer bytes/client in crowds when enabled |
| Load-test harness + distributed kit | #261, #267 | — | the tooling behind all of the above |

All broadcast knobs are **env-tunable** (set in the systemd env, restart the
service). AOI ships **off** — enable it after validating (see below).

## Launch recommendations

**1. Certify 250 properly (distributed load).** One Mac can't. Follow
`loadtest/DISTRIBUTED.md`: 3–5 cheap VMs, each ~70 clients, fired together,
health watched from a separate box. This gives the server's real ceiling.

**2. Turn on AOI for the test, keep it if it holds.** Set `AOI_RADIUS=1400` on
the box and include it in the distributed run. It cuts crowd wire-bytes ~2×
with no client change. (A full ~10× version needs client-side view management —
see follow-ups; don't rush it before launch.)

**3. Cheap insurance: a bigger box.** We never proved the CPX11 *fails* at 250,
but for a launch you can't re-run, a **dedicated-vCPU** instance (Hetzner CCX13,
~$13/mo) raises the single-core ceiling the shared vCPU is most likely to hit.
Low risk, high peace of mind.

**4. Launch-night ops.**
- Keep the independent healthz monitor running on a separate machine. If it
  stays under ~1 s, the box is healthy regardless of what any one player feels.
- Have the env knobs ready to dial: raise `BROADCAST_MS`/`WILDLIFE_MS`, lower
  `CROWD_THRESHOLD`, and/or set `AOI_RADIUS` if the crowd strains it.
- Keep compression ON (`WS_DEFLATE` default). `WS_DEFLATE=0` is a test-only
  diagnostic.

## Known follow-ups (post-launch)

- **Full AOI (~10×).** Today's AOI culls only the fast stream and leaves the
  1.6 s full-instance roster as a safe fallback, which caps the win at ~2×. The
  full version culls that roster too and adds client-side "player left view"
  handling so off-screen players stop being sent entirely. Bigger, riskier —
  worth doing with real testing runway, not days before launch.
- **Town/zone instancing.** Cap population per instance and spill overflow into
  parallel copies (the machinery already exists for covens/delves), so no single
  room can ever get large enough to strain the broadcast.
