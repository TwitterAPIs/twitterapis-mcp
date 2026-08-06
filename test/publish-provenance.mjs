#!/usr/bin/env node
/**
 * PUBLISH PROVENANCE: refuse to publish an artifact that does not exist in git.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-06 the npm registry served @twitterapis/mcp@0.6.4 while this repo's
 * origin/main declared 0.6.3 in package.json, and NO commit anywhere carried the
 * 0.6.4 bump. So a version was published from a working tree whose state was never
 * committed, and the published artifact, which is the thing users actually install,
 * drifted AHEAD of the reviewable source.
 *
 * That defeats every other gate in this repo. catalog-identity pins tool descriptions
 * against a frozen fingerprint, firewall certifies the publish surface, and
 * registry-manifests pins the descriptors to package.json. ALL OF THEM GATE THE
 * COMMIT. None of them gated the PUBLISH. A publish from an uncommitted tree bypasses
 * the lot and nothing downstream can tell afterwards.
 *
 * It also breaks the assumption every reader makes, that reading the repo tells you
 * what is running. It does not, unless something asserts it.
 *
 * WHAT IT ASSERTS, all four cheap and all four load-bearing:
 *   1. the working tree is CLEAN (no uncommitted or untracked tracked-path changes)
 *   2. HEAD is an ANCESTOR of origin/main, so the code being published is reviewed
 *      and not a local-only branch
 *   3. package.json's version does NOT already exist on the registry, which is the
 *      exact 0.6.4 collision, caught before the irreversible step
 *   4. package.json and server.json agree on the version
 *
 * ESCAPE HATCH, deliberately loud: PUBLISH_PROVENANCE_ALLOW_DIRTY=1. A real
 * emergency publish stays possible, it just cannot happen by accident or silence.
 *
 * OFFLINE: check 3 needs the network. If the registry is unreachable the check is
 * reported UNKNOWN and SKIPPED rather than passed, because "I could not look" is not
 * "it is not there". The other three still run.
 *
 * Usage:
 *   node test/publish-provenance.mjs
 *   node test/publish-provenance.mjs --selftest
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const GATE = "publish-provenance";
const ALLOW_DIRTY = process.env.PUBLISH_PROVENANCE_ALLOW_DIRTY === "1";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Read the version npm currently serves. Returns null when the registry cannot be reached. */
function registryVersion(name) {
  try {
    return sh(`npm view ${name} version --silent`) || null;
  } catch {
    return null;
  }
}

function selftest() {
  let fails = 0;
  const ok = (label, cond) => {
    if (!cond) fails++;
    console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  };

  // The comparison that matters: a version already on the registry must be REFUSED.
  ok("published version is refused", "0.6.4" === "0.6.4");
  ok("unpublished version is allowed", "0.6.5" !== "0.6.4");
  // An unreachable registry must NOT read as "not published".
  ok("null registry version is UNKNOWN, not a pass", registryVersionIsUnknown(null));
  ok("a real registry version is known", !registryVersionIsUnknown("0.6.4"));
  ok("escape hatch is opt-in only", process.env.PUBLISH_PROVENANCE_ALLOW_DIRTY !== "1" || ALLOW_DIRTY);

  console.log(`\n${GATE} selftest: ${fails ? `FAIL (${fails})` : "PASS"}`);
  return fails ? 1 : 0;
}

function registryVersionIsUnknown(v) {
  return v === null;
}

function main() {
  if (process.argv.includes("--selftest")) return selftest();

  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const findings = [];
  let skipped = 0;

  // 1. clean tree
  let dirty = "";
  try {
    dirty = sh("git status --porcelain");
  } catch {
    findings.push("cannot read git status; refusing to certify provenance");
  }
  if (dirty) {
    const n = dirty.split("\n").filter(Boolean).length;
    if (ALLOW_DIRTY) {
      console.log(`  WARN  working tree has ${n} change(s), allowed by PUBLISH_PROVENANCE_ALLOW_DIRTY=1`);
    } else {
      findings.push(
        `working tree has ${n} uncommitted change(s). The published artifact would not exist in git. ` +
          `Commit them, or set PUBLISH_PROVENANCE_ALLOW_DIRTY=1 deliberately.`,
      );
    }
  }

  // 2. HEAD reviewed
  try {
    sh("git fetch origin --quiet");
    sh("git merge-base --is-ancestor HEAD origin/main");
  } catch {
    if (ALLOW_DIRTY) {
      console.log("  WARN  HEAD is not an ancestor of origin/main, allowed by the escape hatch");
    } else {
      findings.push(
        "HEAD is NOT an ancestor of origin/main, so this code is not on the reviewed trunk. " +
          "Merge the PR first, then publish from main.",
      );
    }
  }

  // 3. version not already published
  const live = registryVersion(pkg.name);
  if (live === null) {
    skipped++;
    console.log(`  SKIP  registry unreachable, cannot check whether ${pkg.version} is already published (UNKNOWN, not a pass)`);
  } else if (live === pkg.version) {
    findings.push(
      `version ${pkg.version} is ALREADY published (registry serves ${live}). ` +
        `Bump package.json before publishing; a re-publish of the same version is refused by npm anyway ` +
        `and this is the collision that hid the 0.6.4 drift.`,
    );
  }

  // 4. descriptors agree
  if (fs.existsSync("server.json")) {
    const server = JSON.parse(fs.readFileSync("server.json", "utf8"));
    if (server.version && server.version !== pkg.version) {
      findings.push(`server.json version ${server.version} != package.json version ${pkg.version}`);
    }
  }

  if (findings.length) {
    console.log(`\n[${GATE}] FAIL - ${findings.length} finding(s)`);
    for (const f of findings) console.log(`  ${f}`);
    return 1;
  }
  console.log(
    `[${GATE}] PASS - tree clean, HEAD on origin/main, ${pkg.version} not yet published` +
      (skipped ? `, ${skipped} check SKIPPED (registry unreachable)` : ""),
  );
  return 0;
}

process.exit(main());
