#!/usr/bin/env python3
"""
build-sfx.py — generate Thornreach's sound effects from tools/audio/sfx.manifest.json
using the ElevenLabs Sound Effects API, writing compressed MP3s straight into
public/audio/sfx/. No PCM intermediate: we ask ElevenLabs for mp3_44100_128 and
write the bytes as-is.

Run this where your ElevenLabs key + network live (your Mac or the box), NOT in
the cloud sandbox (its egress can't reach api.elevenlabs.io):

    export ELEVENLABS_API_KEY=sk_...
    python3 tools/audio/build-sfx.py --dry-run     # show what WOULD generate, spend nothing
    python3 tools/audio/build-sfx.py               # generate only what's new/changed
    python3 tools/audio/build-sfx.py --only hit,footstep
    python3 tools/audio/build-sfx.py --force       # regenerate everything

A content hash of each (prompt, duration, influence, variant, format) is cached in
tools/audio/.sfx-cache.json, so a re-run only spends credits on sounds whose prompt
or settings actually changed. Stdlib only — no pip install needed.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MANIFEST = os.path.join(ROOT, "tools", "audio", "sfx.manifest.json")
OUT_DIR = os.path.join(ROOT, "public", "audio", "sfx")
CACHE = os.path.join(ROOT, "tools", "audio", ".sfx-cache.json")
API_URL = "https://api.elevenlabs.io/v1/sound-generation"


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def content_key(prompt, duration, influence, variant, fmt):
    h = hashlib.sha256()
    h.update(f"{prompt}\n{duration}\n{influence}\n{variant}\n{fmt}".encode("utf-8"))
    return h.hexdigest()[:16]


def filename_for(sfx_id, variant, variants):
    return f"{sfx_id}.mp3" if variants <= 1 else f"{sfx_id}-{variant}.mp3"


def generate(api_key, prompt, duration, influence, fmt):
    """Call the ElevenLabs Sound Effects endpoint; return the raw audio bytes."""
    body = {"text": prompt, "prompt_influence": influence}
    if duration:
        body["duration_seconds"] = duration
    req = urllib.request.Request(
        f"{API_URL}?output_format={fmt}",
        data=json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def main():
    ap = argparse.ArgumentParser(description="Generate Thornreach SFX via ElevenLabs.")
    ap.add_argument("--dry-run", action="store_true", help="list what would generate; make no API calls")
    ap.add_argument("--force", action="store_true", help="regenerate even if the cache says unchanged")
    ap.add_argument("--only", default="", help="comma-separated sfx ids to limit to (e.g. hit,footstep)")
    args = ap.parse_args()

    man = load_json(MANIFEST)
    if not man:
        print(f"!! could not read {MANIFEST}", file=sys.stderr)
        sys.exit(1)
    fmt = man.get("_output_format", "mp3_44100_128")
    defaults = man.get("_defaults", {})
    def_infl = defaults.get("prompt_influence", 0.4)
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    os.makedirs(OUT_DIR, exist_ok=True)
    cache = load_json(CACHE, {}) or {}

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not args.dry_run and not api_key:
        print("!! set ELEVENLABS_API_KEY in your environment first (export ELEVENLABS_API_KEY=sk_...)", file=sys.stderr)
        sys.exit(1)

    planned, skipped, made, failed = [], 0, 0, 0
    for sfx in man.get("sfx", []):
        sid = sfx["id"]
        if only and sid not in only:
            continue
        variants = int(sfx.get("variants", defaults.get("variants", 1)))
        influence = float(sfx.get("prompt_influence", def_infl))
        duration = sfx.get("duration_seconds")
        # ElevenLabs requires 0.5 <= duration_seconds <= 30. Clamp rather than
        # 400, so a shorter value in the manifest just rounds up to the floor.
        if duration is not None:
            duration = max(0.5, min(30.0, float(duration)))
        prompt = sfx["prompt"]
        for v in range(1, variants + 1):
            fn = filename_for(sid, v, variants)
            out_path = os.path.join(OUT_DIR, fn)
            key = content_key(prompt, duration, influence, v, fmt)
            fresh = (not args.force) and cache.get(fn) == key and os.path.exists(out_path)
            if fresh:
                skipped += 1
                continue
            planned.append((sid, fn, prompt, duration, influence))

    if args.dry_run:
        print(f"DRY RUN — {len(planned)} to generate, {skipped} already up to date:")
        for sid, fn, prompt, duration, influence in planned:
            print(f"  • {fn:<18} ({duration or 'auto'}s, infl {influence})  “{prompt[:70]}{'…' if len(prompt) > 70 else ''}”")
        print("\nNo credits spent. Re-run without --dry-run to generate.")
        return

    for sid, fn, prompt, duration, influence in planned:
        out_path = os.path.join(OUT_DIR, fn)
        try:
            print(f"  generating {fn} …", end=" ", flush=True)
            audio = generate(api_key, prompt, duration, influence, fmt)
            with open(out_path, "wb") as f:
                f.write(audio)
            cache[fn] = content_key(prompt, duration, influence, int(fn.split("-")[-1].split(".")[0]) if "-" in fn else 1, fmt)
            save_json(CACHE, cache)  # persist incrementally so a crash doesn't re-spend
            made += 1
            print(f"ok ({len(audio) // 1024} KB)")
            time.sleep(0.4)  # be gentle on the API
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}")
        except Exception as e:  # noqa
            failed += 1
            print(f"FAILED: {e}")

    write_index()

    print(f"\nDone — {made} generated, {skipped} skipped (unchanged), {failed} failed.")
    print(f"MP3s in {os.path.relpath(OUT_DIR, ROOT)}/  ·  cache in {os.path.relpath(CACHE, ROOT)}")
    if made:
        print("Next: commit the new public/audio/sfx/*.mp3 + index.json and I'll wire them into client/audio.js.")


def write_index():
    """Scan the output dir and write index.json: { id: [files...] }. The client
    reads this to preload exactly the SFX that exist, grouping variants under
    their base id (footstep-1.mp3 .. footstep-4.mp3 -> "footstep": [...])."""
    files = sorted(f for f in os.listdir(OUT_DIR) if f.endswith(".mp3"))
    groups = {}
    for f in files:
        base = f[:-4]  # strip .mp3
        if "-" in base and base.rsplit("-", 1)[1].isdigit():
            base = base.rsplit("-", 1)[0]
        groups.setdefault(base, []).append(f)
    save_json(os.path.join(OUT_DIR, "index.json"), groups)
    print(f"  wrote index.json ({len(groups)} sounds, {len(files)} files)")


if __name__ == "__main__":
    main()
