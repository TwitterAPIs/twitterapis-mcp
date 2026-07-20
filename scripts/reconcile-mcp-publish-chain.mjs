#!/usr/bin/env node
// reconcile-mcp-publish-chain.mjs — MCP PUBLISH-CHAIN parity gate (read-only).
//
// WHY THIS EXISTS (the fail-open it closes)
// -----------------------------------------------------------------------------
// test/openapi-parity.mjs reconciles the MCP tool catalog against the OpenAPI
// snapshot, and test/firewall.mjs scans what `npm pack` WOULD upload. Both read
// the local working tree. Neither can answer the only question a customer's
// install actually depends on:
//
//     is the package on the registry the same code as the repo?
//
// The MCP server travels a publish chain, and every hop in it is a MANUAL step
// that can silently not happen:
//
//   (1) REPO   TwitterAPIs/twitterapis-mcp @ origin/main
//         │
//         │  hop — a human runs `npm publish`
//         ▼
//   (2) NPM    @twitterapis/mcp             (scoped, what customers install)
//
// If the publish never runs, every local gate still reports GREEN over a
// published package that is missing the fix. That is a fail-open, and it is not
// hypothetical: a sibling property on this operator's fleet hit exactly this. Its
// MCP package was published as 0.1.1 while its repo also said 0.1.1, and the two
// were DIFFERENT — only 1 of 6 files matched. Customers' agents were running a
// stale tool description.
//
// THE VERSION TRAP (why a version check is not enough)
// -----------------------------------------------------------------------------
// In that incident the version strings AGREED while the bytes did not. A gate
// that compared versions would have reported parity over live drift. So this gate
// reconciles by CONTENT HASH PER FILE, and treats "same version, different bytes"
// as the single most severe finding it can emit, because that is the state in
// which every cheaper check lies to you.
//
// TOPOLOGY IS PER-PROPERTY — DO NOT ASSUME A SIBLING'S SHAPE (2026-07-20)
// -----------------------------------------------------------------------------
// This gate is a port of one written for a sibling property, and the most important
// thing that did NOT port is the number of hops.
//
//   a MIRRORED property :  AUTHORED (monorepo subdir) -> PUBLISH REPO -> NPM  2 hops
//   THIS property       :  REPO (authoring source) -> NPM                     1 hop
//
// A property that authors its MCP inside a monorepo and MIRRORS it into a separate
// publish repo has a middle surface that can go stale on its own. This repo has no
// such mirror: it IS both the authoring source and the publish source. Verified
// 2026-07-20 — every checkout of `@twitterapis/mcp` on the build machine resolves
// to this one remote, and no monorepo copy exists.
//
// So the chain is declared as an ORDERED LIST OF SURFACES per tenant, and the hops
// are DERIVED from it, rather than three surfaces being baked into the control
// flow. A two-surface tenant yields one hop; a three-surface tenant yields the two
// adjacent hops plus the end-to-end hop that is what customers actually feel.
// Hardcoding "3 surfaces, 2 hops" here would have produced a gate that reports on
// a mirror repo this tenant does not have — decoration that passes green because
// it is comparing a surface against itself.
//
// WHERE THIS GATE RUNS, AND WHY IT IS NOT A PRE-COMMIT HOOK
// -----------------------------------------------------------------------------
// The sibling shipped this wired into a pre-commit hook and had to remove it. The
// defect is worth restating so it is not reintroduced here: the hook fired on the
// commit that STAGED the MCP change and the gate read the WORKING TREE, so the act
// of fixing a file is precisely what makes REPO differ from NPM. The gate then
// blocked the very commit that fixed the drift, and every legitimate PR needed a
// bypass. A gate that is bypassed on every legitimate use is OFF.
//
// The publish chain is a property of what has LANDED, not of what is being typed.
// So enforcement lives in the three places where the question is well-posed:
//
//   1. THE MERGE PATH  (--mode=merge-path, .github/workflows/mcp-publish-chain.yml)
//      Runs on the PR merge result. Content drift here is EXPECTED and legitimate
//      — the PR is the fix, and reconciling it requires a publish, which is an
//      operator action that cannot happen inside CI. Content drift is therefore
//      reported as PUBLISH DEBT (advisory), not blocked.
//      What IS blocked is the one thing the PR author can fix in the PR:
//      SILENT-STALE. If the repo's publish set now differs from the published
//      package while BOTH still carry the same version string, the change is
//      unshippable — npm immutability means that version can never carry these
//      bytes. Bumping the version resolves it, in the same PR, by the author.
//
//   2. THE SCHEDULED RECONCILE  (--mode=reconcile, the default)
//      Runs against origin/main on a timer, via scripts/mcp-chain-reconcile.sh.
//      Everything blocks. This is the mode that catches the live drift class,
//      which NO COMMIT CAUSES: main landed a fix weeks ago and nobody ever ran the
//      publish. There is no commit to hang a hook on and no CI run to attach a
//      check to, so only a timer sees it. Deliberately runnable WITHOUT GitHub
//      Actions so it can be armed from a laptop/cron independently of CI.
//
//   3. PRE-PUBLISH  (--mode=reconcile --publish-intent, operator-run)
//      The one moment the operator can still prevent a bad publish rather than
//      report one afterwards.
//
// BYPASSES
// -----------------------------------------------------------------------------
// There is no env var that disables this gate. The only bypass is
// --allow-uncertified-identity, which can never certify anything, and any active
// bypass is NAMED in the gate's own output on every run, pass or fail, so a
// weakened run can never be mistaken for a clean one. A retired env bypass from the
// pre-commit era is detected and REFUSED, so that muscle memory cannot silence this
// gate either.
//
// TENANT ISOLATION (do not "fix" the split)
// -----------------------------------------------------------------------------
// This property is a standalone brand and this package ships to a public registry,
// so no foreign-property identity may appear on it. The gate asserts that on the
// PUBLISHED artifact (check 6 + check 9) rather than trusting that a local
// pre-publish scan ran — test/firewall.mjs checks what WOULD ship, this checks what
// ALREADY DID. Those are different questions, and only the second is about the
// artifact customers already have.
//
// Check 9 carries NO roster of its own. It DELEGATES to the operator's isolation
// registry, exactly as test/firewall.mjs does, for exactly the same reason: this
// repository is PUBLIC, so a hardcoded list of the identities being firewalled
// would itself publish the association it exists to prevent — a worse leak than
// any single string it could catch. The registry owns the matching semantics
// (bare case-insensitive substrings, never \b word boundaries, because a \b match
// misses the prefixed forms that actually leak) and the per-property carve-outs.
// One implementation, so the rules cannot drift between this gate and everything
// else that enforces them. A registry that cannot be located is a FAIL.
//
// WHO PUBLISHED IT (the identity gap)
// -----------------------------------------------------------------------------
// Content parity answers "is the code the same". It does not answer "who put it
// there". `repository.url` inside a published tarball is a field the PUBLISHER
// writes, so it validates a CLAIM, not an identity: a package republished from a
// hostile or simply wrong npm account, with repository.url set correctly, passes
// a content check green.
//
// The authoritative signal is registry-controlled and cannot be forged by the
// publisher: `_npmUser` (who ran the publish) and `maintainers` (who may). Those
// come back on the `npm view --json` metadata this gate already fetches. Check 7
// asserts both. Check 8 runs `npm whoami` and compares it BEFORE a publish, so a
// publish about to happen from the wrong account is caught while it is still
// reversible. Under --publish-intent an unresolvable whoami is a FAIL, not a skip:
// "no token configured" is exactly the state in which a publish silently goes out
// as whoever happens to be logged in.
//
// SHAPE WARNING — do not "simplify" the identity normalizer. `npm view --json`
// serializes these fields as STRINGS ("<user> <email>"), while the raw registry
// packument returns OBJECTS ({name, email}). Reading `meta._npmUser.name` gets
// `undefined` on the live path. Both shapes are parsed; anything that parses to
// neither is a FAIL, never a skip.
//
// npm usernames follow NO pattern across properties, and the GitHub org casing is
// asymmetric too (`TwitterAPIs` on GitHub, lowercase everywhere else). None of it
// is derivable from the package name. Every value in the TENANTS table below was
// READ FROM THE REGISTRY, not inferred.
//
// WHAT IS COMPARED — THE UNION, NOT ONE SURFACE
// -----------------------------------------------------------------------------
// The comparison set is the UNION of every surface's independently enumerated
// publish set. Deriving the file list from the upstream surface alone makes a
// whole defect class invisible: a file that exists only DOWNSTREAM is never
// enumerated, so it is never hashed, so it cannot be reported — the gate cannot
// see a file it was not told to look for.
//
// Files that never reach a consumer (test/, package-lock, .tenant, .gitignore)
// stay out of scope: they cannot be the "customer runs stale code" bug this gate
// exists to catch, and including them would add noise that trains people to ignore
// it. They are excluded STRUCTURALLY, by being outside each surface's `files`
// array, not by a hardcoded ignore list.
//
// package.json is compared on a NORMALIZED subset — a DENYLIST, not an allowlist.
// `scripts` is the only excluded field; every other key at every depth is
// compared. An allowlist fails OPEN on every field nobody thought of, and
// package.json grows new consumer-facing fields with every npm release — an
// `exports` map alone decides which files a consumer can import. A denylist fails
// safe: a new field is compared by default, and excluding one is a deliberate,
// reviewable act. `scripts` is excluded because prepublishOnly legitimately
// differs between a repo and a published tarball; it is reported as an advisory.
//
// EXIT CODES
// -----------------------------------------------------------------------------
//   0  every hop reconciles (or, in merge-path mode, the only findings are debt)
//   1  DRIFT on at least one blocking check
//   2  the gate could not run — a surface was unreachable, unreadable, or a parser
//      broke. FAIL-CLOSED. An unreachable registry is never "n/a"; a gate that
//      skips is a gate that lies.
//
// USAGE
//   node scripts/reconcile-mcp-publish-chain.mjs                    # scheduled reconcile
//   node scripts/reconcile-mcp-publish-chain.mjs --mode=merge-path  # PR CI
//   node scripts/reconcile-mcp-publish-chain.mjs --json             # machine-readable
//   MCP_CHAIN_TENANT_CONFIG=/path/outside/this/repo/tenants.json \
//     node scripts/reconcile-mcp-publish-chain.mjs --tenant <slug>
//        # the engine is property-parameterized. This repo ships knowing about
//        # exactly one property — its own. Any other chain is supplied at run time
//        # from a config file that lives OUTSIDE any public repo. See TENANTS below.
//   node scripts/reconcile-mcp-publish-chain.mjs --publish-intent
//        # run BEFORE a publish: additionally requires `npm whoami` to resolve AND
//        # to equal the expected owner. Unresolvable = FAIL.
//   node scripts/reconcile-mcp-publish-chain.mjs \
//        --surface-dir <id>=<path> ...   # offline, from fixtures
//   node scripts/reconcile-mcp-publish-chain.mjs --allow-uncertified-identity
//        # ONLY for offline fixture runs. A --surface-dir override on the npm
//        # surface means there is no registry metadata, so WHO published cannot be
//        # established. By default that is a blocking violation (a gate that skips
//        # on missing input is fail-open). This downgrades it to a loud advisory
//        # and marks the run NOT CERTIFIED. It can never mark an identity verified.
//
// THIS SCRIPT NEVER WRITES ANYTHING PUBLIC. It does not publish, version-bump,
// tag, or push. It only reads. Reconciling real drift requires a publish, and a
// publish is the operator's decision alone — so the remediation output tells you
// what it would take and stops there.

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");

