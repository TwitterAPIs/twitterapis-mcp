// body-mode-parity.mjs — the cross-repo gate for `jsonBody`.
//
// Run: node test/body-mode-parity.mjs   (wired into `npm test`)
//
// ── WHY THIS EXISTS (task #2206) ────────────────────────────────────────────
// On 2026-08-16 FIVE write tools shipped with `jsonBody` unset. They sent every
// argument as a query string against backend routes that read only the request
// body, so every call returned 400 "Provide `<field>` in the JSON body". They
// had been failing 100% of calls for an unknown period.
//
// Nothing automated could catch it. Each repo was internally consistent: the
// tool schemas were valid, the backend was correct, `openapi-parity` passed
// because the PATHS all matched. The disagreement existed only in a fact
// neither repo held on its own — HOW the handler reads its parameters. It was
// found by a human tracing a request shape into a second checkout.
//
// ── WHY THE FACT COMES FROM THE BACKEND ─────────────────────────────────────
// The body-read mode is a property of the handler, and handlers live in
// twitterapis-backend. This repo cannot derive it without parsing that
// codebase, which would put a second copy of that logic in a repo that cannot
// test it. So the backend EMITS scripts/route-body-modes.json and this gate
// consumes it. One producer, one artifact.
//
// ── SKIPS LOUDLY, NEVER SILENTLY ────────────────────────────────────────────
// The manifest lives in a sibling checkout, so it is not always present (a
// fresh clone, a CI box with only this repo). A missing manifest reports
// SKIPPED in plain sight and exits 0, because failing every clone that lacks a
// second checkout would get this gate deleted. What it must never do is print
// nothing and pass, which would be indistinguishable from a real green.
import { TOOLS } from "../src/tools.js";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Same resolution order the twitterapis-website repo uses for its own
// cross-repo backend checks (TWITTERAPIS_BACKEND_DIR, then a sibling), plus the
// workspace layout this estate actually uses.
const CANDIDATES = [
  process.env.TWITTERAPIS_BACKEND_DIR,
  resolve(HERE, "..", "..", "twitterapis-backend"),
  resolve(HERE, "..", "..", "..", "products", "twitterapis-backend"),
].filter(Boolean);

const MANIFEST_REL = "scraper/scripts/route-body-modes.json";

function findManifest() {
  for (const base of CANDIDATES) {
    const p = resolve(base, MANIFEST_REL);
    if (existsSync(p)) return p;
  }
  return null;
}

// ── PROVENANCE OF THE INPUT, AND WHY THIS CHECK EXISTS ──────────────────────
// This gate reads a file out of ANOTHER REPO'S WORKING TREE. That tree can be
// dirty, or ahead of its remote, and if it is then the verdict printed here
// describes state that exists on ONE developer's disk and nowhere else.
//
// That is not hypothetical, it is how this gate was first shipped. On
// 2026-08-16 the backend's classifier fix sat UNCOMMITTED while this consumer
// was merged. It passed locally against the corrected manifest; anyone reading
// the committed state would have seen it fail with eight violations on
// favorite/retweet/follow. The gate could not tell, because a file on disk looks
// identical whether or not anyone else can see it.
//
// So the gate now reports the PROVENANCE of its own input. It warns rather than
// fails, deliberately: editing the backend and running these tests is ordinary
// local development, and a gate that fails on that gets switched off. What it
// must never do is print a clean verdict while silently describing uncommitted
// state.
//
// The git env is STRIPPED before shelling out. Every git hook exports GIT_DIR,
// which is absolute repo discovery, so `git -C <other-repo>` would read THIS
// repo instead and report the wrong tree's status -- passing standalone and
// lying under a hook, which is the one environment that matters.
const INHERITED_GIT_ENV = [
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
];

function manifestProvenance(repoDir, relPath) {
  const env = { ...process.env };
  for (const k of INHERITED_GIT_ENV) delete env[k];
  const git = (args) =>
    execFileSync("git", ["-C", repoDir, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    // Probe first, then assert: confirm this really is a git repo before
    // reading anything into a claim about it.
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { known: false, reason: "not a git checkout" };
  }
  let dirty = false;
  let ahead = null;
  try {
    dirty = git(["status", "--porcelain", "--", relPath]).length > 0;
  } catch {
    return { known: false, reason: "git status failed" };
  }
  try {
    // How many commits touching this file are local-only. Empty output is zero.
    const out = git(["log", "--oneline", "origin/main..HEAD", "--", relPath]);
    ahead = out ? out.split("\n").filter(Boolean).length : 0;
  } catch {
    ahead = null; // no remote ref locally; reported as unknown rather than zero
  }
  return { known: true, dirty, ahead };
}

// The two repos spell path parameters differently: this repo uses the OpenAPI
// form `{id}`, the backend router uses Hono's `:id`. Normalising is required,
// and getting it wrong would silently drop every parameterised route out of the
// comparison — a gate that checks less than it appears to.
const toRouterPath = (p) => String(p).replace(/\{([^}]+)\}/g, ":$1");

