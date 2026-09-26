#!/usr/bin/env bash
# Fails if any Markdown file other than the root README.md is tracked.
# Usage: check-markdown.sh [<commit>]   (default: the index)
set -euo pipefail

if [ $# -gt 0 ]; then
  files=$(git ls-tree -r --name-only "$1")
else
  files=$(git ls-files)
fi

offending=$(printf '%s\n' "$files" | grep -iE '\.md$' | grep -vx 'README.md' || true)

if [ -n "$offending" ]; then
  echo "Only the root README.md may be committed. Remove these Markdown files:" >&2
  printf '  %s\n' $offending >&2
  echo "Untrack them with: git rm --cached <file>" >&2
  exit 1
fi