// ── THE PROPERTY TABLE — one parameterized engine, not a forked copy ──────────
//
// Two properties running near-identical code is how a fix in one silently fails to
// reach the other. So the chain SHAPE and the identity contract are DATA, and the
// engine below contains no property literal at all — the red test asserts exactly
// that, by scanning the executable lines of this file.
//
// `surfaces` is an ORDERED chain from authoring source to what customers install.
// Its LENGTH is the topology — see TOPOLOGY IS PER-PROPERTY above. Surface kinds:
//
//   git   clone a remote at a ref. `dir` (optional) narrows to a subdirectory.
//   local a path on disk relative to this repo, for a monorepo authored copy.
//   npm   resolve the dist-tag and download the registry tarball. MUST be last —
//         it is the only surface that is what a customer actually installs, and
//         the end-to-end hop is defined as first -> last.
//
// Every identity value below was READ FROM THE REGISTRY on 2026-07-20 via
// `npm view <pkg> _npmUser maintainers`, never inferred from the package name.
const TENANTS = {
  twitterapis: {
    npmPkg: "@twitterapis/mcp",
    // ONE hop. This repo is both the authoring source and the publish source;
    // there is no mirror repo. Do not add one to "match" another property.
    surfaces: [
      { id: "repo", kind: "git", url: "https://github.com/TwitterAPIs/twitterapis-mcp.git", label: "REPO (authoring + publish source)" },
      { id: "npm", kind: "npm", label: "NPM (what customers install)" },
    ],
    // GitHub org casing is asymmetric: `TwitterAPIs` on GitHub, lowercase
    // everywhere else. Compared case-insensitively, but recorded as it really is.
    expectedPublishOrg: "TwitterAPIs",
    expectedNpmOwner: "twitterapis",
    expectedNpmOwnerEmail: "emma@twitterapis.com",
    gitAuthEnv: ["TWITTERAPIS_GH_PAT", "GITHUB_TOKEN"],
  },
};

