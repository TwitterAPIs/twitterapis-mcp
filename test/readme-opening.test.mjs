#!/usr/bin/env node
// readme-opening.test.mjs: the first paragraph of README.md is the text that
// Glama, mcpservers.org, the MCP Registry and npm copy word for word into their
// listings, so it is a published surface in its own right. This gate holds it
// to four facts read from the shipped package, never from another document:
//
//   1. the opening names the package as published (package.json "name") and is
//      short enough to be copied whole (listings take about the first 120 words);
//   2. the "Website:" line under it is the same URL server.json advertises as
//      websiteUrl, so a listing and the registry never point at two pages;
//   3. every "<N> tools" claim anywhere in the README equals the live catalog
//      (src/tools.js), so a count cannot drift from the router again;
//   4. the version is one number across package.json, server.json (top level and
//      the npm package entry) and manifest.json.
//
// Run: node test/readme-opening.test.mjs   (wired into `npm test`)

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../src/tools.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(resolve(ROOT, f), "utf8");
const readme = read("README.md");
const pkg = JSON.parse(read("package.json"));
const server = JSON.parse(read("server.json"));
const manifest = JSON.parse(read("manifest.json"));
const problems = [];

// The opening is the first paragraph after the H1 and the badge lines.
const blocks = readme.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const opening = blocks.find((b) => !b.startsWith("#") && !b.startsWith("[!["));
if (!opening) {
  problems.push("README.md has no opening paragraph after the H1 and badges");
} else {
  if (!opening.startsWith(`${pkg.name} is the official MCP server`)) {
    problems.push(`the opening must start with "${pkg.name} is the official MCP server", got: ${opening.slice(0, 80)}`);
  }
  const words = opening.split(/\s+/).length;
  if (words > 130) problems.push(`the opening is ${words} words; listings copy about the first 120`);
  if (/[–—]/.test(opening)) problems.push("the opening carries an en or em dash");
}

const site = readme.match(/^Website: (\S+)\s*$/m);
if (!site) problems.push('README.md has no "Website: <url>" line under the opening');
else if (site[1] !== server.websiteUrl) {
  problems.push(`README Website line is ${site[1]} but server.json websiteUrl is ${server.websiteUrl}`);
}

const counts = [...readme.matchAll(/\b(\d+) tools\b/g)].map((m) => Number(m[1]));
if (counts.length === 0) problems.push('found no "<N> tools" claim in README.md; the count check would be vacuous');
for (const n of counts) {
  if (n !== TOOLS.length) problems.push(`README.md claims ${n} tools but src/tools.js registers ${TOOLS.length}`);
}

const versions = {
  "package.json": pkg.version,
  "server.json version": server.version,
  "server.json packages[0].version": server.packages?.[0]?.version,
  "manifest.json": manifest.version,
};
if (new Set(Object.values(versions)).size !== 1) {
  problems.push(`version mismatch: ${JSON.stringify(versions)}`);
}

console.log(`  readme-opening: ${TOOLS.length} tools in the catalog, ${counts.length} count claim(s) checked, version ${pkg.version}`);
if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗ ${p}\x1b[0m`);
  console.error(`\n  \x1b[31m✗ readme-opening: ${problems.length} problem(s)\x1b[0m`);
  process.exit(1);
}
console.log("  \x1b[32m✓ readme-opening: opening, website link, tool counts and versions agree\x1b[0m");
