# Auto-deploy setup (GitHub Actions → the live box)

Once this is configured, **every merge to `main` deploys itself** — the Action
in `.github/workflows/deploy.yml` SSHes into the box and runs `ops/deploy.sh`
(the same script you've been running by hand). No more manual deploy step.

Until the two secrets below exist, the Action **skips gracefully** (passes
green), so nothing breaks in the meantime.

Do this once. Everything is run **on the box** as `root` except the two GitHub
secret pastes.

## 1. Make a dedicated deploy key (on the box)

```bash
ssh-keygen -t ed25519 -f ~/deploy_key -N "" -C "github-actions-deploy"
```

This writes `~/deploy_key` (private) and `~/deploy_key.pub` (public).

## 2. Authorize it — locked to only running the deploy (on the box)

This pins the key so that even if it ever leaked, it can **only** run
`ops/deploy.sh` and nothing else (no shell, no file access):

```bash
printf 'command="bash /opt/town-chat/ops/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\n' \
  "$(cat ~/deploy_key.pub)" >> ~/.ssh/authorized_keys
```

## 3. Grab the host key line (on the box)

```bash
ssh-keyscan -t ed25519 5.161.162.55
```

Copy the single line it prints — that's the value for `DEPLOY_KNOWN_HOSTS`.

## 4. Add the two GitHub secrets

In the repo: **Settings → Secrets and variables → Actions → New repository
secret**. Add:

| Secret name | Value |
|---|---|
| `DEPLOY_SSH_KEY` | the full contents of `~/deploy_key` (the **private** key, including the `-----BEGIN/END-----` lines) — `cat ~/deploy_key` |
| `DEPLOY_KNOWN_HOSTS` | the line from step 3 (`ssh-keyscan` output) |

## 5. Clean up the private key copy (on the box)

Once it's pasted into the GitHub secret, don't leave it on disk:

```bash
rm ~/deploy_key ~/deploy_key.pub
```

(The public key is already in `authorized_keys`; GitHub holds the private key.)

## 6. Test it

Actions tab → **Deploy to production** → **Run workflow** (on `main`). It should
go green and you'll see `✓ deployed and healthy` in the log. After that, every
merge to `main` deploys on its own.

## Requirements / notes

- **SSH must be reachable from GitHub's runners.** GitHub-hosted runners use a
  wide, changing range of IPs, so the box needs port 22 open to the internet
  (Hetzner's default). The forced-command lock in step 2 is what keeps that
  safe. If you ever restrict SSH by IP, this won't be able to connect.
- The box pulls from GitHub over HTTPS (public repo), so no git credentials are
  needed there — only the inbound SSH key above.
- To change the box address, edit `DEPLOY_HOST` in `.github/workflows/deploy.yml`.
- To pause auto-deploy, disable the workflow in the Actions tab (deploys stay
  available by hand via `ops/deploy.sh`).
