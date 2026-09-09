#!/bin/bash
# Controls for the wrapper's three-outcome verdict logic (row #67).
#
# A crashed gate was being published as DRIFT with operator-gated remediation, because
# node exits 1 when it cannot start and 1 is the code this contract assigns to DRIFT.
# The wrapper now requires the gate's own "RESULT:" marker before it will ever say DRIFT.
#
# These drive the REAL wrapper against a STUBBED gate, so what is under test is the
# wrapper's verdict logic rather than a restatement of it.
#
# PATHS ARE DERIVED, NEVER HARDCODED. An earlier version embedded absolute developer
# paths and the tenant-isolation firewall correctly refused the push: this is a public
# per-tenant artifact and a foreign identity in it is a breach even when the path is
# real. Resolving from BASH_SOURCE is also simply portable.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
WRAPPER="$REPO_ROOT/scripts/mcp-chain-reconcile.sh"

FAILS=0
note() {
  if [ "$2" = "$3" ]; then
    echo "  PASS  $1"
  else
    echo "  FAIL  $1 (expected '$3', got '$2')"
    FAILS=$((FAILS + 1))
  fi
}

TMP="$(mktemp -d)" || exit 1
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/repo/scripts" || exit 1
cp "$WRAPPER" "$TMP/repo/scripts/" || exit 1
chmod +x "$TMP/repo/scripts/mcp-chain-reconcile.sh"
printf '{"name":"x","version":"0.0.0"}\n' > "$TMP/repo/package.json"

# The wrapper refuses to scan an artifact that does not declare its property, and it
# fetches origin/main and refuses if it cannot. Both are preflight and both fail-closed.
# Without them the sandbox exits 2 before reaching the verdict logic, and every assertion
# below would "pass" for the wrong reason -- which is exactly what the first version of
# this file did. A control that never executes the code under test proves nothing.
printf 'twitterapis\n' > "$TMP/repo/.tenant"
git -C "$TMP/repo" init -q .
git -C "$TMP/repo" add -A >/dev/null 2>&1
git -C "$TMP/repo" -c user.email=t@t -c user.name=t commit -q -m base >/dev/null 2>&1
git -C "$TMP/repo" branch -q -M main 2>/dev/null
git init -q --bare "$TMP/origin.git"
git -C "$TMP/repo" remote add origin "$TMP/origin.git"
git -C "$TMP/repo" push -q origin main 2>/dev/null

stub() {  # $1 = exit code, $2 = quoted stdout body
  cat > "$TMP/repo/scripts/reconcile-mcp-publish-chain.mjs" <<STUB
console.log(${2});
process.exit($1);
STUB
}

run() {  # any args are forwarded to the wrapper, which forwards them to the gate
  ( cd "$TMP/repo" && bash scripts/mcp-chain-reconcile.sh "$@" ) > "$TMP/out" 2>&1
  echo $?
}

echo "=== 1. POSITIVE: gate exits 1 having produced NO verdict (the crash shape) ==="
# Exactly what node does when it cannot start: non-zero, and no gate output at all.
printf 'process.exit(1);\n' > "$TMP/repo/scripts/reconcile-mcp-publish-chain.mjs"
RC=$(run)
note "exits 2, not 1" "$RC" "2"
note "says CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "1"
note "does NOT say DRIFT" "$(grep -c 'mcp-chain-reconcile: DRIFT' "$TMP/out")" "0"
note "names it an instrument failure" "$(grep -c 'INSTRUMENT FAILURE' "$TMP/out")" "1"

echo "=== 2. NEGATIVE: a GENUINE drift must still report DRIFT ==="
stub 1 '"  RESULT: FAIL (exit 1) — 3 finding(s) across the publish chain"'
RC=$(run)
note "exits 1" "$RC" "1"
note "says DRIFT" "$(grep -c 'mcp-chain-reconcile: DRIFT' "$TMP/out")" "1"
note "does NOT say CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "0"

echo "=== 3. NEGATIVE: a CLEAN chain must still PASS ==="
stub 0 '"  RESULT: PASS (exit 0) — 4 surfaces reconciled"'
RC=$(run)
note "exits 0" "$RC" "0"
note "says PASS" "$(grep -c 'mcp-chain-reconcile: PASS' "$TMP/out")" "1"
note "does NOT say CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "0"

