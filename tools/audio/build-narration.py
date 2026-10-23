#!/usr/bin/env python3
"""
build-narration.py — generate Thornreach's quest-line narration from
tools/audio/narration.manifest.json using the ElevenLabs Text-to-Speech API,
writing one MP3 per quest id into public/audio/narration/.

Run this where your ElevenLabs key + network live (your Mac), NOT in the cloud
sandbox (its egress can't reach api.elevenlabs.io):

    export ELEVENLABS_API_KEY=sk_...
    python3 tools/audio/build-narration.py --dry-run   # show what WOULD generate, spend nothing
    python3 tools/audio/build-narration.py             # generate only what's new/changed
    python3 tools/audio/build-narration.py --only circles_first_rite
    python3 tools/audio/build-narration.py --force     # regenerate everything

A content hash of each (text, voice, model, settings, format) is cached in
tools/audio/.narration-cache.json, so a re-run only spends credits on lines whose
text or voice actually changed. Stdlib only — no pip install needed.

NOTE: TTS spends roughly one credit per character. The manifest's `narration`
list is the pilot set; expand it (and rerun) once the voice + mix are approved.
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
MANIFEST = os.path.join(ROOT, "tools", "audio", "narration.manifest.json")
OUT_DIR = os.path.join(ROOT, "public", "audio", "narration")
CACHE = os.path.join(ROOT, "tools", "audio", ".narration-cache.json")
API_BASE = "https://api.elevenlabs.io/v1/text-to-speech"


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def content_key(text, voice_id, model_id, settings, fmt):
    h = hashlib.sha256()
    h.update(f"{text}\n{voice_id}\n{model_id}\n{json.dumps(settings, sort_keys=True)}\n{fmt}".encode("utf-8"))
    return h.hexdigest()[:16]


def generate(api_key, text, voice_id, model_id, settings, fmt):
    """Call the ElevenLabs TTS endpoint for one voice; return raw MP3 bytes."""
    body = {"text": text, "model_id": model_id}
    if settings:
        body["voice_settings"] = settings
    req = urllib.request.Request(
        f"{API_BASE}/{voice_id}?output_format={fmt}",
        data=json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def main():
    ap = argparse.ArgumentParser(description="Generate Thornreach quest narration via ElevenLabs TTS.")
    ap.add_argument("--dry-run", action="store_true", help="list what would generate; make no API calls")
    ap.add_argument("--force", action="store_true", help="regenerate even if the cache says unchanged")
    ap.add_argument("--only", default="", help="comma-separated quest ids to limit to")
    ap.add_argument("--index-only", action="store_true", help="just (re)write index.json from the files on disk; no API calls, no key needed")
    args = ap.parse_args()

    if args.index_only:
        write_index()
        return

    man = load_json(MANIFEST)
    if not man:
        print(f"!! could not read {MANIFEST}", file=sys.stderr)
        sys.exit(1)
    fmt = man.get("_output_format", "mp3_44100_128")
    model_id = man.get("_model_id", "eleven_multilingual_v2")
    default_voice = man.get("_voice_id", "")
    default_settings = man.get("_voice_settings", {})
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    os.makedirs(OUT_DIR, exist_ok=True)
    cache = load_json(CACHE, {}) or {}

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not args.dry_run and not api_key:
        print("!! set ELEVENLABS_API_KEY in your environment first (export ELEVENLABS_API_KEY=sk_...)", file=sys.stderr)
        sys.exit(1)

    planned, skipped = [], 0
    for item in man.get("narration", []):
        qid = item["id"]
        if only and qid not in only:
            continue
        text = item["text"]
        voice_id = item.get("voice_id", default_voice)
        settings = item.get("voice_settings", default_settings)
        fn = f"{qid}.mp3"
        out_path = os.path.join(OUT_DIR, fn)
        key = content_key(text, voice_id, model_id, settings, fmt)
        fresh = (not args.force) and cache.get(fn) == key and os.path.exists(out_path)
        if fresh:
            skipped += 1
            continue
        planned.append((qid, fn, text, voice_id, model_id, settings))

    if args.dry_run:
        total_chars = sum(len(t) for _, _, t, _, _, _ in planned)
        print(f"DRY RUN — {len(planned)} to generate (~{total_chars} chars), {skipped} already up to date:")
        for qid, fn, text, voice_id, _, _ in planned:
            print(f"  • {fn:<26} voice {voice_id}  “{text[:60]}{'…' if len(text) > 60 else ''}”")
        print("\nNo credits spent. Re-run without --dry-run to generate.")
        return

    made, failed = 0, 0
    for qid, fn, text, voice_id, mdl, settings in planned:
        out_path = os.path.join(OUT_DIR, fn)
        try:
            print(f"  generating {fn} …", end=" ", flush=True)
            audio = generate(api_key, text, voice_id, mdl, settings, fmt)
            with open(out_path, "wb") as f:
                f.write(audio)
            cache[fn] = content_key(text, voice_id, mdl, settings, fmt)
            save_json(CACHE, cache)  # persist incrementally so a crash doesn't re-spend
            made += 1
            print(f"ok ({len(audio) // 1024} KB)")
            time.sleep(0.5)  # be gentle on the API
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
        print("Next: listen, then commit public/audio/narration/*.mp3 + index.json and merge.")


def write_index():
    """Scan the output dir and write index.json: { questId: {f, v} }. `f` is the
    filename, `v` a short content hash the client appends as ?v= for cache-busting
    (same filename, new content → new URL → no stale audio). One file per quest."""
    os.makedirs(OUT_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(OUT_DIR) if f.endswith(".mp3"))
    index = {}
    for f in files:
        qid = f[:-4]  # strip .mp3
        with open(os.path.join(OUT_DIR, f), "rb") as fh:
            v = hashlib.sha256(fh.read()).hexdigest()[:8]
        index[qid] = {"f": f, "v": v}
    save_json(os.path.join(OUT_DIR, "index.json"), index)
    print(f"  wrote index.json ({len(index)} narrated quests)")


if __name__ == "__main__":
    main()
