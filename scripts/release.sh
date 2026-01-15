#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/release.sh [--dry-run] <version>

Examples:
  ./scripts/release.sh 0.1.5
  ./scripts/release.sh --dry-run 0.1.5

What it does:
  - Verifies clean git state and up-to-date master
  - Bumps package.json/package-lock.json version (npm)
  - Prepends a template section to RELEASE_NOTES_DRAFT.md (if missing)
  - Commits, tags (v<version>), and pushes master + tag

Notes:
  - Run from repo root.
  - Tag push triggers GitHub Actions desktop release workflow.
EOF
}

DRY_RUN=0
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      if [[ -n "$VERSION" ]]; then
        echo "error: unexpected argument: $1" >&2
        usage >&2
        exit 2
      fi
      VERSION="$1"
      shift
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "error: <version> is required" >&2
  usage >&2
  exit 2
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "error: invalid version '$VERSION' (expected semver like 0.1.5)" >&2
  exit 2
fi

TAG="v$VERSION"

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "+ $*"
    return 0
  fi
  "$@"
}

warn() {
  echo "warning: $*" >&2
}

# Ensure we're at repo root
if [[ ! -f package.json ]]; then
  echo "error: package.json not found (run from repo root)" >&2
  exit 2
fi

# Ensure git clean
if [[ -n "$(git status --porcelain)" ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    warn "working tree not clean (dry-run will continue):"
    git status --porcelain >&2
  else
    echo "error: working tree not clean. Commit/stash changes first." >&2
    git status --porcelain >&2
    exit 1
  fi
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "master" ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    warn "not on master (dry-run will continue): $BRANCH"
  else
    echo "error: must release from master (current: $BRANCH)" >&2
    exit 1
  fi
fi

# Ensure up-to-date with origin/master
run git fetch origin --tags
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/master)"
if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    warn "local HEAD ($LOCAL_SHA) != origin/master ($REMOTE_SHA) (dry-run will continue)"
  else
    echo "error: local master ($LOCAL_SHA) is not equal to origin/master ($REMOTE_SHA). Pull/rebase first." >&2
    exit 1
  fi
fi

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  if [[ $DRY_RUN -eq 1 ]]; then
    warn "tag $TAG already exists (dry-run will continue)"
  else
    echo "error: tag $TAG already exists" >&2
    exit 1
  fi
fi

# Version bump (updates package.json + package-lock.json)
run npm version "$VERSION" --no-git-tag-version

# Prepend release note section if missing
if [[ $DRY_RUN -eq 1 ]]; then
  echo "+ (would update RELEASE_NOTES_DRAFT.md to add a template section for midisaxo-$VERSION if missing)"
else
  python3 - <<PY
import datetime
from pathlib import Path

version = "${VERSION}"
path = Path("RELEASE_NOTES_DRAFT.md")
text = path.read_text(encoding="utf-8")

marker = f"- midisaxo-{version}"
if marker in text:
    raise SystemExit(0)

lines = text.splitlines(True)
out = []
inserted = False

template = (
    "\n"
    "## Version\n"
    f"- midisaxo-{version}\n\n"
    "## Artifacts\n"
    f"- Midisaxo-{version}.AppImage (오프라인 스탠드얼론 UI)\n"
    f"- Midisaxo-{version}.tar.gz (오프라인 스탠드얼론 UI, portable)\n\n"
    "## Changes\n"
    "- (TODO) 변경사항 요약\n\n"
    "---\n"
)

for i, line in enumerate(lines):
    out.append(line)
    if not inserted and line.startswith("# Release notes"):
        # Insert after the main title line and any immediate blank lines
        j = i + 1
        while j < len(lines) and lines[j].strip() == "":
            out.append(lines[j])
            j += 1
        out.append(template)
        out.extend(lines[j:])
        inserted = True
        break

if not inserted:
    out = ["# Release notes (draft)\n", template, "\n", text]

path.write_text("".join(out), encoding="utf-8")
PY
fi

run git add -A
run git commit -m "chore(release): $TAG"
run git tag -a "$TAG" -m "$TAG"
run git push origin master
run git push origin "$TAG"

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry-run) Done. No changes were made."
else
  echo "Release pushed: $TAG"
fi

echo "Actions:  https://github.com/dolsoidduk/midisaxo/actions"
echo "Release:  https://github.com/dolsoidduk/midisaxo/releases/tag/$TAG"
