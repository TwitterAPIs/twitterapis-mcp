#!/usr/bin/env node
// gen-manifest-tools.mjs — populate manifest.json's `tools` array from
// src/tools.js, so an MCPB bundle carries a static tool catalog.
//
// WHY THIS EXISTS. Smithery's stdio-scan model changed after the Arcade.dev
// acquisition (2026-08-05): it no longer spawns an uploaded .mcpb bundle to
// enumerate tools/list live. Reproduced directly 2026-09-04: a fresh publish
// of this exact bundle scored "45/100" with "No capabilities found / We
// couldn't list capabilities for this server", even though the server itself
// answers tools/list correctly with 98 tools when run locally with no API key
// (the 2026-08-18 lazy-validation fix already covers that half). The MCPB
// manifest schema (mcpb-manifest-v0.3) has a `tools` field for exactly this:
// a static {name, description} list a host or registry can read without
// running the server, plus a `tools_generated` flag saying whether it was
// derived from the code (true) or hand-typed (false, and therefore drift-prone).
//
// Usage:
//   node scripts/gen-manifest-tools.mjs --write   regenerate manifest.json's
//                                                  tools field (npm run build)
//   node scripts/gen-manifest-tools.mjs --check   fail if manifest.json's
//                                                  tools field is stale or
//                                                  missing (npm test)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../src/tools.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MANIFEST_PATH = resolve(ROOT, "manifest.json");

const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  console.error("Usage: gen-manifest-tools.mjs --write|--check");
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

const generatedTools = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
}));

// Rebuild the object in schema-conventional key order (documented fields
// first, `tools`/`tools_generated` right after `server`, matching the MCPB
// manifest schema's own property order) rather than letting `tools` land
// wherever JS insertion order happens to put it.
const ORDER = [
  "$schema",
  "dxt_version",
  "manifest_version",
  "name",
  "display_name",
  "version",
  "icon",
  "icons",
  "screenshots",
  "description",
  "long_description",
  "author",
  "repository",
  "homepage",
  "documentation",
  "support",
  "license",
  "keywords",
  "localization",
  "server",
  "tools",
  "tools_generated",
  "prompts",
  "prompts_generated",
  "privacy_policies",
  "user_config",
  "compatibility",
  "_meta",
];

const next = { ...manifest, tools: generatedTools, tools_generated: true };
const ordered = {};
for (const k of ORDER) {
  if (k in next) ordered[k] = next[k];
}
for (const k of Object.keys(next)) {
  if (!(k in ordered)) ordered[k] = next[k];
}

const nextText = JSON.stringify(ordered, null, 2) + "\n";
const currentText = readFileSync(MANIFEST_PATH, "utf8");

if (mode === "--check") {
  if (nextText !== currentText) {
    console.error(
      "manifest.json's tools field is stale: it does not match src/tools.js. " +
        "Run `node scripts/gen-manifest-tools.mjs --write` (or `npm run build`).",
    );
    process.exit(1);
  }
  console.log(
    `✓ gen-manifest-tools: manifest.json tools field matches src/tools.js (${generatedTools.length} tools)`,
  );
  process.exit(0);
}

writeFileSync(MANIFEST_PATH, nextText);
console.log(`✓ manifest.json: wrote ${generatedTools.length} tools from src/tools.js`);
