#!/bin/sh
# Build the models, then weld + quantize them (gltf-transform) so each is a few tens of KB.
# Positions stay float: three r128 can't read quantized positions back for bounding boxes.
#   GT=path/to/gltf-transform sh tools/models/build.sh plants|critters [names...]
set -e
cd "$(dirname "$0")"
kind=${1:-plants}; [ $# -gt 0 ] && shift
case "$kind" in plants) script=build_plants.py; dir=flora ;; critters) script=build_critters.py; dir=critters ;; *) echo "plants or critters"; exit 1 ;; esac
python3 "$script" "$@" 2>&1 | grep -v "INFO" | grep -v '^$' | grep -v "is not available because"
for f in ../../public/kk/$dir/*.glb; do
  n=$(basename "$f" .glb)
  if [ $# -gt 0 ]; then case " $* " in *" $n "*) ;; *) continue ;; esac; fi
  ${GT:-npx gltf-transform} weld "$f" "$f" >/dev/null 2>&1
  ${GT:-npx gltf-transform} quantize "$f" "$f" --pattern "{NORMAL,COLOR_0}" --quantize-normal 8 --quantize-color 8 >/dev/null 2>&1
  echo "$n $(wc -c < "$f") bytes"
done