// ── ANY OTHER PROPERTY'S CHAIN COMES FROM OUTSIDE THIS REPO ──────────────────
//
// This engine can reconcile any property's chain, and deliberately ships knowing
// exactly one: its own.
//
// This repository is PUBLIC. A table here enumerating sibling properties — their
// publish repos, their npm owners, their monorepo layout — would publish the
// association between them, which is the precise thing tenant isolation exists to
// prevent. It is the same mistake test/firewall.mjs already refuses to make by
// keeping its roster out of this repo, and the reasoning is identical: the
// configuration would leak more than the gate could ever catch.
//
// So another property's chain is supplied at run time from a config file that lives
// outside any public repo:
//
//   MCP_CHAIN_TENANT_CONFIG=/path/to/tenants.json \
//     node scripts/reconcile-mcp-publish-chain.mjs --tenant <slug>
//
// The file is a JSON object of the same shape as TENANTS above. THIS is what makes
// it one implementation rather than a copy per property: the same engine file, byte
// for byte, can live in every property's repo, and the only thing that differs is
// the single self-entry each one declares. A parity check on that file's hash is
// how the copies are kept honest — see PARITY in the PR description.
function loadExternalTenants() {
  const p = flagValue("--tenant-config", null) || process.env.MCP_CHAIN_TENANT_CONFIG;
  if (!p) return {};
  if (!existsSync(p)) {
    fail2(`--tenant-config ${p} does not exist. A config that was explicitly asked for and cannot be read is a FAIL, never an empty default — the alternative is silently reconciling nothing and calling it clean.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail2(`--tenant-config ${p} is not valid JSON (${e.message})`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail2(`--tenant-config ${p} must be a JSON object of {propertySlug: config}`);
  }
  return parsed;
}

// The tenant this repo IS. Read from the .tenant marker so a copy of this file in
// another repo cannot silently reconcile the wrong chain. Falls back to an
// explicit --tenant.
function defaultTenant() {
  const p = join(REPO, ".tenant");
  if (existsSync(p)) {
    const v = readFileSync(p, "utf8").trim();
    if (v) return v;
  }
  return null;
}

// package.json fields excluded from the blocking comparison. A DENYLIST — see
// WHAT IS COMPARED. Adding an entry here is a deliberate decision to stop
// comparing a consumer-facing field, and should be justified in a comment.
//
//   scripts — prepublishOnly / test wiring is build-time, not consumer-facing, and
//             legitimately differs between a repo and a published tarball.
//             Reported as an advisory instead.
const MANIFEST_EXCLUDED_FIELDS = new Set(["scripts"]);

// Env vars that disabled the sibling gate when it lived in a pre-commit hook. This
// gate never honoured them, but it names them if set so the habit cannot quietly
// become an expectation that they work here.
const RETIRED_ENV_BYPASSES = ["SKIP_MCP_PUBLISH_CHAIN"];

const MODES = new Set(["reconcile", "merge-path"]);

// /usr/bin/curl by ABSOLUTE PATH: a bare `curl` can resolve to a shell function or
// a wrapper, and a wrapper that quietly returns nothing would read as an empty
// tarball rather than as a failure to fetch — a false negative on the one surface
// customers actually install.
//
// MCP_CHAIN_CURL is a TEST SEAM and nothing else. Pinning the absolute path is what
// makes the download branch unreachable from a PATH stub, so the red test needs a
// way in to exercise the download/extract failure classes offline. It is never set
// in production, and it cannot suppress a finding — a stub that "succeeds" still
// has to produce a tarball the gate then hashes and compares.
const CURL_BIN = process.env.MCP_CHAIN_CURL || "/usr/bin/curl";

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const asJson = args.includes("--json");
function flagPath(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}
// Accepts both `--mode=x` and `--mode x`.
function flagValue(flag, fallback) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  return flagPath(flag, fallback);
}
// Repeatable READ-ONLY path override, one per surface: --surface-dir repo=/tmp/x
function surfaceDirOverrides() {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    let spec = null;
    if (args[i] === "--surface-dir") spec = args[i + 1];
    else if (args[i].startsWith("--surface-dir=")) spec = args[i].slice("--surface-dir=".length);
    if (!spec) continue;
    const eq = spec.indexOf("=");
    if (eq < 1) return { __error: `--surface-dir expects <surfaceId>=<path>, got "${spec}"` };
    out[spec.slice(0, eq)] = spec.slice(eq + 1);
  }
  return out;
}

const mode = flagValue("--mode", "reconcile");
const tenantName = flagValue("--tenant", null) || defaultTenant();
const overrides = surfaceDirOverrides();
// Override the FIRST surface of the chain without having to name its id.
// scripts/mcp-chain-reconcile.sh uses this to point the authoring surface at a
// pristine `git archive` of origin/main. It exists so that script does not have to
// carry a second, drifting copy of the chain shape — the TENANTS table stays the
// single source of truth for topology.
const headDirOverride = flagValue("--head-dir", null);
// READ-ONLY fixture registry metadata, so the red test can exercise the identity
// checks offline. Supplying it makes identity EVALUATED (and therefore failable);
// it can never suppress a finding.
const npmMetaOverride = flagPath("--npm-meta", null);
// A run that is about to be followed by an irreversible `npm publish`.
const publishIntent = args.includes("--publish-intent");
// Offline-fixture escape hatch. Downgrades "identity could not be established"
// from blocking to advisory. It NEVER certifies an identity — see USAGE.
const allowUncertifiedIdentity = args.includes("--allow-uncertified-identity");

const tempDirs = [];
function cleanup() {
  for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}
process.on("exit", cleanup);

// ── fail-closed helper ───────────────────────────────────────────────────────
// Exit 2 is reserved for "the gate could not establish ground truth". It is
// deliberately distinct from exit 1 (drift), because the two demand different
// responses: drift means fix the chain, exit 2 means fix the gate or the network.
function fail2(msg) {
  if (asJson) {
    console.log(JSON.stringify({ ok: false, exit: 2, reason: "gate-could-not-run", error: msg }, null, 2));
  } else {
    console.error(`\n  MCP PUBLISH-CHAIN GATE — COULD NOT RUN (exit 2, fail-closed)\n`);
    console.error(`    ${msg}\n`);
    console.error(`  A surface that cannot be read is a FAILURE, never a pass.\n`);
  }
  process.exit(2);
}

if (!MODES.has(mode)) fail2(`unknown --mode "${mode}". Valid modes: ${[...MODES].join(", ")}.`);
if (overrides.__error) fail2(overrides.__error);
if (!tenantName) {
  fail2(`no tenant could be determined. This repo has no .tenant marker and no --tenant was given. The gate will not guess which publish chain it is reconciling.`);
}
// In-repo self-entry first, then anything supplied from outside. An external config
// may ADD a property; it may not silently redefine this repo's own chain.
const EXTERNAL = loadExternalTenants();
for (const k of Object.keys(EXTERNAL)) {
  if (TENANTS[k]) {
    fail2(`the external tenant config redefines "${k}", which this repo declares itself. Refusing: an outside file must not be able to repoint this repo's own publish chain, or the gate can be pointed at a package it does not own.`);
  }
}
const ALL_TENANTS = { ...TENANTS, ...EXTERNAL };
const TENANT = ALL_TENANTS[tenantName];
if (!TENANT) {
  fail2(`unknown property "${tenantName}". Known: ${Object.keys(ALL_TENANTS).join(", ")}. A property must be declared in the TENANTS table (its own repo) or supplied via --tenant-config / MCP_CHAIN_TENANT_CONFIG, with its chain shape and its registry-read identity — it is never inferred from the package name.`);
}

// Structural assertions on the tenant declaration. A malformed chain must fail the
// gate, not silently produce zero hops (which would pass green over anything).
if (!Array.isArray(TENANT.surfaces) || TENANT.surfaces.length < 2) {
  fail2(`tenant "${tenantName}" declares ${TENANT.surfaces?.length ?? 0} surface(s). A publish chain needs at least 2 (an authoring source and the registry), or there is nothing to reconcile and a pass would be meaningless.`);
}
if (TENANT.surfaces[TENANT.surfaces.length - 1].kind !== "npm") {
  fail2(`tenant "${tenantName}" does not end its chain in an "npm" surface. The last surface must be what customers install, or the end-to-end hop measures the wrong thing.`);
}
if (TENANT.surfaces.filter((s) => s.kind === "npm").length !== 1) {
  fail2(`tenant "${tenantName}" declares ${TENANT.surfaces.filter((s) => s.kind === "npm").length} npm surfaces. Exactly one is required.`);
}
// --head-dir resolves against the declared chain, so the caller never needs to
// know the head surface's id. Applied AFTER the tenant is resolved.
if (headDirOverride) {
  const headId = TENANT.surfaces[0].id;
  if (overrides[headId] && overrides[headId] !== headDirOverride) {
    fail2(`--head-dir and --surface-dir ${headId}= were both given with different paths. Pick one; the gate will not guess which surface you meant.`);
  }
  overrides[headId] = headDirOverride;
}

// ── bypass accounting ────────────────────────────────────────────────────────
// Every bypass active on this run is collected here and NAMED in the output, on
// both the pass and the fail path. A run that was weakened must never be visually
// indistinguishable from a clean one.
const activeBypasses = [];
if (allowUncertifiedIdentity) {
  activeBypasses.push("--allow-uncertified-identity (publisher identity NOT verified on this run)");
}
const refusedBypasses = RETIRED_ENV_BYPASSES.filter((v) => {
  const val = process.env[v];
  return val !== undefined && val !== "" && val !== "0";
});

function sha(buf) { return createHash("sha256").update(buf).digest("hex"); }

// ── publish-set expansion ────────────────────────────────────────────────────
function readManifest(dir, label) {
  const p = join(dir, "package.json");
  if (!existsSync(p)) fail2(`${label}: no package.json at ${p}`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail2(`${label}: package.json at ${p} is not valid JSON (${e.message})`);
  }
}

function walk(dir, base, out) {
  for (const entry of readdirSync(dir)) {
    // A git clone carries .git/, which is not part of any publish set and is
    // large. Nothing else is filtered — exclusion is otherwise structural, via
    // each surface's own `files` array.
    if (entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, base, out);
    else if (st.isFile()) out.push(relative(base, full));
  }
  return out;
}

// Returns BOTH the expanded set and the entries that were listed but absent. A
// listed entry that does not exist is a REPORTED finding, not a silent drop: the
// per-file diff cannot catch it, because that diff iterates exactly the set the
// missing entry never entered.
function expandPublishSet(dir, filesArray, label) {
  const set = new Set(["package.json"]);
  const absent = [];
  for (const entry of filesArray) {
    const full = join(dir, entry);
    if (!existsSync(full)) { absent.push(entry); continue; }
    const st = statSync(full);
    if (st.isDirectory()) for (const f of walk(full, dir, [])) set.add(f);
    else set.add(entry);
  }
  if (set.size <= 1) {
    fail2(`${label}: expanded publish set is empty (only package.json). The \`files\` array is ${JSON.stringify(filesArray)} — parser broke or the surface is empty.`);
  }
  return { files: [...set].sort(), absent };
}

// Hash every file in the comparison set. A file absent on a given surface hashes
// to null, which the comparison reports as MISSING / only-on-downstream. Returns
// coverage counts so the caller can ASSERT them — a sweep that does not print and
// assert "scanned N of TOTAL" reports clean over an empty loop.
function hashSurface(dir, files) {
  const map = {};
  let hashed = 0;
  for (const f of files) {
    const full = join(dir, f);
    if (existsSync(full) && statSync(full).isFile()) {
      map[f] = sha(readFileSync(full));
      hashed++;
    } else {
      map[f] = null;
    }
  }
  return { map, hashed, total: files.length };
}

// Deterministic deep serialization: key order in a package.json must not be able
// to register as drift, but every VALUE at every depth must.
//
// NOTE: do NOT reach for `JSON.stringify(obj, keysArray)` here. An array replacer
// is a RECURSIVE property allowlist, not a top-level key filter — it strips any
// nested key not named in the array, so `dependencies: {zod: "^3.23.8"}` would
// serialize to `{}` and a dependency swap would hash identically. That exact bug
// shipped in the sibling's first draft and was caught only by its red test.
function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}

