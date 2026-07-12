# Deploying the Thornreach server

**One server backs all three clients** — the web/PC build (Stripe), the iOS app (StoreKit),
and the Android app (Play Billing) all connect to this same server, so everyone shares one
multiplayer town. Deploy this `town-chat` folder once, then point the apps' `config.js` at its URL.

## What this server needs from a host (important)

This is **not** a serverless app. It needs:

1. **A long-lived process that holds WebSocket connections** — rules out Vercel / Netlify /
   Cloudflare Workers / any "edge function" host.
2. **A persistent disk** for the game database. Without one, an ephemeral filesystem wipes all
   player data on every redeploy. Since Session L the server keeps everything in ONE embedded
   SQLite file (`DATA_DIR/thornreach.db`, via Node's built-in `node:sqlite` — crash-proof
   transactional writes, no npm deps). On first boot it auto-imports any legacy `*.json` stores it
   finds, and it exports plain-text `*.json.bak` backups every 15 minutes and on clean shutdown.
   Point `DATA_DIR` at a mounted volume in production (defaults to the app folder). On Node < 22.5
   (or with `PERSIST_FORCE_JSON=1`) it falls back to the original flat-JSON files transparently —
   but use Node 22+: the Dockerfile now pins `node:22-slim` for exactly this reason.
3. **Always-on** (no cold-start spin-down) — a multiplayer game feels broken if the first player
   each hour waits 40 seconds for the server to wake.

## Recommended: Fly.io  ✅

Best fit — keeps a warm process, supports WebSockets natively, and has cheap persistent volumes.
A `Dockerfile` and `fly.toml` are included in this folder.

```bash
# one-time
brew install flyctl          # or: curl -L https://fly.io/install.sh | sh
fly auth signup              # (or fly auth login)

cd ~/Desktop/town-chat
fly launch --no-deploy        # claim an app name; when asked, DON'T deploy yet
# edit fly.toml → set `app = "your-chosen-name"` and a primary_region near your players

fly volumes create townchat_data --size 1 --region <same region as fly.toml>

# secrets (NEVER commit these):
fly secrets set STRIPE_SECRET_KEY=sk_live_xxx            # keep web/PC Stripe working
fly secrets set APPLE_IAP_SHARED_SECRET=xxxx             # iOS pass validation (see BUILD-IOS.md)
fly secrets set APPLE_BUNDLE_ID=com.thornreach.game
fly secrets set GOOGLE_PLAY_PACKAGE=com.thornreach.game
fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"   # Android (see BUILD-ANDROID.md)
# optional: fly secrets set TOWN_PASSWORD=... IAP_PRODUCT_ID=town_pass_24h

fly deploy
```

Your server is now at `https://your-chosen-name.fly.dev`. Put that in each app's
`www/config.js` → `window.TOWNCHAT_SERVER`.

## Alternatives

- **Railway** (railway.app) — simplest. New project → deploy this repo → add a **Volume** mounted at
  `/data` → set env `DATA_DIR=/data` + the same secrets → it gives you a public URL. ~$5/mo hobby.
- **A small VPS** (DigitalOcean / Hetzner, ~$6/mo) — the most control and a real filesystem, ideal for
  this app's flat-JSON model. Install Node 20, `git clone`, `npm install`, run under `pm2` or a
  systemd unit behind Caddy/Nginx for TLS. Set the env vars in the service file.
- **Render** — only the **paid** tier with a **persistent disk**. The *free* tier spins down (cold
  starts) and has an ephemeral disk that loses player data on redeploy — don't use it for a live game.

## Environment variables (full reference)

| Var | Purpose |
|---|---|
| `PORT` | Port to listen on (hosts usually set this automatically). |
| `DATA_DIR` | Where the JSON stores live. Set to your mounted volume, e.g. `/data`. |
| `TOWN_PASSWORD` | Optional shared join passcode. |
| `STRIPE_SECRET_KEY` | Web/PC Town Pass (Stripe). Leave unset to disable web pass sales. |
| `TOWN_PASS_PRICE_CENTS` / `TOWN_PASS_HOURS` | Pass price/duration (defaults 99 / 24). |
| `IAP_PRODUCT_ID` | Store product id for the pass (default `town_pass_24h`). |
| `APPLE_IAP_SHARED_SECRET` | iOS: App-Specific Shared Secret (App Store Connect → your app → App Information). |
| `APPLE_BUNDLE_ID` | iOS: your bundle id, checked against the receipt. |
| `GOOGLE_PLAY_PACKAGE` | Android: your Play package name. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Android: a service-account JSON (inline) with Play Developer API access. |
| `ANTHROPIC_API_KEY` | Optional — Witch Hazel's selfie-shop face check (fails open if unset). |

Health check: after deploy, open `https://your-server/api/config` — it should return JSON.
Then set that origin in each app's `config.js` and rebuild the apps.

## Web push notifications (Session L)

Real Web Push (moonrise / Peddler Monday / tournament / Blood Moon alerts) works out of the box
for web players over HTTPS — the VAPID keys self-generate on first boot and persist in the
database; there is nothing to configure. Optional env: `VAPID_CONTACT_EMAIL` (the contact address
push services see). Pushes only go to accounts that are OFFLINE, and the night alerts are
rate-limited to roughly one per subscription per day.

Two honest limits: the Electron desktop shell and the Capacitor app builds don't ship a push
transport (their enable button says so in-game); native FCM/APNs for the store apps would be a
separate future round.
