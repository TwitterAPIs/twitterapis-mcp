#!/usr/bin/env node
// Refresh the vendored openapi snapshot from the published spec.
//
// The snapshot at test/openapi.snapshot.json is the BUILD-TIME source of truth
// for the tool catalog (see scripts/gen-tools.mjs). Vendoring it is deliberate:
// the catalog that ships to users must be reproducible from the repository
// alone, with no network call at install time and no network call at server
// boot. An MCP server that fetches its own tool manifest at runtime hands its
// entire tool surface to whoever controls that hostname, and hands its users a
// dead server the day the hostname stops answering. This package never does
// that.
//
// So refreshing is an explicit, reviewed step: run this, read the diff it
// prints, update scripts/tools.overrides.mjs for anything new, then run
// `npm run build`.
//
// Run: npm run openapi:refresh   [-- --allow-removals]
//
// Fail-closed. A refresh is REFUSED when:
//   - the fetch does not return 200, or the body is not JSON
//   - the payload has no openapi/paths keys (a login wall or an error page)
//   - the new spec drops endpoints the current snapshot has, unless
//     --allow-removals is passed. A silently shrinking spec would silently
//     delete tools, which is the one failure mode a refresh must never have.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEAD_PATHS } from "./openapi-lead.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(HERE, "..", "test", "openapi.snapshot.json");
const SPEC_URL = process.env.OPENAPI_URL || "https://docs.twitterapis.com/openapi.json";
const ALLOW_REMOVALS = process.argv.includes("--allow-removals");

const die = (msg) => {
  console.error(`\x1b[31m✗ openapi-refresh: ${msg}\x1b[0m`);
  process.exit(1);
};

// The published docs illustrate a few responses with a canned example secret
// (e.g. POST /webhook's response shows a fake HMAC signing secret next to a
// fake webhook id, so a reader sees the SHAPE of what they'll get back). That
// pair is real-looking-but-fake documentation prose, never read by anything in
// this repo (gen-tools.mjs only reads .parameters and .requestBody.schema, and
// asserted so in its own tests), but it is INDISTINGUISHABLE, to a generic
// scanner, from an actual identity+secret pair someone accidentally committed.
// Redact known secret-shaped example VALUES at vendoring time so the snapshot
// never carries content that reads as a live credential, while leaving every
// field this repo actually consumes (parameters, requestBody schemas, response
// schemas) untouched. Applied recursively so it survives wherever the docs
// nest an example.
const EXAMPLE_SECRET_KEYS = new Set(["secret", "token", "password", "api_key", "apikey", "auth_token", "ct0"]);
function redactExampleSecrets(node) {
  if (Array.isArray(node)) {
    for (const v of node) redactExampleSecrets(v);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "example" && v && typeof v === "object" && !Array.isArray(v)) {
        for (const ek of Object.keys(v)) {
          if (EXAMPLE_SECRET_KEYS.has(ek.toLowerCase()) && typeof v[ek] === "string") {
            v[ek] = "[example value redacted at vendoring time, see scripts/openapi-refresh.mjs]";
          }
        }
      }
      redactExampleSecrets(v);
    }
  }
}

const routeSet = (spec) => {
  const s = new Set();
  for (const [p, ops] of Object.entries(spec.paths || {})) {
    // get/post/delete match gen-tools.mjs's METHODS set: this is a diff-display
    // helper only (the full spec is always vendored as-is below), but a route
    // silently missing from the printed diff reads as "nothing changed" for a
    // method this generator does not yet recognize, same failure class as
    // gen-tools.mjs skipping it outright.
    for (const m of Object.keys(ops)) if (m === "get" || m === "post" || m === "delete") s.add(`${m.toUpperCase()} ${p}`);
  }
  return s;
};

// OPENAPI_FILE reads the spec from a local file instead of the live docs site, so a
// cross-repo batch (docs spec change + MCP release) can be built and reviewed in ONE
// pass from the docs branch, rather than waiting for the docs deploy before the MCP
// can even be built (2026-11-09: that wait serialized a 4-repo batch). The same
// fail-closed checks below apply to either source. Publish only after the docs PR
// that produced the file has merged, so the live spec matches what was vendored.
const SPEC_FILE = process.env.OPENAPI_FILE || "";
const SOURCE = SPEC_FILE || SPEC_URL;
let raw;
if (SPEC_FILE) {
  try {
    raw = readFileSync(SPEC_FILE, "utf8");
  } catch (e) {
    die(`cannot read ${SPEC_FILE}: ${e.message}`);
  }
} else {
  const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(30000) }).catch((e) =>
    die(`cannot reach ${SPEC_URL}: ${e.message}`),
  );
  if (!res.ok) die(`${SPEC_URL} returned HTTP ${res.status}`);
  raw = await res.text();
}

let next;
try {
  next = JSON.parse(raw);
} catch (e) {
  die(`${SOURCE} did not return JSON: ${e.message}`);
}
if (!next.openapi || !next.paths) die("payload has no openapi/paths keys, refusing to vendor it");

redactExampleSecrets(next);

// Paths this package knows better than the docs spec today (scripts/openapi-lead.mjs).
// The vendored copy wins, so a refresh neither reports a live route as dropped nor
// walks back a corrected price. A pin only ever replaces one path's entry.
if (existsSync(SNAPSHOT)) {
  const prevPaths = JSON.parse(readFileSync(SNAPSHOT, "utf8")).paths || {};
  for (const p of LEAD_PATHS) {
    if (!prevPaths[p]) die(`LEAD_PATHS names ${p}, which the snapshot does not carry`);
    console.log(`  lead: keeping the vendored ${p}${next.paths[p] ? " over the docs spec's entry" : " (not in the docs spec yet)"}`);
    next.paths[p] = prevPaths[p];
  }
}

const nextRoutes = routeSet(next);
if (nextRoutes.size === 0) die("payload declares zero GET/POST routes");

if (existsSync(SNAPSHOT)) {
  const prevRoutes = routeSet(JSON.parse(readFileSync(SNAPSHOT, "utf8")));
  const added = [...nextRoutes].filter((r) => !prevRoutes.has(r)).sort();
  const removed = [...prevRoutes].filter((r) => !nextRoutes.has(r)).sort();
  console.log(`  routes: ${prevRoutes.size} vendored -> ${nextRoutes.size} live`);
  for (const r of added) console.log(`    + ${r}`);
  for (const r of removed) console.log(`    - ${r}`);
  if (removed.length && !ALLOW_REMOVALS) {
    die(
      `the live spec DROPS ${removed.length} route(s) the snapshot has. ` +
        "Confirm the retirement is real, then re-run with --allow-removals.",
    );
  }
} else {
  console.log(`  no existing snapshot; vendoring ${nextRoutes.size} routes`);
}

// Stable 2-space formatting so a future refresh produces a readable diff rather
// than one 400KB line.
writeFileSync(SNAPSHOT, JSON.stringify(next, null, 2) + "\n");
console.log(`\x1b[32m✓ openapi-refresh: vendored ${nextRoutes.size} routes to test/openapi.snapshot.json\x1b[0m`);
console.log("  next: update scripts/tools.overrides.mjs for any new route, then `npm run build`.");
