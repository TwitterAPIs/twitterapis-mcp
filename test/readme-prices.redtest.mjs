#!/usr/bin/env node
// readme-prices.redtest.mjs: proves test/readme-prices.mjs fails closed on the
// price shapes it used to pass silently. Each case plants one wrong price for
// `twitter_dm_list` (the package declares $0.0016 per call) into a copy of
// README.md and asserts the gate exits 1 with a finding that names the tool.
// The clean README must still exit 0, or a red here means nothing.
//
//   M3c  the price before the tools in one sentence ("At $X per call: `tool`.")
//   M5   a tool-table row whose description states a price
//   M14  a | Tool | Price | table, the price column after the tool column
//
// Run: node test/readme-prices.redtest.mjs   (wired into `npm test`)

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(ROOT, "test", "readme-prices.mjs");
const README = readFileSync(join(ROOT, "README.md"), "utf8");

const CASES = [
  ["M3c price before the tools in a sentence", "At $0.0008 per call: `twitter_dm_list`."],
  ["M5 tool-table row with a price in the description", "| `twitter_dm_list` | List DM conversations, $0.0008 per call |"],
  ["M14 Tool | Price table", "| Tool | Price |\n|---|---|\n| `twitter_dm_list` | $0.0008 per call |"],
];

const dir = mkdtempSync(join(tmpdir(), "readme-prices-red-"));
let failed = 0;
function run(label, text, wantFail) {
  const file = join(dir, `${label.split(" ")[0]}.md`);
  writeFileSync(file, text);
  if (readFileSync(file, "utf8") !== text) throw new Error(`${label}: planted file did not round-trip`);
  const r = spawnSync(process.execPath, [GATE, file], { encoding: "utf8" });
  const out = `${r.stdout}${r.stderr}`;
  const ok = wantFail ? r.status === 1 && out.includes("twitter_dm_list") : r.status === 0;
  if (!ok) failed++;
  console.log(`  ${ok ? "\x1b[32m✓" : "\x1b[31m✗"} ${label}: gate exit ${r.status}, expected ${wantFail ? "1 naming `twitter_dm_list`" : 0}\x1b[0m`);
}

try {
  run("clean README.md", README, false);
  for (const [label, plant] of CASES) {
    const planted = `${README.trimEnd()}\n\n${plant}\n`;
    if (planted === README) throw new Error(`${label}: plant did not change the README`);
    run(label, planted, true);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n  \x1b[31m✗ readme-prices red test: ${failed} of ${CASES.length + 1} case(s) did not behave\x1b[0m`);
  process.exit(1);
}
console.log(`  \x1b[32m✓ readme-prices red test: ${CASES.length} planted wrong prices fail, the clean README passes\x1b[0m`);
