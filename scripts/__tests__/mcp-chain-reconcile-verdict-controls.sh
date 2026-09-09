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

run() {
  ( cd "$TMP/repo" && bash scripts/mcp-chain-reconcile.sh ) > "$TMP/out" 2>&1
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
stub 2 '"  RESULT: FAIL (exit 1) — unreachable surface"'
RC=$(run)
note "exits 2" "$RC" "2"
note "says COULD NOT RUN" "$(grep -c 'COULD NOT RUN' "$TMP/out")" "1"

echo "=== 5. a crash that DID emit output but no verdict is still CANNOT EVALUATE ==="
# Guards the narrower reading "empty output means crash". Output is not the test, a
# VERDICT is: a gate that printed a banner and then died must not read as drift.
stub 1 '"  -- some banner the gate printed before dying --"'
RC=$(run)
note "exits 2" "$RC" "2"
note "says CANNOT EVALUATE" "$(grep -c 'CANNOT EVALUATE' "$TMP/out")" "1"

echo
if [ "$FAILS" -ne 0 ]; then
  echo "CONTROLS FAILED: $FAILS"
  exit 1
fi
echo "ALL CONTROLS PASSED"
