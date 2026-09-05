#!/usr/bin/env bash
# mcp-chain-reconcile.sh — the SCHEDULED half of the MCP publish-chain gate.
#
# WHY A TIMER AND NOT ONLY CI
# -----------------------------------------------------------------------------
# The drift class this exists to catch produces NO COMMIT. main lands a fix, and
# then nobody runs `npm publish`. There is no commit to hang a hook on and no CI
# run to attach a check to — the repo is quiet and the registry is stale. Only a
# timer sees that. CI alone would be a gate that can never fire on its own bug.
#
# It is deliberately runnable WITHOUT GitHub Actions, so it can be armed from a
# laptop or a cron box independently of whether CI is healthy.
#
# WHAT IT RECONCILES
# -----------------------------------------------------------------------------
# origin/main, NOT the working tree. A dirty local checkout is not what customers
# would get if someone published, and reconciling it would report drift that is
# just uncommitted work. This fetches and archives origin/main into a temp dir and
# points the gate at that.
#
# EXIT CODES (passed through from the gate)
#   0  chain reconciles
#   1  DRIFT
#   2  the gate could not run — FAIL-CLOSED, never treated as "n/a"
#
# READ-ONLY. Never publishes, never pushes, never version-bumps.
#
# Usage:
#   scripts/mcp-chain-reconcile.sh                 # human-readable
#   scripts/mcp-chain-reconcile.sh --json          # machine-readable
#   MCP_CHAIN_TENANT=<slug> MCP_CHAIN_TENANT_CONFIG=<path> scripts/mcp-chain-reconcile.sh
#
# cron example (daily 09:00, log + non-zero exit is the alert):
#   0 9 * * *  cd /path/to/twitterapis-mcp && scripts/mcp-chain-reconcile.sh >> /var/log/mcp-chain.log 2>&1

set -euo pipefail

# NOTE ON PIPES: nothing below is gated on the exit status of a pipeline whose
# last stage is a filter. `$?` / `&&` / `||` see the LAST stage, so `cmd | tail`
# silently masks `cmd` failing. Every load-bearing command runs raw.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

WORK="$(mktemp -d)"
# shellcheck disable=SC2064  # intentional: expand WORK now, at trap-set time
trap "rm -rf '$WORK'" EXIT

# NOTE: macOS ships bash 3.2, where `"${arr[@]}"` on an EMPTY array is an unbound
# -variable error under `set -u`. Building the argument list as a plain string and
# splitting it is not safe either (paths can contain spaces), so the array is
# expanded with the `${arr[@]+...}` guard at the call site instead. This bit for
# real on the first end-to-end run — the script aborted before the gate ever ran.
TENANT="${MCP_CHAIN_TENANT:-}"
TENANT_ARGS=()
if [ -n "$TENANT" ]; then
  TENANT_ARGS=(--tenant "$TENANT")
fi

echo "── mcp-chain-reconcile ──────────────────────────────────────────────────"
echo "  repo   : $REPO_ROOT"
echo "  ref    : origin/main (fetched fresh — NOT the working tree)"

# Fetch before making any claim about repo state. A stale local ref would
# reconcile yesterday's main against today's registry and report a phantom.
if ! git fetch origin main --quiet; then
  echo "  FAIL: could not fetch origin/main. The gate cannot establish what main is," >&2
  echo "        and reconciling a stale local ref would be a guess. Exiting 2 (fail-closed)." >&2
  exit 2
fi

MAIN_SHA="$(git rev-parse origin/main)"
echo "  sha    : $MAIN_SHA"

# Archive origin/main into a pristine tree. `git archive` respects nothing from
# the working tree, which is the point.
ARCHIVE_DIR="$WORK/main"
mkdir -p "$ARCHIVE_DIR"
if ! git archive origin/main | tar x -C "$ARCHIVE_DIR"; then
  echo "  FAIL: could not archive origin/main into $ARCHIVE_DIR. Exiting 2 (fail-closed)." >&2
  exit 2
fi

# Sanity: the archive must actually contain a package.json, or we would hand the
# gate an empty dir and it would fail for the wrong reason.
if [ ! -f "$ARCHIVE_DIR/package.json" ]; then
  echo "  FAIL: archived origin/main has no package.json at its root. Exiting 2 (fail-closed)." >&2
  exit 2
