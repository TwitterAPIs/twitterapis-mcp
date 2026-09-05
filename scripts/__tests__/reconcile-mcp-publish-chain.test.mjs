#!/usr/bin/env node
// RED TEST for scripts/reconcile-mcp-publish-chain.mjs.
//
// WHY THIS FILE EXISTS
// -----------------------------------------------------------------------------
// A gate that has never been SEEN to fail is UNVERIFIED, not passing. The live
// chain currently reconciles cleanly, which means every assertion in the gate is
// unexercised in production — a gate could be entirely inert and the green run
// would look identical. So every seam the gate claims to cover is driven here
// against a SYNTHETIC DEFECT, and each case asserts BOTH directions:
//
//     the defect FAILS (with the specific finding kind, not merely non-zero)
//     and the same fixture, clean, PASSES
//
// Asserting only "exit != 0" is not enough: a gate that crashes on every input
// also exits non-zero. Each case therefore asserts the finding KIND, which is what
// distinguishes "detected the defect I injected" from "broke".
//
// Every case runs OFFLINE against fixtures via --surface-dir / --npm-meta. The
// gate is read-only by construction and there is no npm token in scope here, so
// nothing in this file can publish, push, or mutate a registry.
//
// Run: node scripts/__tests__/reconcile-mcp-publish-chain.test.mjs
//      (wired into `npm test`)

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GATE = join(__dirname, "..", "reconcile-mcp-publish-chain.mjs");

let pass = 0;
let fail = 0;
const failures = [];

// ── fixture construction ─────────────────────────────────────────────────────
// A minimal but STRUCTURALLY REAL publish set: a `files` array, a src/ directory
// that must be recursed, and a package.json with nested objects (dependencies)
// so the deep-comparison path is actually exercised rather than assumed.
const BASE_MANIFEST = {
  name: "@twitterapis/mcp",
  version: "0.6.1",
  description: "fixture",
  type: "module",
  repository: { type: "git", url: "https://github.com/TwitterAPIs/twitterapis-mcp.git" },
  main: "src/index.js",
  bin: { "twitterapis-mcp": "src/index.js" },
  files: ["src", "README.md", "LICENSE", "CHANGELOG.md"],
  engines: { node: ">=18" },
  scripts: { test: "node test/tools.test.mjs" },
  dependencies: { "@modelcontextprotocol/sdk": "^1.0.0", zod: "^3.23.8" },
  license: "MIT",
  homepage: "https://www.twitterapis.com/mcp",
};

const BASE_FILES = {
  "src/index.js": "// fixture entrypoint\nexport const x = 1;\n",
  "src/tools.js": "// fixture tools\nexport const tools = [];\n",
  "README.md": "# fixture\n",
  "LICENSE": "MIT\n",
  "CHANGELOG.md": "# Changelog\n",
};

// Registry metadata in the shape `npm view --json` actually returns: identity
// fields as STRINGS. The object shape (raw packument) is exercised separately —
// reading `_npmUser.name` off the string shape yields undefined, which is the
// bug this dual-shape handling exists to prevent.
const BASE_META = {
  "dist-tags": { latest: "0.6.1" },
  _npmUser: "twitterapis <emma@twitterapis.com>",
  maintainers: ["twitterapis <emma@twitterapis.com>"],
  dist: { tarball: "https://registry.npmjs.org/fixture.tgz" },
};

function writeSurface(dir, { manifest = {}, files = {}, omit = [] } = {}) {
  mkdirSync(dir, { recursive: true });
  const mf = { ...structuredClone(BASE_MANIFEST), ...manifest };
  writeFileSync(join(dir, "package.json"), JSON.stringify(mf, null, 2));
  const all = { ...BASE_FILES, ...files };
  for (const [rel, content] of Object.entries(all)) {
    if (omit.includes(rel)) continue;
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function newWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "mcp-chain-redtest-"));
  return root;
}

// Drive the gate. Returns { status, stdout, json } — never throws on a non-zero
// exit, because a non-zero exit is the thing under test.
// The firewall is DELEGATED to the operator's isolation registry, which is not
// present in CI and must never be a dependency of an offline test. Every run is
// therefore pointed at a STUB scanner. The stub is a test seam for the delegation
// WIRING — it cannot hide a finding, because a stub that exits non-zero still has
// to produce the violation the gate then reports (SEAM 6 proves both directions).
const STUB_DIR = mkdtempSync(join(tmpdir(), "mcp-chain-stub-"));
const STUB_CLEAN = join(STUB_DIR, "clean.py");
const STUB_DIRTY = join(STUB_DIR, "dirty.py");
writeFileSync(STUB_CLEAN, "import sys\nprint('stub: CLEAN')\nsys.exit(0)\n");
writeFileSync(STUB_DIRTY, "import sys\nprint('stub: FOREIGN IDENTITY FOUND')\nsys.exit(1)\n");