function manifestHash(manifest, alsoExclude = null) {
  const norm = {};
  for (const k of Object.keys(manifest).sort()) {
    if (MANIFEST_EXCLUDED_FIELDS.has(k)) continue;
    if (alsoExclude && alsoExclude.has(k)) continue;
    norm[k] = manifest[k];
  }
  return sha(Buffer.from(stableStringify(norm)));
}

// `version` lives INSIDE package.json, which is part of the compared content. So
// "the content differs" is true for a plain version bump, and a naive
// `contentDiffers && versionsEqual` / `!contentDiffers && versionsDiffer` pair
// makes the second branch DEAD CODE: !contentDiffers implies the package.json
// hashes match, which implies the versions match, so `versionsDiffer` can never
// hold there. The sibling implementation carries exactly that dead branch.
//
// The distinction that actually matters operationally is drift EXCLUDING the
// version field:
//
//   nonVersionDrift && sameVersion  -> SILENT-STALE. npm has frozen that version
//                                      against different bytes. Unshippable.
//   !nonVersionDrift && diffVersion -> a bump with no publish (or a publish with
//                                      no bump). Real publish debt, but NOT the
//                                      immutability violation, so it is reported
//                                      as its own kind rather than buried in a
//                                      generic content-drift line.
const VERSION_FIELD = new Set(["version"]);

function manifestFieldHashes(manifest) {
  const out = {};
  for (const k of Object.keys(manifest)) {
    if (MANIFEST_EXCLUDED_FIELDS.has(k)) continue;
    out[k] = sha(Buffer.from(stableStringify(manifest[k])));
  }
  return out;
}

// ── surface materialization ──────────────────────────────────────────────────