function main() {
  const manifestPath = findManifest();
  if (!manifestPath) {
    console.log(
      "  \x1b[33m~ body-mode-parity: SKIPPED — no twitterapis-backend checkout found\x1b[0m",
    );
    console.log(
      "    Looked in: " + CANDIDATES.join(", "),
    );
    console.log(
      "    This gate compares each write tool's jsonBody against what the backend route",
    );
    console.log(
      "    actually reads. It did NOT run, so nothing here was verified. Set",
    );
    console.log("    TWITTERAPIS_BACKEND_DIR to enable it.");
    return;
  }

  // Report where this input came from BEFORE reporting any verdict about it.
  const backendRoot = manifestPath.slice(0, -(MANIFEST_REL.length + 1));
  const prov = manifestProvenance(backendRoot, MANIFEST_REL);
  if (!prov.known) {
    console.log(
      `  \x1b[33m~ manifest provenance UNKNOWN (${prov.reason}) — cannot tell whether this input is committed\x1b[0m`,
    );
  } else if (prov.dirty || (prov.ahead ?? 0) > 0) {
    console.log(
      "  \x1b[33m~ WARNING: this verdict is about UNCOMMITTED or UNPUSHED backend state\x1b[0m",
    );
    if (prov.dirty) console.log("      the manifest has uncommitted changes in the backend working tree");
    if ((prov.ahead ?? 0) > 0)
      console.log(`      ${prov.ahead} local commit(s) touch it that are not on origin/main`);
    console.log(
      "      Anyone reading the committed state may get a DIFFERENT result. Commit and push",
    );
    console.log(
      "      the backend manifest before trusting this, or before merging anything that relies on it.",
    );
    console.log(
      "      (This exact gap shipped a green gate on 2026-08-16 that failed for everyone else.)",
    );
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const routes = manifest.routes || {};
  if (Object.keys(routes).length === 0) {
    console.error("  \x1b[31m✗ body-mode-parity: the manifest declares ZERO routes\x1b[0m");
    console.error("    An empty manifest would pass every tool trivially. Treating as broken.");
    process.exit(1);
  }

  const writes = TOOLS.filter((t) => t.method && String(t.method).toUpperCase() !== "GET");
  if (writes.length === 0) {
    console.error("  \x1b[31m✗ body-mode-parity: found ZERO write tools — instrument failure\x1b[0m");
    process.exit(1);
  }

  const problems = [];
  const notInManifest = [];
  const cannotAssert = [];
  let asserted = 0;

  for (const t of writes) {
    const key = `${String(t.method).toUpperCase()} ${toRouterPath(t.path)}`;
    const entry = routes[key];
    if (!entry) {
      // A write tool pointing at a path the backend does not serve as a write
      // route. Either the tool is wrong or the manifest is stale; both need a
      // human, so neither is silently tolerated.
      notInManifest.push(`${t.name} -> ${key}`);
      continue;
    }
    if (entry.mode === "json-only") {
      asserted++;
      if (t.jsonBody !== true) {
        problems.push(
          `${t.name} calls ${key}, whose handler (${entry.handler}) reads the BODY ONLY, ` +
            `but the tool does not set jsonBody: true. Every call will send args as a query ` +
            `string and fail with 400. Fix in scripts/tools.overrides.mjs, then npm run build.`,
        );
      }
    } else if (entry.mode === "unknown") {
      cannotAssert.push(`${t.name} -> ${key} (${entry.handler})`);
    }
  }

  for (const n of cannotAssert) {
    console.log(`  \x1b[33m~ cannot assert: ${n}\x1b[0m`);
  }
  if (cannotAssert.length > 0) {
    console.log(
      "    The backend manifest could not classify how these handlers read params.",
    );
    console.log(
      "    'unknown' means the generator did not RECOGNISE the reader, never that the",
    );
    console.log("    route takes no body. Not a pass and not a failure: unverified.");
  }

  if (notInManifest.length > 0 || problems.length > 0) {
    console.error("");
    for (const n of notInManifest) {
      console.error(`  \x1b[31m✗ write tool has no matching backend write route: ${n}\x1b[0m`);
    }
    for (const p of problems) console.error(`  \x1b[31m✗ ${p}\x1b[0m`);
    console.error(
      `\n  \x1b[31m✗ body-mode-parity: ${problems.length + notInManifest.length} disagreement(s) ` +
        `between MCP tools and the backend's route body modes\x1b[0m`,
    );
    process.exit(1);
  }

  console.log(
    `  \x1b[32m✓ body-mode-parity: ${asserted} tool(s) on body-only routes all set jsonBody; ` +
      `${writes.length} write tool(s) checked against ${Object.keys(routes).length} backend routes\x1b[0m`,
  );
  console.log(`    manifest: ${manifestPath}`);
}

try {
  main();
} catch (e) {
  console.error(`  \x1b[31m✗ body-mode-parity gate error: ${e.message}\x1b[0m`);
  process.exit(1);
}