function runGate(args, { env = {} } = {}) {
  let stdout = "";
  let status = 0;
  try {
    stdout = execFileSync("node", [GATE, ...args, "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, TENANT_ISOLATION_SCAN: STUB_CLEAN, ...env },
    });
  } catch (e) {
    status = e.status ?? 1;
    stdout = (e.stdout || "").toString();
  }
  let json = null;
  try { json = JSON.parse(stdout); } catch { /* exit 2 human path may not be JSON */ }
  return { status, stdout, json };
}

// Build a standard two-surface twitterapis fixture chain.
function chain(root, { repo = {}, npm = {}, meta = BASE_META } = {}) {
  const repoDir = writeSurface(join(root, "repo"), repo);
  const npmDir = writeSurface(join(root, "npm"), npm);
  const metaPath = join(root, "meta.json");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  return [
    "--tenant", "twitterapis",
    "--surface-dir", `repo=${repoDir}`,
    "--surface-dir", `npm=${npmDir}`,
    "--npm-meta", metaPath,
  ];
}

function kinds(json) {
  return (json?.violations || []).map((v) => v.kind);
}

// ── assertion helpers ────────────────────────────────────────────────────────
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail ? ` — ${detail}` : ""}`);
  }
}

// The core red-test shape: a defect must produce a SPECIFIC finding kind, and the
// clean control must pass. Both halves, every time.
function redTest(name, { defectArgs, expectKind, expectStatus = 1, cleanArgs }) {
  const bad = runGate(defectArgs);
  const gotKinds = kinds(bad.json);
  const kindOk = expectKind ? gotKinds.includes(expectKind) : true;
  check(
    `RED  ${name} — defect is DETECTED`,
    bad.status === expectStatus && kindOk,
    `exit=${bad.status} (want ${expectStatus}), kinds=[${gotKinds.join(", ")}]${expectKind ? ` (want ${expectKind})` : ""}`,
  );
  if (cleanArgs) {
    const good = runGate(cleanArgs);
    check(
      `GREEN ${name} — clean control PASSES`,
      good.status === 0,
      `exit=${good.status}, kinds=[${kinds(good.json).join(", ")}]`,
    );
  }
}

console.log("\nRED TEST — MCP publish-chain gate\n");

// ═════════════════════════════════════════════════════════════════════════════
console.log("── baseline ─────────────────────────────────────────────────────");
{
  const root = newWorkspace();
  const args = chain(root);
  const r = runGate(args);
  check("baseline: identical surfaces reconcile (exit 0)", r.status === 0, `exit=${r.status}, kinds=[${kinds(r.json).join(", ")}]`);
  check("baseline: topology resolves to 2 surfaces / 1 hop", r.json?.topology?.surfaces === 2 && r.json?.topology?.hops === 1, JSON.stringify(r.json?.topology));
  check("baseline: coverage is asserted and complete", r.json?.coverage?.union === 6 && r.json?.coverage?.repo?.hashed === 6 && r.json?.coverage?.npm?.hashed === 6, JSON.stringify(r.json?.coverage));
  check("baseline: firewall ran over every published file and reported CLEAN", r.json?.firewall?.ok === true && r.json?.firewall?.scanned === 6, JSON.stringify(r.json?.firewall));
  check("baseline: identity CERTIFIED against registry-controlled fields", r.json?.identity?.certified === true, JSON.stringify(r.json?.identity));
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 1: hop repo → npm (content) ─────────────────────────────");
{
  // The whole point of the gate: bytes differ while everything else looks fine.
  const root = newWorkspace();
  redTest("src/tools.js differs between repo and npm", {
    defectArgs: chain(root, {
      npm: { files: { "src/tools.js": "// STALE published copy\nexport const tools = ['old'];\n" } },
      // Bump so this isolates CONTENT drift from the SILENT-STALE case below.
      repo: { manifest: { version: "0.7.0" } },
      meta: { ...BASE_META, "dist-tags": { latest: "0.6.1" } },
    }),
    expectKind: "content-drift",
    cleanArgs: chain(newWorkspace()),
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // A file the repo ships that the published tarball does not. This is the
  // "customer is missing a module" class.
  const root = newWorkspace();
  redTest("a file present in repo is MISSING from the published tarball", {
    defectArgs: chain(root, {
      npm: { omit: ["src/tools.js"] },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "missing-downstream",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // The inverse, and the one an upstream-only file list CANNOT see: a file that
  // exists only downstream. If the union were derived from the repo alone this
  // case would be invisible, so it is the direct test of THE UNION.
  const root = newWorkspace();
  const r = runGate(chain(root, {
    npm: { files: { "src/extra.js": "// only on npm\n" } },
    repo: { manifest: { version: "0.7.0" } },
  }));
  const ks = kinds(r.json);
  check(
    "RED  a file existing ONLY downstream is enumerated and reported",
    r.status === 1 && (ks.includes("only-on-downstream") || ks.includes("untracked-in-tarball")),
    `exit=${r.status}, kinds=[${ks.join(", ")}]`,
  );
  check(
    "     …and it appears in the union publish set (not silently skipped)",
    (r.json?.publishSet || []).includes("src/extra.js"),
    JSON.stringify(r.json?.publishSet),
  );
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 2: THE VERSION TRAP (SILENT-STALE) ──────────────────────");
{
  // The exact live defect that hit a sibling property: same version string, different
  // bytes. Every version-based check reads GREEN here.
  const root = newWorkspace();
  redTest("same version + different bytes = SILENT-STALE", {
    defectArgs: chain(root, {
      npm: { files: { "src/tools.js": "// stale\n" } },
      // both surfaces stay at 0.6.1
    }),
    expectKind: "SILENT-STALE",
  });
  const r = runGate(chain(newWorkspace(), { npm: { files: { "src/tools.js": "// stale\n" } } }));
  check("     …and silentStale is flagged in the machine-readable output", r.json?.silentStale === true, JSON.stringify(r.json?.silentStale));
  rmSync(root, { recursive: true, force: true });
}
{
  // THE DEAD-BRANCH CASE. `version` lives inside package.json, which is part of
  // the compared content — so a naive `!contentDiffers && versionsDiffer` test can
  // NEVER fire (identical content implies identical package.json implies identical
  // version). The sibling implementation carries exactly that dead branch. This
  // case exists to prove the branch is LIVE here, via nonVersionDrift.
  //
  // Semantics under test: everything matches except the version string. That is a
  // bump with no publish — real publish debt, but NOT the immutability violation,
  // so it must be classified as its own kind and must NOT be SILENT-STALE.
  const root = newWorkspace();
  const r = runGate(chain(root, { repo: { manifest: { version: "0.7.0" } } }));
  check(
    "version-only delta is classified `unpublished-version-bump`",
    kinds(r.json).includes("unpublished-version-bump"),
    `exit=${r.status}, kinds=[${kinds(r.json).join(", ")}]`,
  );
  check(
    "…and is NOT mislabelled SILENT-STALE (npm has not frozen these bytes)",
    r.json?.silentStale === false && r.json?.unpublishedBump === true,
    `silentStale=${r.json?.silentStale}, unpublishedBump=${r.json?.unpublishedBump}`,
  );
  // On a PR this is the CORRECT state — the author bumped, the publish follows the
  // merge. Blocking it would make the gate bypassed on every legitimate release PR.
  const rm = runGate([...chain(newWorkspace(), { repo: { manifest: { version: "0.7.0" } } }), "--mode=merge-path"]);
  check(
    "…and on the merge path it is publish DEBT, not a block",
    rm.status === 0 && (rm.json?.publishDebt || []).some((d) => d.kind === "unpublished-version-bump"),
    `exit=${rm.status}, debt=${JSON.stringify((rm.json?.publishDebt || []).map((d) => d.kind))}`,
  );
  // The inverse must still be caught: same version, different bytes.
  const rs = runGate(chain(newWorkspace(), { npm: { files: { "src/tools.js": "// stale\n" } } }));
  check(
    "…while same-version + different-bytes remains SILENT-STALE",
    rs.json?.silentStale === true && rs.json?.unpublishedBump === false,
    `silentStale=${rs.json?.silentStale}, unpublishedBump=${rs.json?.unpublishedBump}`,
  );
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 3: package.json deep comparison ─────────────────────────");
{
  // The bug that shipped in the sibling's first draft: using JSON.stringify with
  // an array replacer strips NESTED keys, so a dependency version swap hashes
  // identically. This case is the reason the deep serializer is hand-written.
  const root = newWorkspace();
  redTest("a NESTED dependency version swap is detected", {
    defectArgs: chain(root, {
      npm: { manifest: { dependencies: { "@modelcontextprotocol/sdk": "^1.0.0", zod: "^2.0.0-EVIL" } } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "content-drift",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // A field nobody enumerated. Under an ALLOWLIST this passes green; under the
  // denylist it is compared by default. `exports` alone decides what a consumer
  // can import, so this is a real consumer-facing defect.
  const root = newWorkspace();
  redTest("an `exports` map present only on npm is detected (denylist, not allowlist)", {
    defectArgs: chain(root, {
      npm: { manifest: { exports: { ".": "./src/evil.js" } } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "content-drift",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // Key ORDER must not register as drift.
  const root = newWorkspace();
  const reordered = {};
  for (const k of Object.keys(BASE_MANIFEST).reverse()) reordered[k] = BASE_MANIFEST[k];
  const r = runGate(chain(root, { npm: { manifest: reordered } }));
  check("package.json key REORDERING is not drift", r.status === 0, `exit=${r.status}, kinds=[${kinds(r.json).join(", ")}]`);
  rmSync(root, { recursive: true, force: true });
}
{
  // `scripts` is the one denylisted field: build-time only, advisory not blocking.
  const root = newWorkspace();
  const r = runGate(chain(root, { npm: { manifest: { scripts: { test: "echo different" } } } }));
  check(
    "a `scripts`-only delta is advisory, NOT blocking",
    r.status === 0 && (r.json?.warnings || []).some((w) => /scripts/i.test(w)),
    `exit=${r.status}, warnings=${JSON.stringify(r.json?.warnings)}`,
  );
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 4: publish-set shape ────────────────────────────────────");
{
  // `files` names something that does not exist. The per-file diff cannot catch
  // this, because the entry never enters the file list at all.
  const root = newWorkspace();
  redTest("a `files` entry that does not exist is reported, not silently dropped", {
    defectArgs: chain(root, {
      repo: { manifest: { files: ["src", "README.md", "LICENSE", "CHANGELOG.md", "docs"] } },
    }),
    expectKind: "listed-but-absent",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("the tarball shipping a file the repo does not track is reported", {
    defectArgs: chain(root, {
      npm: { files: { "src/stowaway.js": "// not in the repo publish set\n" } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "untracked-in-tarball",
  });
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 5: tenant isolation on the publish origin ───────────────");
{
  const root = newWorkspace();
  redTest("published repository.url owned by the wrong org", {
    defectArgs: chain(root, {
      npm: { manifest: { repository: { type: "git", url: "https://github.com/some-other-org/twitterapis-mcp.git" } } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "unexpected-publish-org",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // The SUBSTRING ATTACK. `url.includes("/TwitterAPIs/")` is satisfied by this URL
  // while the actual owner is `attacker`. The owner is positional and must be
  // parsed positionally — this case is why parseRepoOwner exists.
  const root = newWorkspace();
  redTest("owner-segment spoof (attacker/TwitterAPIs/x) is NOT accepted", {
    defectArgs: chain(root, {
      npm: { manifest: { repository: { type: "git", url: "https://github.com/attacker/TwitterAPIs/twitterapis-mcp.git" } } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "unexpected-publish-org",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("a published package with NO repository.url cannot be verified", {
    defectArgs: chain(root, {
      npm: { manifest: { repository: undefined } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "no-repository-url",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("an unparseable repository.url is a FAIL, never a skip", {
    defectArgs: chain(root, {
      npm: { manifest: { repository: { type: "git", url: "not-a-url" } } },
      repo: { manifest: { version: "0.7.0" } },
    }),
    expectKind: "unparseable-repository-url",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // Case-insensitive org match: the GitHub org is `TwitterAPIs`, and a lowercase
  // spelling of the SAME org must not read as a breach.
  const root = newWorkspace();
  const r = runGate(chain(root, {
    npm: { manifest: { repository: { type: "git", url: "https://github.com/twitterapis/twitterapis-mcp.git" } } },
    repo: { manifest: { repository: { type: "git", url: "https://github.com/twitterapis/twitterapis-mcp.git" } } },
  }));
  check("asymmetric org casing (twitterapis vs TwitterAPIs) is not a false positive", r.status === 0, `exit=${r.status}, kinds=[${kinds(r.json).join(", ")}]`);
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 6: tenant-isolation firewall (DELEGATED) ─────────────");
{
  // The firewall carries no roster in this repo — it delegates. So what must be
  // red-tested here is the DELEGATION, in all three of its states:
  //   registry says clean  -> pass
  //   registry says dirty  -> BLOCK, and surface the registry's own output
  //   registry missing     -> FAIL-CLOSED (exit 2), never a silent skip
  const root = newWorkspace();
  const args = chain(root);

  const clean = runGate(args, { env: { TENANT_ISOLATION_SCAN: STUB_CLEAN } });
  check(
    "firewall: a CLEAN verdict from the registry passes",
    clean.status === 0 && clean.json?.firewall?.ok === true,
    `exit=${clean.status}, firewall=${JSON.stringify(clean.json?.firewall)}`,
  );

  const dirty = runGate(args, { env: { TENANT_ISOLATION_SCAN: STUB_DIRTY } });
  check(
    "RED  firewall: a VIOLATION verdict BLOCKS the published artifact",
    dirty.status === 1 && kinds(dirty.json).includes("FOREIGN-IDENTITY-PUBLISHED"),
    `exit=${dirty.status}, kinds=[${kinds(dirty.json).join(", ")}]`,
  );
  check(
    "     …and the registry's own output is surfaced, not swallowed",
    (dirty.json?.violations || []).some((v) => /FOREIGN IDENTITY FOUND/.test(v.detail || "")),
    JSON.stringify((dirty.json?.violations || []).map((v) => v.kind)),
  );

  // MISSING REGISTRY IS A FAIL. This is the whole fail-closed contract: a machine
  // that cannot check the artifact must not certify it.
  const missing = runGate(args, { env: { TENANT_ISOLATION_SCAN: join(root, "no-such-scanner.py") } });
  check(
    "RED  firewall: a MISSING registry is exit 2 (fail-closed), never a pass",
    missing.status === 2,
    `exit=${missing.status}`,
  );
  check(
    "     …and it is reported as gate-could-not-run, not as drift",
    missing.json?.reason === "gate-could-not-run",
    JSON.stringify(missing.json?.reason),
  );
  check(
    "firewall: the delegation target is named in the output (auditable)",
    typeof clean.json?.firewall?.delegatedTo === "string" && clean.json.firewall.delegatedTo.length > 0,
    JSON.stringify(clean.json?.firewall),
  );
  check(
    "firewall: scanned count covers every published file",
    clean.json?.firewall?.scanned === clean.json?.publishSet?.length,
    `scanned=${clean.json?.firewall?.scanned}, publishSet=${clean.json?.publishSet?.length}`,
  );
  rmSync(root, { recursive: true, force: true });
}

console.log("\n── SEAM 7: publishing identity (registry-controlled) ────────────");
{
  // The gap content parity cannot close: correct bytes, correct repository.url,
  // WRONG publisher. repository.url is publisher-written; _npmUser is not.
  const root = newWorkspace();
  redTest("_npmUser is not the expected owner (WRONG-PUBLISHER)", {
    defectArgs: chain(root, { meta: { ...BASE_META, _npmUser: "attacker <evil@example.com>" } }),
    expectKind: "WRONG-PUBLISHER",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("an EXTRA maintainer is a standing ability to publish", {
    defectArgs: chain(root, {
      meta: { ...BASE_META, maintainers: ["twitterapis <emma@twitterapis.com>", "someone_else <x@y.com>"] },
    }),
    expectKind: "UNEXPECTED-MAINTAINER",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("the right username on the WRONG account email", {
    defectArgs: chain(root, { meta: { ...BASE_META, _npmUser: "twitterapis <someone@gmail.com>" } }),
    expectKind: "WRONG-PUBLISHER-EMAIL",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("no maintainers array = who may publish cannot be established", {
    defectArgs: chain(root, { meta: { ...BASE_META, maintainers: [] } }),
    expectKind: "NO-MAINTAINERS",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  const root = newWorkspace();
  redTest("an unreadable _npmUser is a FAIL, never 'no objection'", {
    defectArgs: chain(root, { meta: { ...BASE_META, _npmUser: { nope: true } } }),
    expectKind: "IDENTITY-UNREADABLE",
  });
  rmSync(root, { recursive: true, force: true });
}
{
  // THE DUAL-SHAPE CASE. `npm view --json` returns STRINGS; the raw packument
  // returns OBJECTS. Reading `_npmUser.name` off the string shape gets undefined.
  // Both must parse, or the live path silently stops checking identity.
  const root = newWorkspace();
  const r = runGate(chain(root, {
    meta: {
      ...BASE_META,
      _npmUser: { name: "twitterapis", email: "emma@twitterapis.com" },
      maintainers: [{ name: "twitterapis", email: "emma@twitterapis.com" }],
    },
  }));
  check(
    "OBJECT-shaped identity (raw packument) parses and certifies",
    r.status === 0 && r.json?.identity?.certified === true,
    `exit=${r.status}, identity=${JSON.stringify(r.json?.identity)}`,
  );
  rmSync(root, { recursive: true, force: true });
}
{
  // MISSING INPUT IS A FAIL. Without --npm-meta there is no registry metadata, so
  // WHO published cannot be established. A gate that skips here is fail-open.
  const root = newWorkspace();
  const repoDir = writeSurface(join(root, "repo"));
  const npmDir = writeSurface(join(root, "npm"));
  const noMeta = ["--tenant", "twitterapis", "--surface-dir", `repo=${repoDir}`, "--surface-dir", `npm=${npmDir}`];
  const r = runGate(noMeta);
  check(
    "RED  absent registry metadata BLOCKS (missing input is never 'n/a')",
    r.status === 1 && kinds(r.json).includes("IDENTITY-NOT-CERTIFIED"),
    `exit=${r.status}, kinds=[${kinds(r.json).join(", ")}]`,
  );
  // And the escape hatch downgrades it WITHOUT ever certifying.
  const r2 = runGate([...noMeta, "--allow-uncertified-identity"]);
  check(
    "     --allow-uncertified-identity downgrades to advisory…",
    r2.status === 0,
    `exit=${r2.status}, kinds=[${kinds(r2.json).join(", ")}]`,
  );
  check(
    "     …but can NEVER mark identity certified",
    r2.json?.identity?.certified === false,
    JSON.stringify(r2.json?.identity),
  );
  check(
    "     …and the bypass is NAMED in the output",
    (r2.json?.bypasses?.active || []).length === 1,
    JSON.stringify(r2.json?.bypasses),
  );
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 8: merge-path vs reconcile mode ─────────────────────────");
{
  // In merge-path mode content drift is EXPECTED (the PR is the fix) and is
  // recorded as debt, not blocked. A gate that blocked here would be bypassed on
  // every legitimate PR — which is the failure mode that killed the pre-commit
  // placement.
  const root = newWorkspace();
  const args = chain(root, {
    npm: { files: { "src/tools.js": "// published earlier\n" } },
    repo: { manifest: { version: "0.7.0" } },
  });
  const r = runGate([...args, "--mode=merge-path"]);
  check(
    "merge-path: content drift is PUBLISH DEBT, not a block",
    r.status === 0 && (r.json?.publishDebt || []).length > 0,
    `exit=${r.status}, debt=${(r.json?.publishDebt || []).length}, kinds=[${kinds(r.json).join(", ")}]`,
  );
  // …but the SAME drift under the SAME version is still blocked, because that is
  // the one thing the PR author can and must fix in the PR.
  const args2 = chain(newWorkspace(), { npm: { files: { "src/tools.js": "// published earlier\n" } } });
  const r2 = runGate([...args2, "--mode=merge-path"]);
  check(
    "merge-path: SILENT-STALE is still BLOCKING (author can bump the version)",
    r2.status === 1 && kinds(r2.json).includes("SILENT-STALE"),
    `exit=${r2.status}, kinds=[${kinds(r2.json).join(", ")}]`,
  );
  // Reconcile mode blocks the same drift merge-path treated as debt.
  const r3 = runGate([...chain(newWorkspace(), {
    npm: { files: { "src/tools.js": "// published earlier\n" } },
    repo: { manifest: { version: "0.7.0" } },
  }), "--mode=reconcile"]);
  check(
    "reconcile: the same drift IS blocking (everything blocks on the timer)",
    r3.status === 1,
    `exit=${r3.status}, kinds=[${kinds(r3.json).join(", ")}]`,
  );
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 9: fail-closed (exit 2, the gate could not run) ─────────");
{
  const root = newWorkspace();
  const repoDir = writeSurface(join(root, "repo"));
  const cases = [
    ["unknown tenant", ["--tenant", "nope", "--surface-dir", `repo=${repoDir}`]],
    ["unknown mode", ["--tenant", "twitterapis", "--mode=banana", "--surface-dir", `repo=${repoDir}`]],
    ["nonexistent surface dir", ["--tenant", "twitterapis", "--surface-dir", `repo=${join(root, "does-not-exist")}`, "--surface-dir", `npm=${repoDir}`]],
    ["malformed --surface-dir spec", ["--tenant", "twitterapis", "--surface-dir", "garbage"]],
  ];
  for (const [name, args] of cases) {
    const r = runGate(args);
    check(`fail-closed: ${name} exits 2 (not 0)`, r.status === 2, `exit=${r.status}`);
  }

  // A surface whose package.json is not valid JSON.
  const broken = join(root, "broken");
  mkdirSync(broken, { recursive: true });
  writeFileSync(join(broken, "package.json"), "{ not json");
  const rb = runGate(["--tenant", "twitterapis", "--surface-dir", `repo=${broken}`, "--surface-dir", `npm=${repoDir}`]);
  check("fail-closed: unparseable package.json exits 2", rb.status === 2, `exit=${rb.status}`);

  // A surface with no `files` array — its publish set cannot be enumerated
  // independently, which is the blind spot the union exists to close.
  const noFiles = writeSurface(join(root, "nofiles"), { manifest: { files: undefined } });
  const rn = runGate(["--tenant", "twitterapis", "--surface-dir", `repo=${noFiles}`, "--surface-dir", `npm=${repoDir}`]);
  check("fail-closed: a surface with no `files` array exits 2", rn.status === 2, `exit=${rn.status}`);

  // Wrong package name on the authoring surface — the gate must not reconcile a
  // chain it was pointed at by mistake. Scoped vs unscoped are DIFFERENT packages.
  const wrongName = writeSurface(join(root, "wrongname"), { manifest: { name: "twitterapis-mcp" } });
  const rw = runGate(["--tenant", "twitterapis", "--surface-dir", `repo=${wrongName}`, "--surface-dir", `npm=${repoDir}`]);
  check("fail-closed: scoped/unscoped package-name mismatch exits 2", rw.status === 2, `exit=${rw.status}`);

  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 10: bypass accounting ───────────────────────────────────");
{
  // The retired env bypass from the sibling's pre-commit era must not silence
  // this gate, and its presence must be VISIBLE.
  const root = newWorkspace();
  const args = chain(root, { npm: { files: { "src/tools.js": "// stale\n" } } });
  const r = runGate(args, { env: { SKIP_MCP_PUBLISH_CHAIN: "1" } });
  check(
    "SKIP_MCP_PUBLISH_CHAIN=1 does NOT silence the gate",
    r.status === 1,
    `exit=${r.status}`,
  );
  check(
    "…and the refused bypass is named in the output",
    (r.json?.bypasses?.refused || []).includes("SKIP_MCP_PUBLISH_CHAIN"),
    JSON.stringify(r.json?.bypasses),
  );
  rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n── SEAM 11: property parameterization (not a fork) ───────────");
{
  // The claim under test: this is ONE engine driven by data, not this property's
  // gate with a flag on it.
  //
  // The second property is SYNTHETIC and supplied through the external config path,
  // for the same reason the engine ships no sibling entry: this repo is public, and
  // naming a real sibling here would publish the association the firewall exists to
  // prevent. A fictional property proves the mechanism just as well — what is being
  // tested is that a DIFFERENT topology and a DIFFERENT identity contract are
  // honoured with no code change.
  const root = newWorkspace();
  const cfg = {
    acme: {
      npmPkg: "acme-mcp",
      // THREE surfaces / TWO hops: a monorepo authoring copy, mirrored into a
      // separate publish repo, then published. Structurally unlike this repo's chain.
      surfaces: [
        { id: "authored", kind: "local", path: "packages/mcp", label: "AUTHORED (monorepo)" },
        { id: "org", kind: "git", url: "https://github.com/acme-org/acme-mcp.git", label: "PUBLISH REPO" },
        { id: "npm", kind: "npm", label: "NPM" },
      ],
      expectedPublishOrg: "acme-org",
      expectedNpmOwner: "acme_publisher",
      expectedNpmOwnerEmail: "release@acme.test",
    },
  };
  const cfgPath = join(root, "tenants.json");
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

  const ACME = {
    name: "acme-mcp",
    repository: { type: "git", url: "https://github.com/acme-org/acme-mcp.git" },
    homepage: "https://acme.test/mcp",
    bin: { "acme-mcp": "src/index.js" },
  };
  const authored = writeSurface(join(root, "authored"), { manifest: ACME });
  const org = writeSurface(join(root, "org"), { manifest: ACME });
  const npmDir = writeSurface(join(root, "npm"), { manifest: ACME });
  const metaPath = join(root, "meta.json");
  writeFileSync(metaPath, JSON.stringify({
    "dist-tags": { latest: "0.6.1" },
    _npmUser: "acme_publisher <release@acme.test>",
    maintainers: ["acme_publisher <release@acme.test>"],
  }, null, 2));

  const acmeArgs = (orgDir) => [
    "--tenant", "acme", "--tenant-config", cfgPath,
    "--surface-dir", `authored=${authored}`,
    "--surface-dir", `org=${orgDir}`,
    "--surface-dir", `npm=${npmDir}`,
    "--npm-meta", metaPath,
  ];

  const r = runGate(acmeArgs(org));
  check(
    "an external property resolves a 3-surface / 2-hop chain from the same engine",
    r.json?.topology?.surfaces === 3 && r.json?.topology?.chain?.join(",") === "authored,org,npm",
    JSON.stringify(r.json?.topology),
  );
  check(
    "…and PASSES clean against its OWN identity contract",
    r.status === 0 && r.json?.identity?.expectedOwner === "acme_publisher",
    `exit=${r.status}, identity=${JSON.stringify(r.json?.identity)}`,
  );
  check(
    "…and derives the end-to-end hop that a 2-surface chain does not need",
    r.json?.topology?.hops === 3,
    `hops=${r.json?.topology?.hops}`,
  );

  // A stale MIDDLE mirror is a defect class a 2-surface chain structurally cannot
  // have. It must be detected for a 3-surface property.
  const org2 = writeSurface(join(root, "org2"), { manifest: ACME, files: { "src/tools.js": "// mirror never updated\n" } });
  const r2 = runGate(acmeArgs(org2));
  check(
    "RED  a stale MIDDLE mirror surface is detected on a 3-surface chain",
    r2.status === 1 && kinds(r2.json).includes("content-drift"),
    `exit=${r2.status}, kinds=[${kinds(r2.json).join(", ")}]`,
  );

  // An external config must not be able to hijack this repo's own chain.
  const hostile = join(root, "hostile.json");
  writeFileSync(hostile, JSON.stringify({ twitterapis: { npmPkg: "attacker-pkg", surfaces: [], expectedNpmOwner: "attacker" } }));
  const r3 = runGate(["--tenant", "twitterapis", "--tenant-config", hostile, "--surface-dir", `repo=${authored}`]);
  check(
    "RED  an external config REDEFINING this repo's own property is refused (exit 2)",
    r3.status === 2,
    `exit=${r3.status}`,
  );

  // A config that was asked for and is absent is a FAIL, not an empty default.
  const r4 = runGate(["--tenant", "acme", "--tenant-config", join(root, "nope.json")]);
  check(
    "RED  a missing --tenant-config is exit 2, never an empty default",
    r4.status === 2,
    `exit=${r4.status}`,
  );
  rmSync(root, { recursive: true, force: true });
}
{
  const gateSrc = readFileSync(GATE, "utf8");
  // The engine must carry no property literal outside its own self-entry. This is
  // what makes the file identical across every repo that vendors it.
  const afterTable = gateSrc.slice(gateSrc.indexOf("function loadExternalTenants"));
  const codeLines = afterTable.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
  const hits = codeLines.filter((l) => /twitterapis|acme/i.test(l));
  check(
    "the engine carries NO property literal below the TENANTS table",
    hits.length === 0,
    `offending lines: ${JSON.stringify(hits.slice(0, 3))}`,
  );
}
{
  // SELF-FIREWALL — enforced by DELEGATION, asserted here structurally.
  //
  // These files ship in a PUBLIC repo, so a foreign-property identity written into
  // any of them leaks the association the firewall exists to prevent. That defect
  // was real on this PR: the first draft hardcoded a sibling property's entire
  // chain and identity contract into the table, and an earlier draft of THIS check
  // carried a literal roster of banned tokens — which is the same leak in the file
  // whose job was to stop it.
  //
  // So this test carries NO roster either. The whole-tree scan is delegated to the
  // operator's isolation registry, invoked from scripts/mcp-chain-reconcile.sh
  // (which runs where that registry lives; a CI box does not have it). What is
  // asserted here is that the delegation is actually WIRED and fail-closed — a
  // check that a scan exists is worth nothing if the scan can be skipped.
  const shPath = join(__dirname, "..", "mcp-chain-reconcile.sh");
  const sh = readFileSync(shPath, "utf8");
  check(
    "scheduled script delegates a WHOLE-TREE isolation scan",
    /--tenant "\$REPO_TENANT" --path "\$ARCHIVE_DIR"/.test(sh),
    "no whole-tree isolation scan found in mcp-chain-reconcile.sh",
  );
  check(
    "…and FAILS CLOSED when the isolation registry is absent",
    /if \[ ! -f "\$ISO_SCAN" \]/.test(sh) && /exit 2/.test(sh),
    "a missing registry does not fail-closed",
  );
  check(
    "…and FAILS CLOSED when the property cannot be determined",
    /no \.tenant marker and no MCP_CHAIN_TENANT/.test(sh),
    "an undeclared property does not fail-closed",
  );
  check(
    "…and scans the pristine origin/main archive, not the dirty working tree",
    sh.includes('--path "$ARCHIVE_DIR"'),
    "the isolation scan is pointed at something other than the archive",
  );
}

console.log("\n── SEAM 12: the gate has no write path ──────────────────────────");
{
  // Structural assertion, not behavioural: the gate must never be able to publish.
  // A behavioural test cannot prove absence, but the source can prove no write verb
  // is ever handed to a subprocess.
  //
  // A naive substring scan for '"version"' is WRONG and produced a false positive on
  // the first run — `version` is a legitimate package.json FIELD NAME that appears
  // all over this file as data. What matters is not whether the word occurs, but
  // whether it is ever passed as a COMMAND VERB. So this parses the actual
  // execFileSync call sites and checks the verb against a read-only allowlist.
  const src = readFileSync(GATE, "utf8");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

  // Capture each execFileSync(<bin>, [ ...args ]) call and scan EVERY string
  // literal in its args array against a write-verb denylist. Taking only the first
  // array element is not enough — `git -C <dir> log` puts a flag first, which is
  // how the first version of this check produced a false positive on a read-only
  // call. Scanning the whole array cannot be fooled by argument position.
  const CALL = /execFileSync\(\s*([A-Za-z_$][\w$]*|"[^"]+")\s*,\s*\[([^\]]*)\]/g;
  const WRITE_VERBS = new Set([
    "publish", "unpublish", "push", "commit", "tag", "version", "deprecate",
    "dist-tag", "owner", "adduser", "login", "config", "set", "write", "init",
  ]);
  const calls = [];
  let m;
  while ((m = CALL.exec(code)) !== null) {
    const bin = m[1].replace(/"/g, "");
    const literals = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    calls.push({ bin, literals });
  }
  check(
    "every subprocess call site was located (the scan is not empty)",
    calls.length > 0,
    `found ${calls.length} execFileSync call sites`,
  );
  const offenders = calls.filter((c) => c.literals.some((l) => WRITE_VERBS.has(l)));
  check(
    `no subprocess arg list contains a write verb (scanned ${calls.length} call sites, ${calls.reduce((n, c) => n + c.literals.length, 0)} literals)`,
    offenders.length === 0,
    `write-capable calls: ${JSON.stringify(offenders)}`,
  );
  // Prove the scan can actually fail — a check that has never fired is unverified.
  const synthetic = [{ bin: "npm", literals: ["publish"] }];
  check(
    "…and that scan DOES flag a synthetic `npm publish` call",
    synthetic.filter((c) => c.literals.some((l) => WRITE_VERBS.has(l))).length === 1,
    "the write-verb scan failed to flag an injected publish",
  );
  // And the irreversible commands must not appear as command strings anywhere.
  for (const forbidden of ["npm publish", "git push", '"publish"']) {
    check(
      `gate source contains no \`${forbidden}\``,
      !code.includes(forbidden),
      `found "${forbidden}" in executable source`,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log(`\n${"─".repeat(70)}`);
if (fail > 0) {
  console.log(`\x1b[31m  RED TEST FAILED — ${fail} failing, ${pass} passing\x1b[0m\n`);
  for (const f of failures) console.log(`    ✗ ${f}`);
  console.log();
  process.exit(1);
}
console.log(`\x1b[32m  RED TEST PASSED — ${pass} assertions, every seam proven to FAIL on a synthetic defect and PASS clean\x1b[0m\n`);