function materializeGit(surface) {
  const dest = mkdtempSync(join(tmpdir(), "mcp-chain-git-"));
  tempDirs.push(dest);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const gitArgs = ["clone", "--quiet", "--depth", "1"];
  // Optional auth so the gate also works if the repo is ever made private. Tokens
  // are passed as a one-shot header and NEVER written into a remote URL.
  let token = "";
  for (const name of TENANT.gitAuthEnv || []) {
    if (process.env[name]) { token = process.env[name]; break; }
  }
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    gitArgs.unshift("-c", `http.extraHeader=Authorization: Basic ${basic}`);
  }
  try {
    execFileSync("git", [...gitArgs, surface.url, dest], { env, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // A 404 on a private repo measures OUR ACCESS, not existence — say so, so a
    // wrong-org token is not misread as "the repo is gone".
    const err = (e.stderr?.toString() || e.message).trim();
    fail2(`could not clone ${surface.url}: ${err}\n    NOTE: a 404 here measures THIS MACHINE'S ACCESS, not whether the repo exists. A wrong-org token returns 404, not 403. Expected credential env: ${(TENANT.gitAuthEnv || []).join(" or ") || "(none)"}.`);
  }
  let ref = "(unknown)";
  try {
    ref = execFileSync("git", ["-C", dest, "log", "-1", "--format=%h %aI"], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  } catch { /* non-fatal: the tree is what matters */ }
  const dir = surface.dir ? join(dest, surface.dir) : dest;
  if (!existsSync(dir)) fail2(`${surface.label}: cloned ${surface.url} but subdirectory "${surface.dir}" does not exist in it`);
  return { dir, ref, origin: surface.url, meta: null, version: null };
}

function materializeLocal(surface) {
  const dir = join(REPO, surface.path);
  if (!existsSync(dir)) {
    fail2(`${surface.label}: local surface not found at ${dir}. This tenant declares a monorepo authoring copy at "${surface.path}" — either the path moved, or this gate is running outside the repo that holds it.`);
  }
  return { dir, ref: "(working tree)", origin: dir, meta: null, version: null };
}

// Resolved via `npm view` then downloaded straight from the registry tarball URL.
// Deliberately NOT `npm publish`/`npm version` — this gate has no write path to
// the registry at all, by construction.
function materializeNpm(surface) {
  let meta;
  try {
    const raw = execFileSync("npm", ["view", TENANT.npmPkg, "--json"], { stdio: ["ignore", "pipe", "pipe"], timeout: 60000 }).toString();
    if (!raw.trim()) {
      fail2(`\`npm view ${TENANT.npmPkg} --json\` returned an empty body. The registry answered but said nothing — treat as unreachable, never as "no package".`);
    }
    meta = JSON.parse(raw);
  } catch (e) {
    if (e?.code === "ENOENT") {
      fail2(`\`npm\` is not on PATH, so the published surface cannot be read. A gate that cannot look must not pass.`);
    }
    const err = (e.stderr?.toString() || e.message || "").trim();
    // A 404 is NOT "nothing to compare against" — it means the package customers
    // are told to install does not exist under that name. Fail loudly, and name
    // the distinction so it is not mistaken for a transient network fault.
    if (/E404|404 Not Found|is not in this registry/i.test(err)) {
      // NOTE: no tenant literal here. A scoped and an unscoped spelling of the
      // "same" package are DIFFERENT registry entries, and which one a tenant
      // uses is data in the TENANTS table, not a fact this message may assume.
      const scopedHint = TENANT.npmPkg.startsWith("@")
        ? `this tenant publishes the SCOPED name "${TENANT.npmPkg}"; the unscoped spelling is a different package and may legitimately 404`
        : `this tenant publishes the UNSCOPED name "${TENANT.npmPkg}"; a scoped spelling is a different package and may legitimately 404`;
      fail2(`the npm registry has no package named "${TENANT.npmPkg}" (E404). Either the package was unpublished/renamed, or this gate is pointed at the wrong name — ${scopedHint}. This is NOT an absence of drift — it is an absence of the artifact customers install: ${err}`);
    }
    fail2(`could not read npm metadata for ${TENANT.npmPkg}: ${err}`);
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    fail2(`npm metadata for ${TENANT.npmPkg} parsed to ${Array.isArray(meta) ? "an array" : typeof meta}, not an object. \`npm view\` returns an array when a spec matches multiple versions — the gate cannot tell which one customers install.`);
  }
  const version = meta["dist-tags"]?.latest || meta.version;
  if (!version) fail2(`npm metadata for ${TENANT.npmPkg} has no dist-tags.latest — cannot resolve what customers install`);
  const tarball = meta.dist?.tarball;
  if (!tarball) fail2(`npm metadata for ${TENANT.npmPkg}@${version} has no dist.tarball URL`);

  const dest = mkdtempSync(join(tmpdir(), "mcp-chain-npm-"));
  tempDirs.push(dest);
  const tgz = join(dest, "pkg.tgz");
  try {
    execFileSync(CURL_BIN, ["-fsSL", "--max-time", "120", "-o", tgz, tarball], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    fail2(`could not download the published tarball ${tarball}: ${(e.stderr?.toString() || e.message).trim()}`);
  }
  if (!existsSync(tgz) || statSync(tgz).size === 0) {
    fail2(`the downloaded tarball at ${tarball} is empty (0 bytes). An empty artifact is a failure to read the surface, not an empty publish set.`);
  }
  try {
    execFileSync("tar", ["xzf", tgz, "-C", dest], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    fail2(`could not extract the published tarball: ${(e.stderr?.toString() || e.message).trim()}`);
  }
  const inner = join(dest, "package");
  if (!existsSync(inner)) fail2(`extracted tarball has no package/ root at ${inner} — registry layout changed`);
  return { dir: inner, ref: `dist-tag latest`, origin: tarball, meta, version };
}

function materialize(surface) {
  const ov = overrides[surface.id];
  if (ov) {
    if (!existsSync(ov)) fail2(`--surface-dir ${surface.id}=${ov} does not exist`);
    // meta stays null unless fixture metadata is explicitly supplied. null means
    // "identity could not be established", which check 7 treats as a FAILURE.
    let meta = null;
    if (surface.kind === "npm" && npmMetaOverride) {
      if (!existsSync(npmMetaOverride)) fail2(`--npm-meta ${npmMetaOverride} does not exist`);
      try {
        meta = JSON.parse(readFileSync(npmMetaOverride, "utf8"));
      } catch (e) {
        fail2(`--npm-meta ${npmMetaOverride} is not valid JSON (${e.message})`);
      }
    }
    return { dir: ov, ref: "(local override)", origin: "(local override)", meta, version: null };
  }
  if (surface.kind === "git") return materializeGit(surface);
  if (surface.kind === "local") return materializeLocal(surface);
  if (surface.kind === "npm") return materializeNpm(surface);
  fail2(`tenant "${tenantName}" declares surface "${surface.id}" with unknown kind "${surface.kind}"`);
}

// ── publishing identity helpers ──────────────────────────────────────────────

// `npm view --json` and the raw registry packument disagree on shape:
//   npm view   → "twitterapis <emma@twitterapis.com>"    (string)
//   packument  → { name: "twitterapis", email: "..." }   (object)
// Both are accepted. Anything else returns null, and null is treated by the caller
// as a FAILURE to establish identity — never as "no objection".
function normalizeNpmIdentity(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const m = v.trim().match(/^([^<>\s]+)(?:\s*<([^>]*)>)?$/);
    if (!m) return null;
    return { name: m[1], email: (m[2] || "").trim() };
  }
  if (typeof v === "object" && typeof v.name === "string" && v.name.trim()) {
    return { name: v.name.trim(), email: typeof v.email === "string" ? v.email.trim() : "" };
  }
  return null;
}

// Parse a git/https remote into its OWNER segment.
//
// The owner is POSITIONAL, so it must be parsed positionally and compared EXACTLY.
// A substring test (`url.includes("/TwitterAPIs/")`) is satisfied from anywhere in
// the path, so https://github.com/attacker/TwitterAPIs/x would pass as "under the
// TwitterAPIs org" when the owner is `attacker`.
//
// Handles: https://host/owner/repo, git+https://…, git://…, ssh://git@host/o/r,
// and the scp-like git@host:owner/repo. Returns null if no owner can be
// established, which the caller treats as a FAIL.
function parseRepoOwner(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  const cleaned = rawUrl.trim().replace(/^git\+/i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  let m = cleaned.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/]+)\/([^/]+)\/([^/]+)/i);
  if (m) return { host: m[1], owner: m[2], repo: m[3] };
  m = cleaned.match(/^(?:[^@\s]+@)?([^:/\s]+):([^/\s]+)\/([^/\s]+)$/);
  if (m) return { host: m[1], owner: m[2], repo: m[3] };
  return null;
}

// Read-only. Never publishes, never writes npm config. A failure to resolve
// returns null, and the caller decides whether null is fatal (it is, under
// --publish-intent).
function resolveNpmWhoami() {
  try {
    const out = execFileSync("npm", ["whoami"], { stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

// ── comparison ───────────────────────────────────────────────────────────────
function compare(hopName, from, to, fromHashes, toHashes, files) {
  const diffs = [];
  for (const f of files) {
    const a = fromHashes[f];
    const b = toHashes[f];
    if (a === null && b === null) continue;
    if (a === null) diffs.push({ hop: hopName, file: f, kind: "only-on-downstream", detail: `present on ${to}, absent on ${from}` });
    else if (b === null) diffs.push({ hop: hopName, file: f, kind: "missing-downstream", detail: `present on ${from}, MISSING on ${to}` });
    else if (a !== b) diffs.push({ hop: hopName, file: f, kind: "content-drift", detail: `${from}=${a.slice(0, 12)} ${to}=${b.slice(0, 12)}` });
  }
  return diffs;
}

function main() {
  const mergePath = mode === "merge-path";
  const chain = TENANT.surfaces;
  const npmIdx = chain.length - 1;

  // ── materialize every surface ──────────────────────────────────────────────
  const S = chain.map((surface) => {
    const got = materialize(surface);
    const mf = readManifest(got.dir, surface.label);
    return { surface, ...got, mf };
  });

  // The upstream-most surface is the authoring source; assert it is the package
  // this gate thinks it is reconciling before comparing anything.
  const head = S[0];
  if (head.mf.name !== TENANT.npmPkg) {
    fail2(`${head.surface.label} package name is "${head.mf.name}" but tenant "${tenantName}" reconciles "${TENANT.npmPkg}". Either the package was renamed (update the TENANTS table) or the wrong surface was passed. Note that a scoped and an unscoped name are DIFFERENT packages.`);
  }

  // Every non-npm surface must declare its own `files` array, so its publish set is
  // enumerated INDEPENDENTLY. Deriving the file list from one surface is exactly
  // the blind spot that makes a downstream-only file invisible.
  for (const s of S) {
    if (s.surface.kind === "npm") continue;
    if (!Array.isArray(s.mf.files)) {
      fail2(`${s.surface.label} package.json has no \`files\` array — its publish set cannot be enumerated independently, and an upstream-only file list is exactly the blind spot this gate exists to close`);
    }
    s.exp = expandPublishSet(s.dir, s.mf.files, s.surface.label);
  }
  // The npm surface's publish set is not declared, it is OBSERVED: whatever is
  // actually in the tarball.
  S[npmIdx].actual = walk(S[npmIdx].dir, S[npmIdx].dir, []).sort();
  S[npmIdx].exp = { files: S[npmIdx].actual, absent: [] };

  // ── THE UNION — every surface enumerated independently ─────────────────────
  const files = [...new Set(S.flatMap((s) => s.exp.files))].sort();
  if (files.length === 0) {
    fail2(`the union publish set is EMPTY across all ${S.length} surfaces. Nothing was compared, so a pass would be meaningless.`);
  }

  for (const s of S) {
    const h = hashSurface(s.dir, files);
    s.hashes = h.map;
    s.cov = h;
  }

  // ── COVERAGE ASSERTION (scanned N of TOTAL) ────────────────────────────────
  // A sweep that does not assert its own coverage reports clean over an empty
  // loop. Every surface must have produced an entry for every file in the union —
  // present or explicitly absent — or the gate did not actually look.
  for (const s of S) {
    if (s.cov.total !== files.length || Object.keys(s.hashes).length !== files.length) {
      fail2(`${s.surface.label}: coverage assertion failed — the union has ${files.length} file(s) but this surface produced ${Object.keys(s.hashes).length} result(s) over ${s.cov.total}. The sweep did not cover what it claimed to.`);
    }
  }

  // package.json compares on the normalized consumer-facing subset (denylist).
  for (const s of S) s.hashes["package.json"] = manifestHash(s.mf);

  const violations = [];
  const warnings = [];
  // merge-path mode: content drift is EXPECTED (the PR is the fix) and cannot be
  // reconciled inside CI, because reconciling requires a publish. Recorded as debt.
  const publishDebt = [];

  // ── listed-but-absent ──────────────────────────────────────────────────────
  for (const s of S) {
    for (const entry of s.exp.absent) {
      violations.push({
        hop: "publish-set", file: entry, kind: "listed-but-absent",
        detail: `${s.surface.label}: the package.json \`files\` array lists "${entry}", but nothing exists at that path. npm would ship a publish set smaller than the one declared, and the per-file diff cannot catch it because the entry never enters the file list at all.`,
      });
    }
  }

  // ── checks 1..n — THE HOPS, derived from the declared chain ────────────────
  // Adjacent hops, plus the end-to-end hop when the chain is longer than 2 (for a
  // 2-surface chain the end-to-end hop IS the adjacent hop; emitting it twice
  // would double-count every finding).
  const hops = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const from = S[i], to = S[i + 1];
    hops.push({
      name: `${String.fromCharCode(65 + i)} ${from.surface.id}->${to.surface.id}`,
      endToEnd: false,
      findings: compare(`${String.fromCharCode(65 + i)} ${from.surface.id}->${to.surface.id}`, from.surface.id, to.surface.id, from.hashes, to.hashes, files),
    });
  }
  if (chain.length > 2) {
    const from = S[0], to = S[npmIdx];
    const name = `${String.fromCharCode(65 + chain.length - 1)} ${from.surface.id}->${to.surface.id}`;
    hops.push({
      name, endToEnd: true,
      findings: compare(name, from.surface.id, to.surface.id, from.hashes, to.hashes, files),
    });
  }
  // The hop customers actually feel is always first -> npm, whether that is an
  // adjacent hop (2 surfaces) or the derived end-to-end one (3+).
  const endToEndFindings = chain.length > 2
    ? hops[hops.length - 1].findings
    : hops[0].findings;

  const hopFindings = hops.flatMap((h) => h.findings);
  if (mergePath) publishDebt.push(...hopFindings);
  else violations.push(...hopFindings);

  // ── check 4 — THE VERSION TRAP ─────────────────────────────────────────────
  // Same version string + different bytes is the state every cheaper check
  // misreports as healthy. Called out separately and loudly.
  //
  // This is ALSO the one blocking check in merge-path mode, and the reason that
  // mode is satisfiable: the PR author cannot publish from CI, but they can bump
  // the version, and until they do the change is literally unshippable (npm
  // immutability means the published version can never carry different bytes).
  const aV = head.mf.version;
  const nV = S[npmIdx].mf.version;
  // Drift on the end-to-end hop, IGNORING the version field — see VERSION_FIELD.
  // A version bump alone must not read as stale bytes, and stale bytes must not
  // be excused by a bump.
  const nonVersionDrift = endToEndFindings.some((f) => {
    if (f.file !== "package.json") return true;
    return manifestHash(head.mf, VERSION_FIELD) !== manifestHash(S[npmIdx].mf, VERSION_FIELD);
  });
  let silentStale = false;
  if (nonVersionDrift && aV === nV) {
    silentStale = true;
    violations.push({
      hop: "version-coherence",
      file: "package.json",
      kind: "SILENT-STALE",
      detail:
        `${head.surface.id} and npm are BOTH version ${aV} but their contents differ. ` +
        `Consumers on ${nV} cannot tell they are running stale code, and any version-based ` +
        `check reports parity over live drift. A publish REQUIRES a version bump.` +
        (mergePath
          ? ` In merge-path mode this is the BLOCKING finding: bump package.json in this PR. The content drift itself is expected and is reported as publish debt.`
          : ""),
    });
  }
  // The other half of the pair, and the one that was dead code in the sibling.
  // Content is identical apart from the version string: someone bumped and never
  // published, or published and never bumped. Real publish debt — reported as its
  // own kind so an operator can tell it apart at a glance from stale bytes — but
  // NOT the npm-immutability violation, so it does not carry SILENT-STALE's
  // severity.
  let unpublishedBump = false;
  if (!nonVersionDrift && aV !== nV) {
    unpublishedBump = true;
    const detail =
      `content is identical across all ${S.length} surfaces apart from the version string ` +
      `(${S.map((s) => `${s.surface.id} ${s.mf.version}`).join(" / ")}). A bump was made without a publish, ` +
      `or a publish without a bump. Nothing is stale for consumers today, but the chain is not settled.`;
    if (mergePath) {
      // On a PR this is the normal, correct state: the author bumped, and the
      // publish happens after merge. Never block it.
      publishDebt.push({ hop: "version-coherence", file: "package.json", kind: "unpublished-version-bump", detail });
    } else {
      violations.push({ hop: "version-coherence", file: "package.json", kind: "unpublished-version-bump", detail });
    }
    warnings.push(`version-only delta: ${detail}`);
  }

  // ── check 5 — publish-set shape ────────────────────────────────────────────
  // A file present downstream that the authoring surface does not account for
  // means the published artifact ships something this repo is not tracking.
  const shapeFindings = [];
  for (let i = 1; i < S.length; i++) {
    for (const f of S[i].exp.files.filter((f) => !head.exp.files.includes(f))) {
      shapeFindings.push({
        hop: "publish-set", file: f,
        kind: i === npmIdx ? "untracked-in-tarball" : "untracked-downstream",
        detail: `${S[i].surface.label} ships this file in its publish set, but ${head.surface.label}'s \`files\` set does not account for it — it exists only downstream, and would never have been enumerated by an upstream-only file list`,
      });
    }
  }
  if (mergePath) publishDebt.push(...shapeFindings);
  else violations.push(...shapeFindings);

  // ── which manifest field drifted (reporting aid, not a separate check) ─────
  const manifestFieldDrift = [];
  {
    const aF = manifestFieldHashes(head.mf);
    const nF = manifestFieldHashes(S[npmIdx].mf);
    for (const k of [...new Set([...Object.keys(aF), ...Object.keys(nF)])].sort()) {
      if (aF[k] !== nF[k]) {
        manifestFieldDrift.push(`${k} (${aF[k] === undefined ? `absent on ${head.surface.id}` : nF[k] === undefined ? "absent on npm" : "differs"})`);
      }
    }
  }

  // ── check 6 — TENANT ISOLATION on the declared publish origin ──────────────
  // NOTE: repository.url is a CLAIM — the publisher writes it. It is checked for
  // shape here, but it is check 7 (registry-controlled _npmUser/maintainers) that
  // establishes identity. Do not treat a green check 6 as proof of who published.
  const npmMf = S[npmIdx].mf;
  const repoUrl = typeof npmMf.repository === "string" ? npmMf.repository : npmMf.repository?.url || "";
  if (!repoUrl) {
    violations.push({ hop: "tenant-isolation", file: "package.json", kind: "no-repository-url", detail: "the published package declares no repository.url, so the publish origin cannot be verified" });
  } else {
    const parsed = parseRepoOwner(repoUrl);
    if (!parsed) {
      violations.push({
        hop: "tenant-isolation", file: "package.json", kind: "unparseable-repository-url",
        detail: `published repository.url "${repoUrl}" could not be parsed into an owner/repo pair, so the publish origin cannot be verified`,
      });
    } else if (parsed.owner.toLowerCase() !== TENANT.expectedPublishOrg.toLowerCase()) {
      // EXACT owner comparison, positional. See parseRepoOwner.
      violations.push({
        hop: "tenant-isolation", file: "package.json", kind: "unexpected-publish-org",
        detail: `published repository.url is ${repoUrl}, whose owner segment is "${parsed.owner}", not the expected publish org "${TENANT.expectedPublishOrg}"`,
      });
    }
  }

  // ── check 9 — TENANT-ISOLATION FIREWALL on the PUBLISHED artifact ──────────
  // test/firewall.mjs scans what `npm pack` WOULD upload. This scans what ALREADY
  // SHIPPED. Those are different questions, and only this one is about the artifact
  // customers already have: a local pre-publish scan cannot retract a breach that is
  // live on the registry, and anything published before that scan existed was never
  // checked at all.
  //
  // DELEGATED, not reimplemented. This file carries no roster — see TENANT ISOLATION
  // in the header. The registry owns the token list, the matching semantics, and the
  // per-property carve-outs, so this gate and every other enforcement point cannot
  // drift apart. A registry that cannot be located is a FAIL, never a skip: "the
  // scanner is missing" is exactly the state in which a breach ships unnoticed.
  const firewall = { scanned: S[npmIdx].actual.length, delegatedTo: null, ok: false };
  {
    const scanner = process.env.TENANT_ISOLATION_SCAN
      || join(process.env.HOME || "", ".claude", "scripts", "tenant-isolation-scan.py");
    firewall.delegatedTo = scanner;
    if (!existsSync(scanner)) {
      fail2(
        `tenant-isolation registry not found at ${scanner}. Set TENANT_ISOLATION_SCAN to its path.\n` +
        `    A missing gate input is a FAIL, never an "n/a" — this gate must not certify a published\n` +
        `    artifact from a machine that cannot check it for foreign-property identity.`,
      );
    }
    if (firewall.scanned === 0) {
      fail2(`tenant-isolation firewall: the published tarball contains ZERO files. Nothing would be scanned, so a pass would be meaningless.`);
    }
    // Hand it the EXTRACTED PUBLISHED TARBALL — the bytes customers actually have,
    // not the working tree and not what `npm pack` would produce today.
    const run = spawnSync(
      process.env.PYTHON || "python3",
      [scanner, "--tenant", tenantName, "--path", S[npmIdx].dir],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (run.error) {
      fail2(`could not run the tenant-isolation registry (${run.error.message}). A firewall that cannot execute is not a passing firewall.`);
    }
    firewall.output = (run.stdout || "").trim();
    if (run.status === 0) {
      firewall.ok = true;
    } else {
      violations.push({
        hop: "tenant-isolation-firewall", file: `(published tarball ${TENANT.npmPkg}@${nV})`,
        kind: "FOREIGN-IDENTITY-PUBLISHED",
        detail:
          `the isolation registry exited ${run.status} against the PUBLISHED tarball — a foreign-property ` +
          `identity is present in the artifact customers already install. This is live and a local ` +
          `pre-publish scan cannot retract it. Registry output:\n${(run.stdout || run.stderr || "").trim()}`,
      });
    }
  }

  // ── check 7 — PUBLISHING IDENTITY (authoritative, registry-controlled) ─────
  // `_npmUser` and `maintainers` are set by the registry from the publishing
  // token. Unlike repository.url they cannot be forged by whoever ran publish.
  const identity = {
    certified: false,
    expectedOwner: TENANT.expectedNpmOwner,
    npmUser: null,
    maintainers: [],
    whoami: null,
    publishIntent,
  };
  const npmMeta = S[npmIdx].meta;

  if (!npmMeta) {
    // The override path: no registry metadata exists, so WHO published this cannot
    // be established at all. Missing input is a FAIL, never "n/a" — a gate that
    // skips on missing input is the exact fail-open this gate exists to prevent.
    const detail =
      `no registry metadata is available (running against a --surface-dir fixture), so the publishing ` +
      `identity could NOT be established. Content parity says the bytes match; it says nothing about who published them.`;
    if (allowUncertifiedIdentity) {
      warnings.push(`PUBLISH IDENTITY NOT CERTIFIED — ${detail} Explicitly acknowledged via --allow-uncertified-identity. This run proves NOTHING about publisher identity.`);
    } else {
      violations.push({ hop: "publish-identity", file: "(registry metadata)", kind: "IDENTITY-NOT-CERTIFIED", detail });
    }
  } else {
    const npmUser = normalizeNpmIdentity(npmMeta._npmUser);
    identity.npmUser = npmUser ? `${npmUser.name}${npmUser.email ? ` <${npmUser.email}>` : ""}` : null;

    if (!npmUser) {
      violations.push({
        hop: "publish-identity", file: "(registry metadata)", kind: "IDENTITY-UNREADABLE",
        detail: `registry metadata carries no readable _npmUser (raw value: ${JSON.stringify(npmMeta._npmUser)}). The last publisher cannot be established, so identity is NOT certified.`,
      });
    } else if (npmUser.name.toLowerCase() !== TENANT.expectedNpmOwner.toLowerCase()) {
      violations.push({
        hop: "publish-identity", file: "(registry metadata)", kind: "WRONG-PUBLISHER",
        detail: `the published version was last published by npm user "${npmUser.name}", not the expected owner "${TENANT.expectedNpmOwner}". A correct repository.url does NOT make this safe — that field is publisher-written, this one is registry-controlled.`,
      });
    } else if (TENANT.expectedNpmOwnerEmail && npmUser.email && npmUser.email.toLowerCase() !== TENANT.expectedNpmOwnerEmail.toLowerCase()) {
      violations.push({
        hop: "publish-identity", file: "(registry metadata)", kind: "WRONG-PUBLISHER-EMAIL",
        detail: `publisher "${npmUser.name}" resolves to account email "${npmUser.email}", not the expected "${TENANT.expectedNpmOwnerEmail}"`,
      });
    }

    // Every maintainer must be the expected owner. An extra maintainer is a
    // standing ability to publish, which is the same exposure as a bad publish
    // that simply has not happened yet.
    const rawMaintainers = Array.isArray(npmMeta.maintainers) ? npmMeta.maintainers : null;
    if (!rawMaintainers || rawMaintainers.length === 0) {
      violations.push({
        hop: "publish-identity", file: "(registry metadata)", kind: "NO-MAINTAINERS",
        detail: `registry metadata carries no maintainers array, so who is permitted to publish cannot be established`,
      });
    } else {
      for (const raw of rawMaintainers) {
        const m = normalizeNpmIdentity(raw);
        if (!m) {
          violations.push({
            hop: "publish-identity", file: "(registry metadata)", kind: "MAINTAINER-UNREADABLE",
            detail: `a maintainers[] entry could not be parsed (raw value: ${JSON.stringify(raw)}), so the maintainer set cannot be verified`,
          });
          continue;
        }
        identity.maintainers.push(`${m.name}${m.email ? ` <${m.email}>` : ""}`);
        if (m.name.toLowerCase() !== TENANT.expectedNpmOwner.toLowerCase()) {
          violations.push({
            hop: "publish-identity", file: "(registry metadata)", kind: "UNEXPECTED-MAINTAINER",
            detail: `npm user "${m.name}" is a maintainer of ${TENANT.npmPkg} but is not the expected owner "${TENANT.expectedNpmOwner}". Any maintainer can publish at any time.`,
          });
        }
      }
    }
  }

  // ── check 8 — npm whoami, BEFORE the irreversible step ─────────────────────
  // A publish goes out as whoever the machine is logged in as. Comparing that up
  // front is the only check in this file that can PREVENT a bad publish rather
  // than report one after the registry has already cached it.
  const whoami = resolveNpmWhoami();
  identity.whoami = whoami;
  if (!whoami) {
    const detail =
      `\`npm whoami\` could not resolve an identity (no npm token configured for this shell). ` +
      `A publish from here would go out as whatever account is authenticated at that moment.`;
    if (publishIntent) {
      violations.push({ hop: "publish-identity", file: "(npm whoami)", kind: "WHOAMI-UNRESOLVED", detail });
    } else {
      warnings.push(`${detail} Not blocking without --publish-intent, but re-run with --publish-intent before any publish.`);
    }
  } else if (whoami.toLowerCase() !== TENANT.expectedNpmOwner.toLowerCase()) {
    // A resolved mismatch is unambiguous and blocking whether or not a publish was
    // declared — there is no reading of this that is safe.
    violations.push({
      hop: "publish-identity", file: "(npm whoami)", kind: "WHOAMI-MISMATCH",
      detail: `this shell is authenticated to npm as "${whoami}", but ${TENANT.npmPkg} must be published by "${TENANT.expectedNpmOwner}". Publishing from here would stamp the wrong identity on a public ${tenantName} artifact — and a publish is irreversible.`,
    });
  }

  identity.certified = !!npmMeta && violations.filter((v) => v.hop === "publish-identity").length === 0;

  // ── advisory — scripts delta (non-blocking by design) ──────────────────────
  const aScripts = stableStringify(head.mf.scripts || {});
  const nScripts = stableStringify(npmMf.scripts || {});
  if (aScripts !== nScripts) {
    warnings.push(`package.json \`scripts\` differ between ${head.surface.id} and published (build-time only, not consumer-facing — excluded from the blocking comparison on purpose)`);
  }

  const failed = violations.length > 0;
  const exit = failed ? 1 : 0;

  if (asJson) {
    console.log(JSON.stringify({
      ok: !failed, exit, mode, tenant: tenantName,
      topology: { surfaces: chain.length, hops: hops.length, chain: chain.map((c) => c.id) },
      surfaces: S.map((s) => ({ id: s.surface.id, kind: s.surface.kind, origin: s.origin, ref: s.ref, version: s.mf.version })),
      publishSet: files,
      coverage: {
        union: files.length,
        ...Object.fromEntries(S.map((s) => [s.surface.id, { hashed: s.cov.hashed, total: s.cov.total }])),
      },
      firewall: { scanned: firewall.scanned, delegatedTo: firewall.delegatedTo, ok: firewall.ok },
      silentStale, unpublishedBump, identity,
      bypasses: { active: activeBypasses, refused: refusedBypasses },
      manifestFieldDrift,
      violations, warnings, publishDebt,
    }, null, 2));
    process.exit(exit);
  }

  const line = "─".repeat(78);
  console.log(`\n${line}`);
  console.log(`  MCP PUBLISH-CHAIN PARITY  —  tenant: ${tenantName}`);
  console.log(`  chain: ${chain.map((c) => c.id).join(" → ")}   (${chain.length} surfaces, ${hops.length} hop${hops.length === 1 ? "" : "s"})`);
  console.log(`  mode: ${mode}${mergePath ? "  (content drift = publish debt, SILENT-STALE = blocking)" : "  (everything blocking)"}`);
  console.log(line);
  S.forEach((s, i) => {
    console.log(`  (${i + 1}) ${s.surface.id.padEnd(9)}: ${s.origin}  v${s.mf.version}  ${s.ref}`);
  });
  console.log(`  publish set    : ${files.length} file(s) — ${files.join(", ")}`);
  // scanned N of TOTAL, printed AND asserted above.
  console.log(`  coverage       : union ${files.length} | ${S.map((s) => `${s.surface.id} ${s.cov.hashed}/${files.length}`).join(" · ")} hashed`);
  console.log(`                   (enumerated independently: ${S.map((s) => `${s.surface.id} ${s.exp.files.length}`).join(", ")})`);
  console.log(`  firewall       : ${firewall.ok ? "CLEAN" : "VIOLATION"} over ${firewall.scanned} published file(s) — delegated to ${firewall.delegatedTo}`);
  console.log(line);

  // Bypasses are named on EVERY run, before the findings, so a weakened run can
  // never be visually mistaken for a clean one.
  if (activeBypasses.length || refusedBypasses.length) {
    console.log(`\n  BYPASSES`);
    for (const b of activeBypasses) console.log(`    ACTIVE   ${b}`);
    for (const b of refusedBypasses) {
      console.log(`    REFUSED  ${b} is set, and is not honoured by this gate.`);
      console.log(`             It disabled the sibling gate in its pre-commit era; an env var`);
      console.log(`             must not be able to silence CI.`);
    }
  }

  const show = (title, rows, fmt) => {
    console.log(`\n  ${title}  (${rows.length})`);
    if (rows.length === 0) { console.log("    (none)"); return; }
    for (const r of rows) console.log(`    ${fmt(r)}`);
  };
  const fmtV = (v) => `[${v.hop}] ${v.file} — ${v.kind}: ${v.detail}`;

  for (const h of hops) {
    const suffix = (h.endToEnd || chain.length === 2) ? "  (what customers actually feel)" : "";
    show(`hop ${h.name}${suffix}`, h.findings, fmtV);
  }

  const hopNames = new Set(hops.map((h) => h.name));
  const structural = violations.filter((v) => !hopNames.has(v.hop) && v.hop !== "publish-identity" && v.hop !== "tenant-isolation-firewall");
  show("structural  [version coherence · publish set · tenant isolation]", structural, fmtV);

  const fwViolations = violations.filter((v) => v.hop === "tenant-isolation-firewall");
  show("tenant-isolation firewall  [foreign identity in the PUBLISHED artifact]", fwViolations, fmtV);

  if (manifestFieldDrift.length) {
    console.log(`\n  manifest fields differing ${head.surface.id} vs npm  (${manifestFieldDrift.length})`);
    for (const f of manifestFieldDrift) console.log(`    ${f}`);
  }

  const identityViolations = violations.filter((v) => v.hop === "publish-identity");
  show("publish identity  [WHO published — registry-controlled, not publisher-written]", identityViolations, fmtV);
  console.log(`      expected owner : ${TENANT.expectedNpmOwner} <${TENANT.expectedNpmOwnerEmail}>`);
  console.log(`      npm _npmUser   : ${identity.npmUser ?? "(not established)"}`);
  console.log(`      maintainers    : ${identity.maintainers.length ? identity.maintainers.join(", ") : "(not established)"}`);
  console.log(`      npm whoami     : ${identity.whoami ?? "(unresolved)"}${publishIntent ? "  [--publish-intent: required]" : ""}`);
  console.log(`      STATUS         : ${identity.certified ? "CERTIFIED" : "NOT CERTIFIED"}`);

  if (mergePath) {
    show("PUBLISH DEBT  [expected on a PR — reconciling requires an operator publish]", publishDebt, fmtV);
  }

  show("WARN advisory  [non-blocking]", warnings, (w) => w);

  console.log(`\n${line}`);
  if (failed) {
    console.log(`  RESULT: FAIL (exit 1) — ${violations.length} finding(s) across the publish chain\n`);
    if (silentStale) {
      console.log(`  !! SILENT-STALE: ${head.surface.id} and npm are both v${aV} with DIFFERENT contents.`);
      console.log(`     Every version-based check reads GREEN on this. That is the fail-open.\n`);
    }
    if (mergePath) {
      console.log(`  MERGE-PATH REMEDIATION (the PR author can do this, in this PR):`);
      console.log(`    bump the version in package.json. The content drift above is publish debt`);
      console.log(`    and is EXPECTED — it is reconciled by an operator publish after this lands,`);
      console.log(`    not by CI. What is blocked is shipping bytes under a version string npm has`);
      console.log(`    already frozen against different bytes.\n`);
    } else {
      console.log(`  REMEDIATION (all of it is operator-gated — this gate will not do any of it):`);
      let step = 1;
      if (chain.length > 2) {
        console.log(`    ${step++}. mirror the authoring publish set into ${chain[1].url}`);
      }
      console.log(`    ${step++}. bump the version in package.json (a republish of an identical version`);
      console.log(`       is impossible; npm immutability means the only way to ship this is a new one)`);
      console.log(`    ${step++}. publish as ${TENANT.expectedNpmOwner} — confirm with \`npm whoami\` first, or`);
      console.log(`       re-run this gate with --publish-intent, which makes that check blocking.`);
      console.log(`\n    Publishing is irreversible once the registry caches it, so these are the`);
      console.log(`    operator's call alone. This gate only reports.\n`);
    }
  } else {
    console.log(`  RESULT: PASS (exit 0) — ${chain.length} surfaces reconciled across ${hops.length} publish hop${hops.length === 1 ? "" : "s"}` +
      (warnings.length ? `, ${warnings.length} advisory warning(s)` : ", full parity") +
      (mergePath && publishDebt.length ? `, ${publishDebt.length} publish-debt item(s)` : ""));
    // Never let a content-parity pass be read as an identity pass.
    if (!identity.certified) {
      console.log(`  NOTE: publish identity is NOT CERTIFIED on this run — content matched, but`);
      console.log(`        WHO published it was not established. This is not a publish authorization.`);
    }
    if (activeBypasses.length) {
      console.log(`  NOTE: this run passed with ${activeBypasses.length} bypass(es) ACTIVE (listed above).`);
      console.log(`        It is not equivalent to a clean run.`);
    }
    console.log(`${line}\n`);
  }
  process.exit(exit);
}

main();
