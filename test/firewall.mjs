#!/usr/bin/env node
// Publish firewall: no cross-property or competitor identity may ship inside the
// npm package. This scans the ACTUAL packed tarball (what `npm publish` uploads),
// not the source tree, because `files` / `.npmignore` decide what really ships.
//
// Fail-closed by design:
//   - a pack failure, an empty file list, or an unreadable entry is a FAILURE, never a skip
//   - matching uses bare case-insensitive substrings, never \b word boundaries
//     (\bforkoff\b would miss "officialForkoff")
//
// Run: node test/firewall.mjs   (wired into `npm test`)

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const BANNED = ["forkoff", "getxapi", "redditapis", "simba", "bozad", "emma"];
const PATTERN = new RegExp(BANNED.join("|"), "gi");

// A file may be exempted only with an explicit, reviewed reason. Empty by design.
const EXEMPT = new Set([]);

function fail(msg) {
  console.error(`\x1b[31m✗ firewall: ${msg}\x1b[0m`);
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const work = mkdtempSync(join(tmpdir(), "twitterapis-mcp-firewall-"));
let violations = 0;
let scanned = 0;
let total = 0;

try {
  // 1. Pack exactly what publish would upload.
  let tarball;
  try {
    const out = execFileSync(
      "npm",
      ["pack", "--pack-destination", work, "--json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    tarball = join(work, JSON.parse(out)[0].filename);
  } catch (err) {
    fail(`npm pack failed, cannot verify what would ship: ${err.message}`);
  }

  // 2. Extract it.
  const extracted = join(work, "x");
  execFileSync("mkdir", ["-p", extracted]);
  execFileSync("tar", ["xzf", tarball, "-C", extracted]);

  const files = walk(extracted);
  total = files.length;
  if (total === 0) fail("packed tarball contained 0 files (a sweep over 0 items reports clean)");

  // 3. Scan every entry with bare case-insensitive substrings.
  for (const file of files) {
    const rel = relative(join(extracted, "package"), file);
    scanned++;
    if (EXEMPT.has(rel)) {
      console.log(`  exempt: ${rel}`);
      continue;
    }
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (err) {
      fail(`could not read packed entry ${rel}: ${err.message}`);
    }
    const hits = text.match(PATTERN);
    if (hits) {
      violations++;
      const uniq = [...new Set(hits.map((h) => h.toLowerCase()))].join(", ");
      console.error(`  \x1b[31mVIOLATION\x1b[0m ${rel} -> ${uniq}`);
      for (const [i, line] of text.split("\n").entries()) {
        if (PATTERN.test(line)) console.error(`      line ${i + 1}: ${line.trim().slice(0, 160)}`);
        PATTERN.lastIndex = 0;
      }
    }
  }

  console.log(`  firewall: scanned ${scanned} of ${total} packed files, ${violations} violation(s)`);
  if (violations > 0) {
    fail(`${violations} file(s) carry a banned identity. Remove it, do not exempt it.`);
  }
  console.log("\x1b[32m✓ firewall: packed tarball carries no cross-property identity\x1b[0m");
} finally {
  rmSync(work, { recursive: true, force: true });
}