echo "=== 4. the gate's own exit 2 is still reported as COULD NOT RUN ==="
# The REAL shape of a human-mode fail2: exit 2, reason on stderr, and NO verdict marker.
# The previous version of this control stubbed exit 2 WHILE printing "RESULT:", which the
# gate can never do (RESULT: only ever precedes exit 0 or 1), so it pinned an impossible
# case and left the real one untested.
cat > "$TMP/repo/scripts/reconcile-mcp-publish-chain.mjs" <<'F2STUB'
console.error("\n  MCP PUBLISH-CHAIN GATE — COULD NOT RUN (exit 2, fail-closed)\n");
console.error("    npm view returned an empty body. A surface that cannot be read is a FAILURE.\n");
process.exit(2);
F2STUB
RC=$(run)
note "exits 2" "$RC" "2"
# Anchored on the WRAPPER's own prefix, not the bare phrase: the stub's stderr contains
# "COULD NOT RUN" as well, so a bare match counts both and the control fails for a reason
# that has nothing to do with the wrapper's verdict.
note "says COULD NOT RUN, keeping the gate's own cause" "$(grep -c 'mcp-chain-reconcile: COULD NOT RUN' "$TMP/out")" "1"
# The rewrite must NOT fire on exit 2: 2 already means could-not-run, and replacing the
# gate's stated reason with a guess about node failing to start misdirects diagnosis.
note "does NOT overwrite it with the node-start guess" "$(grep -c 'INSTRUMENT FAILURE' "$TMP/out")" "0"

echo "=== 5. a crash that DID emit output but no verdict is still CANNOT EVALUATE ==="
# Guards the narrower reading "empty output means crash". Output is not the test, a
# VERDICT is: a gate that printed a banner and then died must not read as drift.
stub 1 '"  -- some banner the gate printed before dying --"'
RC=$(run)
note "exits 2" "$RC" "2"
note "says CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "1"

echo "=== 6. NEGATIVE: a GENUINE drift in --json mode must still report DRIFT ==="
# The gate has two output modes and this wrapper forwards "$@". Under --json it prints no
# "RESULT:" line at all, only a JSON object. A marker check that knew only about
# "RESULT:" would call a real --json drift CANNOT EVALUATE, i.e. swallow a finding. That
# is the opposite failure to the one this fix exists to close and the more dangerous one,
# so it is pinned here rather than left to a reader to notice.
# Written directly rather than through stub(), because the JSON body's own quotes do not
# survive that helper's heredoc cleanly.
cat > "$TMP/repo/scripts/reconcile-mcp-publish-chain.mjs" <<'JSONSTUB'
console.log(JSON.stringify({ ok: false, exit: 1, mode: "reconcile", violations: [{ hop: "npm" }] }));
process.exit(1);
JSONSTUB
RC=$(run --json)
note "exits 1" "$RC" "1"
note "says DRIFT" "$(grep -c 'mcp-chain-reconcile: DRIFT' "$TMP/out")" "1"
note "does NOT say CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "0"

echo "=== 7. POSITIVE: a crash in --json mode is still CANNOT EVALUATE ==="
# THIS CONTROL EXISTS TO CONSTRAIN THE MARKER REGEX, and its first version could not:
# it was byte-identical to control 1, never passed --json, and emitted NO output, so
# GATE_BYTES=0 short-circuited before grep ever ran. A reviewer proved it vacuous by
# loosening the marker to a bare `exit` word and watching the whole suite still pass.
# So the crash stub now EMITS a realistic Node crash trace -- which contains the word
# "exit" but never the JSON key `"exit":` -- and the case runs in --json mode.
cat > "$TMP/repo/scripts/reconcile-mcp-publish-chain.mjs" <<'CRASHSTUB'
console.error("node:internal/modules/run_main:39");
console.error("Error: EPERM: operation not permitted, uv_cwd");
console.error("    at process.exit [as exit] (node:internal/process/per_thread:189:13)");
console.error("    at resolveMainPath (node:internal/modules/run_main:39:38)");
process.exit(1);
CRASHSTUB
RC=$(run --json)
note "exits 2" "$RC" "2"
note "says CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "1"
note "the crash trace really did contain the bare word exit" "$(grep -c 'process.exit' "$TMP/out")" "1"
note "but carried no JSON verdict key" "$(grep -c '\"exit\":' "$TMP/out")" "0"

echo
if [ "$FAILS" -ne 0 ]; then
  echo "CONTROLS FAILED: $FAILS"
  exit 1
fi
echo "ALL CONTROLS PASSED"
