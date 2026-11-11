#!/bin/sh
# Build the models, then weld + quantize them (gltf-transform) so each is a few tens of KB.
# GT=path/to/gltf-transform sh tools/models/build.sh [names...]
set -e
cd "$(dirname "$0")"
python3 build_plants.py "$@" 2>&1 | grep -v "INFO" | grep -v '^$'
for f in ../../public/kk/flora/*.glb; do
  n=$(basename "$f" .glb)
  if [ $# -gt 0 ]; then case " $* " in *" $n "*) ;; *) continue ;; esac; fi
  ${GT:-npx gltf-transform} weld "$f" "$f" >/dev/null 2>&1
  ${GT:-npx gltf-transform} quantize "$f" "$f" --pattern "{NORMAL,COLOR_0}" --quantize-normal 8 --quantize-color 8 >/dev/null 2>&1
  echo "$n $(wc -c < "$f") bytes"
done
