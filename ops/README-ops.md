# Thornreach ops: backups & uptime

Two scripts live here:

- **`backup.sh`** — nightly encrypted offsite backup to Backblaze B2 (via rclone).
- **`heartbeat.sh`** — uptime check that pings Healthchecks.io every few minutes.

Both read secrets from **`/opt/town-chat/.backup.env`** (gitignored, `chmod 600`).
Nothing sensitive lives in the repo.

---

## 1. One-time server prep

```bash
sudo apt update
sudo apt install -y rclone gpg sqlite3 curl
```

---

## 2. Backblaze B2 (offsite backup target)

1. Create a Backblaze account → **B2 Cloud Storage** → **Create a Bucket**
   (private), e.g. `thornreach-backups`.
2. **Application Keys → Add a New Application Key**, scoped to that bucket.
   Copy the **keyID** and **applicationKey** (shown once).
3. Configure rclone on the server:
   ```bash
   rclone config
   # n) new remote
   # name> b2
   # Storage> b2   (Backblaze B2)
   # account> <your keyID>
   # key> <your applicationKey>
   # (accept defaults for the rest) → q) quit
   ```
4. Test it:
   ```bash
   rclone lsd b2:
   ```
   You should see your bucket.

> The backup target in `.backup.env` will be `b2:thornreach-backups/nightly`.

---

## 3. Healthchecks.io (uptime + backup monitoring)

Free, and it covers **both** "the server is down" and "the backup didn't run"
with a dead-man's-switch (if the expected ping doesn't arrive, it alerts you).

1. Sign up at <https://healthchecks.io>.
2. Create **two checks**:
   - **thornreach-heartbeat** — period **5 min**, grace **5 min**.
   - **thornreach-backup** — period **1 day**, grace **2 hours**.
3. For each, copy its **Ping URL** (looks like `https://hc-ping.com/<uuid>`).
4. **Integrations → Discord** → connect it to the same channel your alerts use
   (or email). Now a missed heartbeat or a failed backup pings you automatically.

---

## 4. Create `/opt/town-chat/.backup.env`

```bash
sudo nano /opt/town-chat/.backup.env
```

```ini
# --- backup.sh ---
DATA_DIR=/opt/town-chat/data          # MUST match the service's DATA_DIR (see note)
BACKUP_REMOTE=b2:thornreach-backups/nightly
BACKUP_GPG_PASSPHRASE=<a long random passphrase>
BACKUP_HC_URL=https://hc-ping.com/<thornreach-backup uuid>
BACKUP_KEEP_DAYS=30

# --- heartbeat.sh ---
HEARTBEAT_HC_URL=https://hc-ping.com/<thornreach-heartbeat uuid>
HEALTHZ_URL=http://localhost:3000/healthz
```

```bash
sudo chmod 600 /opt/town-chat/.backup.env
```

> **Find your real `DATA_DIR`:** `sudo systemctl show thornreach -p Environment`
> (or check the service file / how you start the app). If the game runs with the
> default, data sits in `/opt/town-chat` itself — set `DATA_DIR=/opt/town-chat`.

> ⚠️ **Save `BACKUP_GPG_PASSPHRASE` somewhere OFF the server** (a password
> manager). It is the only thing that can decrypt your backups — if the box
> dies and the passphrase was only on the box, the backups are useless.

---

## 5. Make the scripts runnable + schedule them

```bash
chmod +x /opt/town-chat/ops/backup.sh /opt/town-chat/ops/heartbeat.sh

sudo crontab -e
```

Add:

```cron
# Nightly backup at 04:17 UTC
17 4 * * *  /opt/town-chat/ops/backup.sh   >> /var/log/thornreach-backup.log 2>&1
# Uptime heartbeat every 5 minutes
*/5 * * * * /opt/town-chat/ops/heartbeat.sh
```

---

## 6. Test both now

```bash
# Backup — should finish with "done" and drop a .tar.gz.gpg in B2:
sudo /opt/town-chat/ops/backup.sh
rclone ls b2:thornreach-backups/nightly

# Heartbeat — should flip the HC "heartbeat" check to green:
/opt/town-chat/ops/heartbeat.sh
```

Both checks should go green in the Healthchecks dashboard.

---

## 7. Restore drill (do this once so you trust it)

On any machine with rclone + gpg configured:

```bash
# 1. Pull the newest archive
rclone copy b2:thornreach-backups/nightly ./restore --include '*.tar.gz.gpg' --max-age 2d
cd restore

# 2. Decrypt (you'll be prompted for BACKUP_GPG_PASSPHRASE)
gpg --output thornreach.tar.gz --decrypt thornreach-*.tar.gz.gpg

# 3. Unpack
tar -xzf thornreach.tar.gz
#  -> thornreach.db   (the live database snapshot)
#  -> data/           (evidence/, security/, *.json.bak, env.txt)
```

To bring a rebuilt server back:
1. Install the app, restore `.env` from `data/env.txt`.
2. Put `thornreach.db` in the new `DATA_DIR`.
3. Copy `data/evidence/` and `data/security/` back into `DATA_DIR`.
4. Start the service — all accounts, purchases, and progress are back.

---

## What's protected

| Data | On-box (.json.bak) | Offsite (this) |
|------|:--:|:--:|
| Accounts, purchases, progress (SQLite) | ✓ | ✓ |
| Image evidence (legal hold) | ✗ | ✓ |
| Security logs | ✗ | ✓ |
| Server keys (.env) | ✗ | ✓ |
| Survives total loss of the VPS | ✗ | ✓ |