fi

echo "─────────────────────────────────────────────────────────────────────────"

# ── WHOLE-REPO TENANT ISOLATION ──────────────────────────────────────────────
# The gate itself firewalls the PUBLISHED TARBALL — the files a customer installs.
# That is the right surface for the publish chain, and it is not the only surface
# that is public: this REPOSITORY is public too, so a foreign-property identity in
# scripts/, .github/, or a test fixture leaks just as surely as one in src/, while
# never appearing in any tarball.
#
# So the whole checked-out tree is scanned as well, delegated to the same isolation
# registry (no roster lives in this repo — that roster would itself be the leak).
# This runs HERE rather than in CI because the registry is the operator's and is not
# present on a CI box; this script is the local/cron half that has it.
#
# Fail-closed: a missing registry is a FAIL, never a skip.
ISO_SCAN="${TENANT_ISOLATION_SCAN:-$HOME/.claude/scripts/tenant-isolation-scan.py}"
REPO_TENANT="$TENANT"
if [ -z "$REPO_TENANT" ] && [ -f "$REPO_ROOT/.tenant" ]; then
  REPO_TENANT="$(tr -d '[:space:]' < "$REPO_ROOT/.tenant")"
fi
if [ -z "$REPO_TENANT" ]; then
  echo "  FAIL: no .tenant marker and no MCP_CHAIN_TENANT — cannot scan an artifact" >&2
  echo "        that does not declare its own property. Exiting 2 (fail-closed)." >&2
  exit 2
fi
if [ ! -f "$ISO_SCAN" ]; then
  echo "  FAIL: tenant-isolation registry not found at $ISO_SCAN." >&2
  echo "        Set TENANT_ISOLATION_SCAN. A missing gate input is a FAIL, never an 'n/a'." >&2
  exit 2
fi
echo "  isolation: scanning the whole tree as property '$REPO_TENANT'"
if ! "${PYTHON:-python3}" "$ISO_SCAN" --tenant "$REPO_TENANT" --path "$ARCHIVE_DIR"; then
  echo >&2
  echo "  mcp-chain-reconcile: TENANT ISOLATION VIOLATION in origin/main." >&2
  echo "  A foreign-property identity is present in this PUBLIC repository." >&2
  echo "  Remove it — do not 'correct' it, and do not exempt it. Exiting 2 (fail-closed)." >&2
  exit 2
fi
echo "─────────────────────────────────────────────────────────────────────────"

# Point the FIRST surface of the chain at the pristine archive rather than letting
# the gate re-clone it.
#
# --head-dir resolves against the gate's own TENANTS table, so this script does
# NOT need to know whether the head surface is called `repo` (twitterapis) or
# `authored` (a mirrored property). That matters: a second copy of the topology is
# exactly the kind of duplication that drifts out of sync with the real one. The
# gate stays the single source of truth for chain shape.
if ! command -v node >/dev/null 2>&1; then
  echo "  FAIL: node is not on PATH, so the gate cannot run. Exiting 2 (fail-closed)." >&2
  exit 2
fi

set +e
node scripts/reconcile-mcp-publish-chain.mjs \
  --mode=reconcile \
  ${TENANT_ARGS[@]+"${TENANT_ARGS[@]}"} \
  --head-dir "$ARCHIVE_DIR" \
  "$@"
STATUS=$?
set -e

echo
case "$STATUS" in
  0) echo "  mcp-chain-reconcile: PASS — origin/main ($MAIN_SHA) reconciles with the registry." ;;
  1) echo "  mcp-chain-reconcile: DRIFT — see findings above. Remediation is operator-gated." ;;
  2) echo "  mcp-chain-reconcile: COULD NOT RUN (fail-closed). A surface was unreachable." ;;
  *)
    # Anything the gate does not define is a HARNESS failure, not a verdict about
    # the chain. Reporting it as 1 would read as "drift found", which is a claim
    # this script has no evidence for — so it is normalised to 2 (could not run).
    echo "  mcp-chain-reconcile: unexpected exit $STATUS from the gate — treating as COULD NOT RUN (fail-closed)." >&2
    STATUS=2
    ;;
esac

exit "$STATUS"
