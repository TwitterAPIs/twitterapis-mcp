#!/usr/bin/env node
// Publish firewall: assert that no cross-property identity can ship inside the npm package.
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

// 3. Hand it the true publish surface: package.json metadata plus exactly the files npm packs.
//    `npm publish` uploads that set and nothing else, so that is the leak surface.
const run = spawnSync(
  process.env.PYTHON || "python3",
  [scanner, "--tenant", tenant, "--npm-publish-surface", ROOT],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

if (run.error) fail(`could not run the isolation registry: ${run.error.message}`);
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

if (run.status !== 0) {
  fail(
    `isolation registry exited ${run.status} — the publish surface is NOT certified`,
    "remove the offending identity from the shipped files. Do not exempt it, and do not weaken the gate.",
  );
}

console.log("\x1b[32m✓ firewall: npm publish surface certified clean by the isolation registry\x1b[0m");
