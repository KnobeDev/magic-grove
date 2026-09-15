#!/usr/bin/env bash
# Vendors the Piper neural voice into grove/lib/piper/ (about 160 MB: piper-tts-web,
# onnxruntime-web WASM, the espeak phonemizer and the en_US-amy-low voice). It is
# kept out of git because of its size; without it the grove still runs and
# speaks through the browser's own voice.
#
# The files are copied from an existing vendored copy (the Davis 3D build ships
# the identical set) and accepted only if they are EXACTLY the files in
# tools/piper-manifest.sha256, byte for byte:
#   - the source must hold those files and nothing else, and no symlinks, so a
#     stray or planted file can never end up on the served path unverified;
#   - they are copied into a dot-named staging directory (static servers should refuse to
#     serve any path segment starting with "."), verified there, and only then
#     swapped into place, so a half-copied or failing file is never served.
#
#   PIPER_SRC=/path/to/3D-UCDCampusMap/grove/lib/piper tools/fetch-piper.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="${PIPER_SRC:-$root/../3D-UCDCampusMap/grove/lib/piper}"
dest="$root/grove/lib/piper"
manifest="$root/tools/piper-manifest.sha256"

fail() { echo "fetch-piper: $*" >&2; exit 1; }

[[ -f "$src/piper-tts-web.js" ]] || fail "no Piper files at $src (set PIPER_SRC to a directory holding piper-tts-web.js, onnx/, piper/ and voices/)"
[[ -z "$(cd "$src" && find . -type l -print -quit)" ]] || fail "refusing: $src contains symlinks"

expected="$(sed -E 's/^[0-9a-f]{64}  //' "$manifest" | LC_ALL=C sort)"
actual="$(cd "$src" && find . -type f | LC_ALL=C sort)"
if [[ "$expected" != "$actual" ]]; then
  echo "fetch-piper: refusing: $src does not hold exactly the manifest's files (< manifest, > source):" >&2
  diff <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") >&2 || true
  exit 1
fi

stage="$(mktemp -d "$root/grove/lib/.piper-stage.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
while IFS= read -r rel; do
  install -D -m 0644 "$src/$rel" "$stage/$rel"
done <<< "$expected"
(cd "$stage" && sha256sum --check --quiet --strict "$manifest") || fail "checksum mismatch: nothing was installed"

old="$root/grove/lib/.piper-old"
rm -rf "$old"
if [[ -e "$dest" ]]; then mv "$dest" "$old"; fi
mv "$stage" "$dest"
rm -rf "$old"
trap - EXIT
echo "Piper voice vendored and verified in $dest"
