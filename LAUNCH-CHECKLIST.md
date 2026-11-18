# Launch checklist

What has been checked, by whom and how, and what is left for the owner. Written
17 November 2026. Numbers are first measurements, not guarantees.

## Stays up without tending

| | State | How it was checked |
|---|---|---|
| A merge does not restart the server under players | Done | `ops/deploy.sh`: client and site changes go live with no restart; server changes wait for an empty town. Seen in the live deploy logs for both paths. |
| A restart does not cost a player their place | Done | Resume stashes are written on shutdown and read on boot. A real server process was stopped and restarted with a player connected: same name, same spot. |
| Not carried across a restart | Open | Party membership, a dungeon run in progress, creature state, an open trade. |
| Memory over a long uptime | Looks sound | 1,080 join-play-leave sessions through a real server: heap flat at about 22 MB. A soak of hours has not been run. |
| Crash recovery | In place, not exercised | systemd restarts the process; stashes are saved once a minute, so a hard crash costs at most a minute of walking. |

## How many players

`node tools/loadtest.mjs --steps 50,100,200,300 --hold 15`, on a 2-core
container shared with the bots themselves, everyone in the town square:

| Players | Broadcast gap (median / p95) | CPU of one core | Memory | Verdict |
|---|---|---|---|---|
| 50 | 220 / 227 ms | 11% | 171 MB | fine |
| 100 | 220 / 249 ms | 28% | 197 MB | fine |
| 200 | 229 / 374 ms | 82% | 278 MB | fine, near the edge |
| 300 | 553 / 1420 ms | 131% | 320 MB | strained |

So about 200 in one place on that hardware. The live box has not been measured:
run the same tool against it from another machine (`--url`, see the tool's
header) before any push for players.

## For the owner to confirm on the box

These cannot be seen from the repository.

- [ ] **Off-site backups are running.** `ops/backup.sh` sends an encrypted nightly copy to object storage, but only if `ops/setup-backups.sh` was run. Check `crontab -l` for it, and that a recent file is in the bucket.
- [ ] **A restore has been tried once.** A backup that has never been restored is a hope.
- [ ] **The backup passphrase is kept somewhere other than the box.**
- [ ] **The uptime heartbeat is on** (`ops/heartbeat.sh`, Healthchecks.io), and its alert reaches a phone.
- [ ] **The deploy key is pinned** to `ops/deploy.sh` (`ops/AUTO-DEPLOY.md`, the forced-command step).
- [ ] **`.deploy-wait.log`** on the box is worth a look after the first deploy that had to wait for players.

## For the owner to run in Safari

The automated tours run in Chromium only. In Safari, at desktop size:

- [x] Menu → Report a bug → **Run a self-check**, once in the town, the Wilds, the Ember Wastes and one building. Done 17 November (Safari 26.2): all four clean after the gibbet fix, 60 fps on High.
- [ ] Escape with Caps Lock on opens and closes the menu once.
- [ ] The gold coin shows as gold wherever gold is shown.
- [ ] The besom: ride (G), climb and sink, land on a roof, the wind as you rise.
- [ ] A macro on the desktop bar.
- [ ] Friends, block and trade, with a second account in another window.
- [ ] Settings → Keys: change one, use it, put it back. Settings → Text size.

## Swept, in Chromium

- Nothing solid floats in the town, the six building interiors, the Manor hall, the Wilds, the Ember Wastes, a cottage (unfurnished), the bank vault, the Ember refuge or a first Delve floor. Not swept: a furnished cottage, the story crypt, deeper Delve floors.
- The Chromium tour does not see the Wilds' wayside models or its wildlife (they are not in the scene when it looks). The owner's self-check in Safari does, and found the gibbet 23 units off the ground; that is fixed.
- No inner names (`snake_case`, `undefined`, `NaN`) in about 45 menu panels.
- Every button and every use of a thing in the world makes a sound.

## Known gaps

- No colour-blind option.
- Tooltips that name a key show the default letter even when the key has been changed. The "Press F to" prompt and the How to play sheet show the key in use.
- A controller has not been tried on real hardware since the besom buttons were added.
- Guests cannot keep friends or trade; they can block for the length of a visit.
