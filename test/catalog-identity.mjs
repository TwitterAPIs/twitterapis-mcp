#!/usr/bin/env node
// catalog-identity.mjs: the catalog is what an MCP client sees, and this gate
// pins it.
//
// test/catalog.baseline.json is the frozen fingerprint of the 51 hand-written
// tools as they shipped in 0.6.3, taken before src/tools.js became a generated
// file. This gate rebuilds the fingerprint from the CURRENT catalog and requires
// an exact match, per tool:
//
//   name · REST path · HTTP method · write / destructive / jsonBody flags ·
//   tool description · arg names AND their order · which args are required ·
//   each arg's JSON Schema type, numeric bounds, string bounds, enum members,
//   and its full description text
//
// So it is not only "the same 51 tools exist". It is "every byte a model reads
// when deciding whether and how to call a tool is unchanged". That is the
// property the move to a generated catalog had to preserve, and this is the
// instrument that proves it rather than asserting it.
//
// Ongoing, it is the regression gate over the generator: an edit to
// scripts/tools.overrides.mjs that quietly drops an arg, flips a required flag,
// or loses a description fails here.
//
// When a change to the catalog is DELIBERATE (a new tool, a corrected
// description), regenerate the baseline in the same commit and let the diff be
// reviewed:
//   node test/catalog-identity.mjs --update-baseline
//
// Run: node test/catalog-identity.mjs   (wired into `npm test`)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../src/tools.js";
import { fingerprintCatalog } from "../scripts/catalog-fingerprint.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = resolve(HERE, "catalog.baseline.json");

const current = fingerprintCatalog(TOOLS);

if (process.argv.includes("--update-baseline")) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`  wrote test/catalog.baseline.json, ${current.toolCount} tools. Review the diff before committing.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("  \x1b[31m✗ catalog-identity: no test/catalog.baseline.json. A missing gate input is a failure, not a skip.\x1b[0m");
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));

const problems = [];
const j = (v) => JSON.stringify(v);

// Same tools, same advertised order.
const baseNames = baseline.order || [];
const curNames = current.order;
for (const n of baseNames) if (!curNames.includes(n)) problems.push(`tool ${n} is in the baseline but GONE from the catalog`);
for (const n of curNames) if (!baseNames.includes(n)) problems.push(`tool ${n} is in the catalog but NOT in the baseline (new tool? update the baseline in the same commit)`);
if (j(baseNames) === j(curNames)) {
  // order identical, nothing to say
} else if (j([...baseNames].sort()) === j([...curNames].sort())) {
  problems.push(`the tool SET matches but the advertised ORDER changed: baseline ${j(baseNames)} vs catalog ${j(curNames)}`);
}

const SCALARS = ["path", "method", "write", "destructive", "jsonBody", "description"];

for (const name of baseNames) {
  const b = baseline.tools[name];
  const c = current.tools[name];
  if (!b || !c) continue; // already reported above

  for (const k of SCALARS) {
    if (j(b[k]) !== j(c[k])) problems.push(`${name}: ${k} changed\n      baseline: ${j(b[k])}\n      catalog:  ${j(c[k])}`);
  }

  if (j(b.args) !== j(c.args)) {
    const lost = b.args.filter((a) => !c.args.includes(a));
    const gained = c.args.filter((a) => !b.args.includes(a));
    const detail = lost.length || gained.length
      ? `${lost.length ? `dropped ${j(lost)}` : ""}${lost.length && gained.length ? ", " : ""}${gained.length ? `added ${j(gained)}` : ""}`
      : "same args, different order";
    problems.push(`${name}: arg list changed (${detail})\n      baseline: ${j(b.args)}\n      catalog:  ${j(c.args)}`);
  }

  if (j(b.required) !== j(c.required)) {
    problems.push(`${name}: required args changed\n      baseline: ${j(b.required)}\n      catalog:  ${j(c.required)}`);
  }

  // Per-arg schema, so a lost description or a widened bound is named precisely
  // rather than dumped as one unreadable object diff.
  const bp = b.inputSchema?.properties || {};
  const cp = c.inputSchema?.properties || {};
  for (const arg of Object.keys(bp)) {
    if (!(arg in cp)) continue; // covered by the arg-list diff
    if (j(bp[arg]) !== j(cp[arg])) {
      problems.push(`${name}.${arg}: schema changed\n      baseline: ${j(bp[arg])}\n      catalog:  ${j(cp[arg])}`);
    }
  }
}

console.log(`  catalog-identity: ${current.toolCount} tools vs ${baseline.toolCount} baseline`);
if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`  \x1b[31m✗ ${p}\x1b[0m`);
  console.error(
    `\n  \x1b[31m✗ catalog-identity: ${problems.length} difference(s) from the frozen catalog.\x1b[0m\n` +
      `    Every one of these changes what a model is told about a tool. If a change is\n` +
      `    intended, run \`node test/catalog-identity.mjs --update-baseline\` in the SAME\n` +
      `    commit so the diff is reviewable.`,
  );
  process.exit(1);
}
console.log(`  \x1b[32m✓ catalog-identity: byte-identical to the frozen 0.6.3 catalog (names, paths, methods, flags, args, required-ness, types, bounds, descriptions)\x1b[0m`);
