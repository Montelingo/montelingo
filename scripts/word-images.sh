#!/usr/bin/env bash
# Converts word image masters into the WebP files the app serves.
#
#   scripts/word-images.sh <folder of NNNN.png masters>
#   scripts/word-images.sh --hashes     # only rewrite media_hashes.json
#
# For each master it writes two files into apps/web/public/media/words/:
#   NNNN.webp      1024 x 1024, the lesson's big card       (budget 80 KB)
#   NNNN-512.webp   512 x 512,  the boards and word cards    (budget 30 KB)
#
# Masters are 2048 px PNGs from the illustrator, named by the word's recording
# number. A folder of 1024 px WebP files also works (for images whose PNG
# master is lost): a WebP that is already 1024 x 1024 is copied unchanged as
# NNNN.webp, because encoding a lossy file again only loses quality.
#
# Prints a table of sizes, and exits 1 if any file is over budget.
# Needs cwebp and webpinfo (Fedora: sudo dnf install libwebp-tools).
#
# Then it rewrites apps/api/app/modules/content/media_hashes.json from every
# image in the output folder: the first 8 hex characters of each file's
# SHA-256. The API puts the hash in the image URL (?v=<hash>), so the browser
# can cache the file for a year and a redrawn image still gets a new URL.
# Run it with --hashes after removing or replacing a file by other means.
#
# WORD_IMAGES_OUT overrides the output folder, WORD_IMAGES_HASHES the hashes
# file. Why these settings: docs/architecture/word-images.md, sections 2 and 3.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${WORD_IMAGES_OUT:-$root/apps/web/public/media/words}"
hashes="${WORD_IMAGES_HASHES:-$root/apps/api/app/modules/content/media_hashes.json}"
budget_1024=$((80 * 1024))
budget_512=$((30 * 1024))

die() {
  echo "word-images.sh: $*" >&2
  exit 1
}

short_hash() {
  sha256sum "$1" | cut -c1-8
}

# Writes {"0001": {"1024": "<hash>", "512": "<hash>"}, ...} for every
# NNNN.webp in the output folder, sorted, so the file only changes where an
# image did. test_media.py checks it against the files.
write_hashes() {
  local path number small first=1
  local tmp_hashes="$hashes.tmp"
  shopt -s nullglob
  {
    echo "{"
    for path in "$out"/[0-9][0-9][0-9][0-9].webp; do
      number="$(basename "$path" .webp)"
      small="$out/$number-512.webp"
      [[ -f "$small" ]] || die "$number.webp has no $number-512.webp"
      ((first)) || echo ","
      first=0
      printf '  "%s": { "1024": "%s", "512": "%s" }'         "$number" "$(short_hash "$path")" "$(short_hash "$small")"
    done
    ((first)) || echo
    echo "}"
  } > "$tmp_hashes"
  shopt -u nullglob
  mv "$tmp_hashes" "$hashes"
  echo "word-images.sh: wrote the hashes to $hashes"
}

usage="usage: scripts/word-images.sh <folder of NNNN.png masters> | --hashes"
[[ $# -eq 1 ]] || die "$usage"
[[ -d "$out" ]] || die "output folder $out is missing"
if [[ "$1" == "--hashes" ]]; then
  write_hashes
  exit 0
fi
src="$1"
[[ -d "$src" ]] || die "$src is not a folder"
for tool in cwebp webpinfo; do
  command -v "$tool" > /dev/null || die "$tool not found (Fedora: sudo dnf install libwebp-tools)"
done

# Collect the masters, and refuse any image whose name isn't four digits.
masters=()
bad=()
shopt -s nullglob nocaseglob
for path in "$src"/*.png "$src"/*.webp; do
  name="$(basename "$path")"
  if [[ "$name" =~ ^[0-9]{4}\.(png|webp)$ ]]; then
    masters+=("$path")
  else
    bad+=("$name")
  fi
done
shopt -u nullglob nocaseglob
((${#bad[@]} == 0)) || die "names must be the four-digit word number (0011.png): ${bad[*]}"
((${#masters[@]} > 0)) || die "no NNNN.png or NNNN.webp files in $src"

dupes="$(printf '%s\n' "${masters[@]##*/}" | cut -c1-4 | sort | uniq -d)"
[[ -z "$dupes" ]] || die "more than one master for: $dupes"

# webpinfo prints "Canvas size 1024 x 1024" for any WebP.
webp_size() {
  webpinfo "$1" | sed -n 's/^ *Canvas size \([0-9]*\) x \([0-9]*\)$/\1x\2/p' | head -n 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

encode() { # <source> <px> <quality> <target>
  cwebp -quiet -q "$3" -m 6 -sharp_yuv -alpha_q 100 -resize "$2" "$2" "$1" -o "$4"
}

kb() { echo "$(((${1} + 1023) / 1024)) KB"; }

over=0
printf '%-6s  %-8s  %-8s  %s\n' "Number" "1024" "512" "Result"
while IFS= read -r path; do
  name="$(basename "$path")"
  number="${name:0:4}"
  big="$tmp/$number.webp"
  small="$tmp/$number-512.webp"

  if [[ "${name,,}" == *.webp && "$(webp_size "$path")" == "1024x1024" ]]; then
    cp "$path" "$big"
  else
    encode "$path" 1024 82 "$big"
  fi
  encode "$path" 512 80 "$small"

  big_bytes="$(stat -c %s "$big")"
  small_bytes="$(stat -c %s "$small")"
  result="OK"
  if ((big_bytes > budget_1024 || small_bytes > budget_512)); then
    result="over budget"
    over=1
  fi
  mv "$big" "$small" "$out/"
  printf '%-6s  %-8s  %-8s  %s\n' "$number" "$(kb "$big_bytes")" "$(kb "$small_bytes")" "$result"
done < <(printf '%s\n' "${masters[@]}" | sort)

# Hash every image, also an over-budget one: it is already in the folder.
write_hashes
if ((over)); then
  die "some files are over budget (1024: 80 KB, 512: 30 KB). Simplify the drawing; don't go below quality 75."
fi
echo "word-images.sh: wrote ${#masters[@]} images to $out"
