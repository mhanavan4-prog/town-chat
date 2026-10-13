# Distributed load test — certifying a true concurrent count

A single generator machine is itself a bottleneck: one process receiving and
decompressing many WebSocket streams tops out around **~100 clients**, and its
numbers then reflect *its* limit, not the server's. To certify a real 250+ you
spread the clients across several VMs that each throw a slice, all firing at the
same instant.

## The idea

- Rent **3–5 cheap VMs** (ideally in or near the game box's region, so network
  latency is realistic and low).
- Put `swarm.mjs` + `remote-swarm.sh` on each.
- Give them all the **same `START_AT`** (a unix timestamp ~2 min out) so they
  ramp together.
- Watch the box's health from a **separate** place (your Mac) the whole time.
- Sum each VM's `joined` count for the real concurrent total; read drops/latency
  per VM.

Example: 4 VMs × 70 clients = **280 concurrent**, all hitting the box at once.

## 1. Provision VMs

Any Linux VMs work (Ubuntu/Debian assumed by the bootstrap). Cheapest options:

**Hetzner (same provider/region as the box — most realistic), with `hcloud`:**
```bash
# one-time: hcloud context create loadtest   (paste an API token)
for i in 1 2 3 4; do
  hcloud server create --name lt$i --type cpx11 --image ubuntu-24.04 \
    --location $(hcloud server describe <your-game-server> -o 'format={{.Datacenter.Location.Name}}') \
    --ssh-key <your-key>
done
hcloud server list -o columns=name,ipv4
```

**DigitalOcean (`doctl`):**
```bash
for i in 1 2 3 4; do
  doctl compute droplet create lt$i --size s-1vcpu-1gb --image ubuntu-24-04-x64 \
    --region nyc1 --ssh-keys <fingerprint> --wait
done
doctl compute droplet list --format Name,PublicIPv4
```

No cloud CLI? Any handful of machines you can SSH into works — spare laptops,
a friend's box, free-tier VMs. They just need outbound network to the game box.

## 2. Put the kit on each VM

Easiest is to clone the repo (you have access):
```bash
ssh root@<vm-ip> '
  git clone https://github.com/mhanavan4-prog/town-chat.git &&
  cp town-chat/loadtest/swarm.mjs town-chat/loadtest/remote-swarm.sh ~/'
```
Or just copy the two files directly:
```bash
scp loadtest/swarm.mjs loadtest/remote-swarm.sh root@<vm-ip>:~/
```

## 3. Fire them in unison

Pick a start time ~2 minutes out and reuse it on **every** VM:
```bash
START_AT=$(( $(date +%s) + 120 ))
echo "START_AT=$START_AT"      # <-- copy this exact number to every VM
```

On **each** VM (same `START_AT`, your slice in `N`):
```bash
TARGET=ws://5.161.162.55:3000 N=70 DUR=90 WILDS=0.5 SCATTER=1 \
START_AT=<the number above> bash remote-swarm.sh
```
Each VM prints `holding …s until synchronized start…`, then they all ramp
together. `SCATTER=1` spreads clients across the map (realistic, and the only
way to exercise AOI culling).

A quick way to launch all at once from your laptop (bash + ssh):
```bash
IPS="1.2.3.4 1.2.3.5 1.2.3.6 1.2.3.7"
START_AT=$(( $(date +%s) + 120 ))
for ip in $IPS; do
  ssh root@$ip "TARGET=ws://5.161.162.55:3000 N=70 DUR=90 WILDS=0.5 SCATTER=1 START_AT=$START_AT bash remote-swarm.sh" &
done; wait
```

## 4. Watch the box from the outside

On your Mac (NOT one of the generators), run the independent health monitor the
whole time — this is the real verdict:
```bash
while true; do printf "%s  " "$(date +%T)"; \
  curl -s -m 3 -o /dev/null -w "healthz=%{time_total}s\n" http://5.161.162.55:3000/healthz \
  || echo "healthz=TIMEOUT"; sleep 1; done
```

## 5. Read the result

- **Concurrent total** = sum of each VM's `joined world` at peak.
- **Healthy** if: healthz monitor stays low (well under 1s, no TIMEOUT), every
  VM reports `failed=0 dropped=0`, and per-VM RTT p95 stays flat instead of
  climbing without recovering.
- If it strains, note the total where it starts and step down — that's the real
  ceiling. Because the load is spread, a collapse here is the *server*, not a
  single generator.

## Tuning knobs on the box (set in the systemd env, then restart the service)

- `AOI_RADIUS=1400` — enable area-of-interest culling (big wire-byte cut for
  crowds). Start here if the box strains.
- `CROWD_THRESHOLD`, `BROADCAST_MS`, `WILDLIFE_MS` — broadcast cadence/throttle.
- `WS_DEFLATE=0` — only to isolate CPU vs bandwidth; leave compression ON for
  real runs.

Tear the VMs down when done (`hcloud server delete lt1 …` / `doctl compute
droplet delete …`) so they stop costing anything.
