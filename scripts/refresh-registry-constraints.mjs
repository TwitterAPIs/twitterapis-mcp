#!/usr/bin/env node
// refresh-registry-constraints.mjs — regenerate the PINNED registry-schema
// constraints, and (with --check) report DRIFT between the pin and the live schema.
//
// WHY A PIN AND NOT A LIVE FETCH
// -----------------------------------------------------------------------------
// test/registry-manifests.mjs used to hardcode `MAX = {description: 100, title:
// 100, name: 200}`. Two problems, both found on 2026-09-06:
//
//   INCOMPLETE. The live schema constrains FOUR fields, not three, and carries
//   minLengths the hardcoded map had no notion of. A name below 3 characters or
//   a title at 101 passed a length-only cap on the fields it happened to know.
//
//   UNSOURCED. The limit was a number in a file. When the registry changes a
//   bound, nothing tells you, and the gate keeps enforcing a value that used to
//   be true. That is the same drift class the gate itself exists to prevent.
//
// The fix is NOT to fetch the schema at gate time. THE PIN BLOCKS; THE LIVE
// SCHEMA ONLY REPORTS DRIFT. A gate that adopts whatever it fetches has stopped
// being a claim about anything, and fetching at publish time is one network blip
// from either a false block or, worse, a fail-open depending on which way it
// defaults. So the pinned JSON is the enforcing copy, and this script is the only
// thing that writes it.
//
// If live disagrees with the pin, --check FAILS rather than updating. A human
// regenerates deliberately, which is what makes the pin evidence rather than a
// cache. Design credit: a peer session on the sibling API product built and
// red-tested this shape first; this is a port, not a reinvention.
//
// The schema URL is read from server.json's own `$schema` field, never written
// here, so bumping $schema is the only edit needed and there is no second copy
// of the URL to drift.
//
// Usage:
//   node scripts/refresh-registry-constraints.mjs           regenerate the pin
//   node scripts/refresh-registry-constraints.mjs --check   fail on pin/live drift
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SERVER = resolve(ROOT, "server.json");
const PIN = resolve(ROOT, "test/registry-schema-constraints.json");
const KEYS = ["minLength", "maxLength", "pattern"];

const server = JSON.parse(readFileSync(SERVER, "utf8"));
const schemaUrl = server.$schema;
if (!schemaUrl) {
  console.error("server.json has no $schema field; cannot source constraints");
  process.exit(2);
}

async function liveConstraints() {
  const res = await fetch(schemaUrl);
  if (!res.ok) throw new Error(`schema fetch returned HTTP ${res.status}`);
  const schema = await res.json();
  const defs = schema.$defs ?? schema.definitions ?? {};
  const sd = defs.ServerDetail ?? defs.Server;
  if (!sd) throw new Error("could not locate ServerDetail in the schema");
  const props = sd.properties ?? {};
  const fields = {};
  for (const [k, v] of Object.entries(props)) {
    const picked = {};
    for (const x of KEYS) if (x in v) picked[x] = v[x];
    if (Object.keys(picked).length) fields[k] = picked;
  }
  return { required: sd.required ?? [], fields };
}

const mode = process.argv[2];

let live;
try {
  live = await liveConstraints();
} catch (e) {
  if (mode === "--check") {
    // A fetch failure is NOT drift and must never be reported as one. It is also
    // not a pass: say which it is. The PIN still governs, so publishing is safe.
    console.error(
      `⚠ registry-constraints: could not read the live schema (${e.message}). ` +
        `This is NOT drift and NOT a clean check. The pin still governs.`,
    );
    process.exit(3);
  }
  console.error(`refresh failed: ${e.message}`);
  process.exit(2);
}

if (mode === "--check") {
  const pin = JSON.parse(readFileSync(PIN, "utf8"));
  const diffs = [];
  const names = new Set([...Object.keys(pin.fields ?? {}), ...Object.keys(live.fields)]);
  for (const n of names) {
    const a = JSON.stringify(pin.fields?.[n] ?? null);
    const b = JSON.stringify(live.fields[n] ?? null);
    if (a !== b) diffs.push(`  ${n}: pinned ${a} vs live ${b}`);
  }
  const ra = JSON.stringify([...(pin.required ?? [])].sort());
  const rb = JSON.stringify([...live.required].sort());
  if (ra !== rb) diffs.push(`  required: pinned ${ra} vs live ${rb}`);

  if (diffs.length) {
    console.error(
      "✗ registry-constraints: the PIN and the LIVE schema disagree.\n" +
        diffs.join("\n") +
        "\n\nThis BLOCKS rather than adopting the live value, because a gate that " +
        "\nupdates itself to match whatever it finds has stopped being a claim " +
        "\nabout anything. Review the change, then regenerate deliberately:" +
        "\n  node scripts/refresh-registry-constraints.mjs",
    );
    process.exit(1);
  }
  console.log(
    `✓ registry-constraints: pin matches the live schema ` +
      `(${Object.keys(live.fields).length} constrained field(s), ` +
      `${live.required.length} required)`,
  );
  process.exit(0);
}

const out = {
  _why:
    "PINNED constraints extracted from the schema server.json DECLARES in its own " +
    "$schema field. The PIN is what the gate enforces; the live schema is compared " +
    "against it only to report DRIFT, and a disagreement BLOCKS rather than silently " +
    "adopting the new bound. A gate that updates itself to match whatever it finds " +
    "has stopped being a claim about anything, and a network failure at publish time " +
    "must never be able to widen a limit.",
  _regenerate: "node scripts/refresh-registry-constraints.mjs",
  _source_schema: schemaUrl,
  _generated_at: new Date().toISOString().slice(0, 10),
  required: live.required,
  fields: live.fields,
};
writeFileSync(PIN, JSON.stringify(out, null, 2) + "\n");
console.log(
  `✓ pinned ${Object.keys(live.fields).length} constrained field(s) from ${schemaUrl}`,
);
