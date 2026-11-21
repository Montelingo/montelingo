#!/usr/bin/env bash
# Converts word image masters into the WebP files the app serves.
#
#   scripts/word-images.sh <folder of NNNN.png masters>
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
# WORD_IMAGES_OUT overrides the output folder. Why these settings:
# docs/architecture/word-images.md, section 2.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${WORD_IMAGES_OUT:-$root/apps/web/public/media/words}"
budget_1024=$((80 * 1024))
budget_512=$((30 * 1024))

die() {
  echo "word-images.sh: $*" >&2
  exit 1
}

[[ $# -eq 1 ]] || die "usage: scripts/word-images.sh <folder of NNNN.png masters>"
src="$1"
[[ -d "$src" ]] || die "$src is not a folder"
[[ -d "$out" ]] || die "output folder $out is missing"
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

if ((over)); then
  die "some files are over budget (1024: 80 KB, 512: 30 KB). Simplify the drawing; don't go below quality 75."
fi
echo "word-images.sh: wrote ${#masters[@]} images to $out"
