#!/usr/bin/env node
// Publish firewall: assert that no cross-property identity can ship on ANY surface this repo
// publishes. There are TWO, and scoping to one of them is how this gate went green over a live
// leak once already.
//
//   1. `npm publish` uploads exactly what `npm pack` lists. Today: 9 files.
//   2. `git push` uploads EVERY TRACKED FILE. Today: 37. This repo is PUBLIC, so every one of
//      them is world-readable at raw.githubusercontent.com with no auth.
//
// The gate used to ask only question 1. It was green, honestly, every run — about a narrower
// question than the one that mattered. The 28 tracked files outside the pack list were never
// scanned, and one of them (this very file) was carrying the roster of foreign identities we
// forbid publishing. The roster of names we refuse to publish WAS the thing published.
//
// So the population is now WHAT GIT PUBLISHES (`git ls-files`, union HEAD, resolved by the
// registry) as well as what npm packs. Not a hardcoded file list, which cannot grow with the
// repo, and not a filesystem walk, which would drag in gitignored files that `git push` never
// transmits.
//
// This file deliberately carries NO list of banned terms. This repository is PUBLIC, so a
// hardcoded roster of the identities we firewall would itself publish the association it exists
// to prevent — a worse leak than any single string it could catch. The roster lives in the
// operator's local, non-public isolation registry; this gate only locates it and enforces the
// verdict.
//
// Matching semantics (own-identity masking, bare case-insensitive substrings, no \b word
// boundaries, per-tenant carve-outs) are the registry's job, not this file's. Keeping one
// implementation means the rules cannot drift between the repo and everything else that enforces
// them.
//
// Fail-closed by design. Every one of these is a FAILURE, never a skip:
//   - the isolation registry cannot be located
//   - the tenant marker is missing or empty
//   - the registry exits non-zero, or cannot certify the publish surface
//
// Run: node test/firewall.mjs   (wired into `npm test`, which `prepublishOnly` runs on publish)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg, hint) {
  console.error(`\x1b[31m✗ firewall: ${msg}\x1b[0m`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

// 1. Which tenant does this artifact belong to? An artifact that cannot name its own tenant
//    cannot be certified against any other tenant's identity.
const tenantFile = join(ROOT, ".tenant");
if (!existsSync(tenantFile)) {
  fail("no .tenant marker at the repo root", "cannot certify an artifact that does not declare its tenant.");
}
const tenant = readFileSync(tenantFile, "utf8").trim();
if (!tenant) fail(".tenant marker is empty", "declare the owning tenant, one slug, no blank default.");

// 2. Locate the isolation registry. Env var wins so CI or another machine can point at its own
//    copy; otherwise fall back to the operator's standard location.
const scanner =
  process.env.TENANT_ISOLATION_SCAN || join(homedir(), ".claude", "scripts", "tenant-isolation-scan.py");

if (!existsSync(scanner)) {
  fail(
    `tenant isolation registry not found at ${scanner}`,
    "set TENANT_ISOLATION_SCAN to its path. A missing gate input is a FAIL, never an 'n/a' —\n" +
      "  this package must not be published from a machine that cannot verify its publish surface.",
  );
}

// 3. Hand it BOTH publish surfaces in one run, so one report covers both and a coverage number
//    is printed for each:
//      --git-index           what `git push` transmits: this repo's index UNION HEAD, resolved
//                            from `git ls-files`, so it grows with the repo on its own. Untracked
//                            and gitignored paths are in no ref and reach no reader, so they are
//                            correctly out of scope; a filesystem walk would flag them and block
//                            every push, which is how a gate gets deleted.
//      --npm-publish-surface what `npm publish` uploads: package.json metadata plus the packed
//                            files. Kept, not replaced — the two sets are not nested. npm packs
//                            from disk and can list a path the index does not carry, so dropping
//                            this one would open a hole in the direction we just closed.
//    The registry fails closed on either surface being unresolvable, so a git or npm failure is
//    exit 2 (surface UNKNOWN), never a quieter scan.
const run = spawnSync(
  process.env.PYTHON || "python3",
  [scanner, "--tenant", tenant, "--git-index", ROOT, "--npm-publish-surface", ROOT],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

if (run.error) fail(`could not run the isolation registry: ${run.error.message}`);
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

if (run.status !== 0) {
  fail(
    `isolation registry exited ${run.status} — the publish surfaces are NOT certified`,
    "remove the offending identity from the tracked/shipped files. Do not exempt it, and do not\n" +
      "  weaken the gate. A finding on the git surface but not the npm one is still a real leak:\n" +
      "  this repo is public, so every tracked file is readable by a stranger over HTTP.",
  );
}

console.log(
  "\x1b[32m✓ firewall: git publish surface AND npm publish surface certified clean by the isolation registry\x1b[0m",
);
