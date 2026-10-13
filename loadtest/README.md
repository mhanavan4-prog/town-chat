# Thornreach load / concurrency test

`swarm.mjs` opens N simulated players against a running server and reports the
signals that decide whether the box holds a launch crowd:

- **join latency** — connect → `init` (how long the door takes under load)
- **WS round-trip (RTT)** — a ping/pong probe; the event-loop-lag canary. If the
  server's loop stalls, pongs are delayed and p95/max RTT climb.
- **inbound throughput** — msgs/sec and KB/sec the server is fanning out. Scales
  with crowd size, so it's usually the first wall on a small VPS.
- **drops / failures / max staleness** — did anyone get kicked or go unheard.

Every client talks the real wire protocol (join → move → chat → ping), so the
server pays the real per-tick fan-out cost. By default everyone piles into **one
room (town)** — the worst case, and exactly launch night.

## Running it

Run from a machine with **open network to the target** (not the project's cloud
container, whose egress is allow-listed). `ws` is already a project dependency,
so from a repo checkout:

```bash
# shake-out against a local server
node loadtest/swarm.mjs ws://localhost:3000 --n 100 --dur 60

# the live box, held at 250 for two minutes
node loadtest/swarm.mjs wss://YOUR_HOST --n 250 --dur 120

# stage it: run 50, then 100, then 250, watching where numbers bend
for n in 50 100 250; do node loadtest/swarm.mjs wss://YOUR_HOST --n $n --dur 60; done
```

## Flags (or `UPPER_CASE` env of the same name)

| flag | default | meaning |
|------|---------|---------|
| `--url` (or 1st arg) | — | target `ws://` / `wss://` (**required**) |
| `--n` | 100 | total simulated clients |
| `--ramp` | 50 | ms between each connect (stagger; 50 ≈ 20/s) |
| `--dur` | 60 | seconds to hold after the ramp finishes |
| `--move` | 3 | moves/sec per client (0 = stand still) |
| `--chat` | 0.05 | chat lines/sec per client |
| `--ping` | 0.5 | WS ping RTT probes/sec per client |
| `--wilds` | 0 | fraction (0–1) that walk north into the Wilds |
| `--password` | — | `TOWN_PASSWORD`, if the server sets one |
| `--quiet` | off | only the final summary |

## Reading the result

- **All join + no drops, RTT p95 flat, staleness low** → the box held that count.
- **RTT p95/max climbing, staleness growing** → the server's event loop is
  falling behind the broadcast cadence — that's the ceiling.
- **Inbound KB/s per client very high** → bandwidth-bound; the crowd-broadcast
  fan-out is the cost. Spreading players across rooms (raise `--wilds`) lightens it.

Note: one load-generator machine is itself a bottleneck at high N (its own CPU
and uplink). If the client machine saturates, the numbers plateau because of the
*generator*, not the server — watch the generator's own CPU/network too, and
split the swarm across machines for very large runs.
