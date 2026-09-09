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
#   2  the gate could not run — FAIL-CLOSED, never treated as "n/a". ALSO returned when
#      the gate exited non-zero WITHOUT producing a verdict marker, i.e. it never reached
#      a conclusion: that is CANNOT EVALUATE, an instrument failure, and deliberately not
#      passed through as the gate's own 1, which this contract would read as DRIFT.
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
# ONE handler, because a second `trap ... EXIT` REPLACES the first rather than chaining.
# Adding a separate trap for the gate-output file silently disabled this one and leaked a
# full origin/main archive on every run, unbounded on a cron box. GATE_OUT is initialised
# empty so the handler is safe before it is assigned.
GATE_OUT=""
cleanup_all() { rm -rf "$WORK"; [ -n "$GATE_OUT" ] && rm -f "$GATE_OUT"; return 0; }
trap cleanup_all EXIT

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

# A DRIFT VERDICT REQUIRES POSITIVE EVIDENCE THAT THE GATE REACHED ONE.
#
# MEASURED THREE TIMES IN PRODUCTION (row #67), in this job's scheduled-runner log:
#
#     Error: EPERM: operation not permitted, uv_cwd
#         at resolveMainPath (node:internal/modules/run_main:39:38)
#         at Function.executeUserEntryPoint [as runMain]
#     mcp-chain-reconcile: DRIFT — see findings above. Remediation is operator-gated.
#
# Read that stack carefully: resolveMainPath is Node resolving the ENTRY-POINT PATH,
# which needs process.cwd(). It fails BEFORE a single line of the gate is loaded. So no
# amount of try/catch inside reconcile-mcp-publish-chain.mjs can ever catch this — the
# gate does not run, and the fix has to live here, in the only layer that is executing.
#
# Node exits 1 when it cannot start, and 1 is the code this contract assigns to DRIFT.
# The `*)` arm below was already careful about codes it does not recognise, but 1 IS
# recognised, so a crash walked straight through it and was published as a finding, with
# remediation described as operator-gated. It asked a human to fix a condition it never
# measured, and it poisoned the record: a DRIFT report that was really a crash gets cited
# later as evidence the chain drifted.
#
# THE TEST IS THE CLASS, NOT THE SYMPTOM. Rather than special-casing EPERM (or ENOENT, or
# a missing interpreter, or a TCC denial, each of which produces this same shape), the
# wrapper now requires the gate's own verdict marker. reconcile-mcp-publish-chain.mjs
# prints "RESULT:" on both the PASS and FAIL paths and on no other path, so its absence
# means the gate never reached a verdict, whatever the reason. Absence of the marker with
# a non-zero status is CANNOT EVALUATE (exit 2), never DRIFT.
#
# Output goes to a file and is echoed back verbatim, so the operator still sees
# everything; the file exists only so this script can ask whether a verdict was produced.
# `grep -q` on a FILE, never `cmd | grep`, because a pipeline's $? is the filter's.
# `.XXXXXX` because GNU mktemp -t requires a template with X's while BSD does not, and
# this script's own header advertises a laptop OR a cron box. `|| exit 2` rather than
# letting `set -e` kill us: an aborted script exits 1, and 1 is the code this contract
# reads as DRIFT, which is the very confusion this change exists to end.
GATE_OUT="$(mktemp -t mcp-chain-gate.XXXXXX)" || exit 2

set +e
node scripts/reconcile-mcp-publish-chain.mjs \
  --mode=reconcile \
  ${TENANT_ARGS[@]+"${TENANT_ARGS[@]}"} \
  --head-dir "$ARCHIVE_DIR" \
  "$@" > "$GATE_OUT" 2>&1
STATUS=$?
set -e

cat "$GATE_OUT"

# An EMPTY capture is itself the strongest evidence the gate never ran, and it is the
# shape that greps clean, so it is asserted rather than inferred.
GATE_BYTES=$(wc -c < "$GATE_OUT" | tr -d ' ')
GATE_REACHED_VERDICT=0
# TWO VERDICT SHAPES, because the gate has two output modes and this wrapper forwards
# "$@" to it. In human mode it prints "RESULT:"; under --json it prints NO "RESULT:" at
# all, only a JSON object whose first keys are `ok` and `exit`. Matching "RESULT:" alone
# would therefore classify a GENUINE --json drift as CANNOT EVALUATE, i.e. this fix would
# silently swallow a real finding — the opposite failure to the one it exists to close,
# and the more dangerous direction. Self-caught before merge by walking every exit path:
# `const exit = failed ? 1 : 0` is shared, but the --json branch returns at its own
# process.exit(exit) well above the line that prints RESULT.
# A Node crash produces a stack trace, which carries neither marker.
if [ "$GATE_BYTES" -gt 0 ] && grep -qE 'RESULT:|"exit":' "$GATE_OUT"; then
  GATE_REACHED_VERDICT=1
fi

echo
# `-ne 2` matters. Exit 2 ALREADY means could-not-run, and a human-mode fail2 prints its
# reason to stderr without any verdict marker, so without this the wrapper replaced the
# gate's own accurate cause ("a surface that cannot be read is a FAILURE") with a guess
# about node failing to start. Exit code was unchanged either way, so this was never a
# fail-open, but it misdirected diagnosis for the registry-unreachable case and left the
# `2)` arm dead in human mode. The rewrite exists for a non-zero code that is NOT already
# a could-not-run, which in practice is 1.
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 2 ] && [ "$GATE_REACHED_VERDICT" -eq 0 ]; then
  echo "  mcp-chain-reconcile: CANNOT EVALUATE (exit 2, fail-closed)." >&2
  echo "    The gate exited $STATUS WITHOUT producing a verdict line, so it did not reach" >&2
  echo "    a conclusion about the publish chain. This is an INSTRUMENT FAILURE, not a" >&2
  echo "    finding: nothing about the chain was measured, and nothing here should be read" >&2
  echo "    as drift. Captured ${GATE_BYTES} byte(s) of gate output above." >&2
  echo "    Usual causes: node could not start (a deleted or unreadable working directory" >&2
  echo "    makes process.cwd() fail during entry-point resolution), no interpreter on" >&2
  echo "    PATH, or the process lacked permission to read the repo." >&2
  STATUS=2
else
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
fi

exit "$STATUS"
