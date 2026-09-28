#!/usr/bin/env node
// snapshot-redaction.mjs: test/openapi.snapshot.json must carry every
// secret-shaped EXAMPLE value in its redacted form.
//
// scripts/openapi-refresh.mjs redacts those values at vendoring time, but a
// snapshot copied in by hand (cp of the docs openapi.json) skips that step and
// nothing else noticed: npm test stayed green with a canned webhook signing
// secret back in the file (caught in review, 2026-09-28). This reads the
// vendored file and fails on any unredacted value, so the redaction holds no
// matter how the snapshot arrived.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = process.argv[2] || resolve(HERE, "openapi.snapshot.json");
const MARKER = "[example value redacted at vendoring time, see scripts/openapi-refresh.mjs]";
// Keep in step with EXAMPLE_SECRET_KEYS in scripts/openapi-refresh.mjs.
const KEYS = new Set(["secret", "token", "password", "api_key", "apikey", "auth_token", "ct0"]);

const leaks = [];
let checked = 0;
function walk(node, path) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "example" && v && typeof v === "object" && !Array.isArray(v)) {
      for (const [ek, ev] of Object.entries(v)) {
        if (KEYS.has(ek.toLowerCase()) && typeof ev === "string") {
          checked += 1;
          if (ev !== MARKER) leaks.push(`${path}.example.${ek}`);
        }
      }
    }
    walk(v, `${path}.${k}`);
  }
}

walk(JSON.parse(readFileSync(SNAPSHOT, "utf8")), "$");

if (checked === 0) {
  console.error("\x1b[31m✗ snapshot-redaction: found no secret-shaped example keys at all; the walker cannot see the file it was pointed at\x1b[0m");
  process.exit(1);
}
if (leaks.length) {
  console.error(`\x1b[31m✗ snapshot-redaction: ${leaks.length} of ${checked} secret-shaped example value(s) are not redacted:\x1b[0m`);
  for (const l of leaks) console.error(`    ${l}`);
  console.error("  Re-vendor through scripts/openapi-refresh.mjs, never a raw copy.");
  process.exit(1);
}
console.log(`\x1b[32m✓ snapshot-redaction: ${checked} of ${checked} secret-shaped example value(s) redacted\x1b[0m`);
