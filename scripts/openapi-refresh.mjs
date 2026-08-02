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

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(HERE, "..", "test", "openapi.snapshot.json");
const SPEC_URL = process.env.OPENAPI_URL || "https://docs.twitterapis.com/openapi.json";
const ALLOW_REMOVALS = process.argv.includes("--allow-removals");

const die = (msg) => {
  console.error(`\x1b[31m✗ openapi-refresh: ${msg}\x1b[0m`);
  process.exit(1);
};

const routeSet = (spec) => {
  const s = new Set();
  for (const [p, ops] of Object.entries(spec.paths || {})) {
    for (const m of Object.keys(ops)) if (m === "get" || m === "post") s.add(`${m.toUpperCase()} ${p}`);
  }
  return s;
};

const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(30000) }).catch((e) =>
  die(`cannot reach ${SPEC_URL}: ${e.message}`),
);
if (!res.ok) die(`${SPEC_URL} returned HTTP ${res.status}`);

let next;
try {
  next = JSON.parse(await res.text());
} catch (e) {
  die(`${SPEC_URL} did not return JSON: ${e.message}`);
}
if (!next.openapi || !next.paths) die("payload has no openapi/paths keys, refusing to vendor it");

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
