#!/usr/bin/env node
// readme-prices.mjs: every price README.md states for a named tool must equal the
// price the package itself declares for that tool.
//
// The package's own per-tool price is the "Cost: $X per call." (or "per billed
// item.", or "Free per call.") sentence at the end of each tool description in
// src/tools.js. gen-tools.mjs derives that sentence from the spec's x-cost-usd and
// fails the build when the two disagree, so it is the one price this package
// ships to a model. The README is the npm package page, and it priced tools by
// hand. It drifted: 0.23.0 said the draft and scheduled lists were "the two reads
// that are not at the read rate" in the same sentence that priced two DM reads at
// $0.0016, and it never priced twitter_tweet_replies_complete ($0.0024),
// twitter_list_create ($0.0016) or twitter_user_login ($0.01). Every other gate
// was green, because none of them compared a README price with a tool's price.
//
// What it checks, all against src/tools.js and never against another document:
//   1. Pricing table rows ("| $X per call | `tool`, ... |"): every tool in the
//      row is priced at X in that unit.
//   2. Prose: within one sentence, every backticked tool name is attributed to
//      the next price that follows it ("`twitter_dm_list` at $0.0016/call").
//      The README therefore names the tools first and the price after; a price
//      written before the tools it covers is not attributed to them. A sentence
//      that names no tool but says what something "bills" under a heading naming
//      exactly one tool is attributed to that tool.
//   3. Tool-table rows that call a tool free, and tools listed under a heading
//      that calls its section free, must be free in the catalog.
//   4. The provenance JSON example: its "cost" must be the named tool's cost.
//   5. Completeness: every paid tool priced other than the standard $0.0008 per
//      call has its price stated somewhere, so an omission fails like a typo.
//   6. Universal claims: an unqualified "Reads cost $X per call" must hold for
//      every paid read, and a count claim such as "the two reads that are not at
//      the read rate" must equal the number of paid reads priced above $0.0008.
//
// Run: node test/readme-prices.mjs [path/to/README.md]   (wired into `npm test`)
// The optional path lets the red test run the gate against an older README.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../src/tools.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
if (readme.length < 1000) {
  console.error(`  \x1b[31m✗ readme-prices: ${readmePath} is ${readme.length} bytes; refusing to pass on an empty or truncated README\x1b[0m`);
  process.exit(1);
}

const STANDARD = { usd: 0.0008, unit: "call" };
const problems = [];
const eq = (a, b) => Math.abs(a - b) < 1e-9;
const fmt = (p) => (p.usd === 0 ? "free" : `$${p.usd} per ${p.unit === "item" ? "billed item" : "call"}`);

// ---- the package's own price per tool --------------------------------------
const PRICE = new Map();
for (const t of TOOLS) {
  const m = t.description.match(/Cost: (?:(Free) per call|\$(\d+(?:\.\d+)?) per (call|billed item))\./);
  if (!m) {
    problems.push(`tool ${t.name} has no "Cost: ..." sentence in src/tools.js, so its price cannot be checked`);
    continue;
  }
  PRICE.set(t.name, m[1] ? { usd: 0, unit: "call" } : { usd: Number(m[2]), unit: m[3] === "call" ? "call" : "item" });
}

// A unit is read from the words right after the price. Unknown means the
// README did not say, and only the amount is compared.
function unitAfter(rest) {
  if (/^\s*(?:\/\s*call|per call)\b/i.test(rest)) return "call";
  if (/^\s*(?:per (?:billed item|item|account|pair|sample page|sampled account)|each)\b/i.test(rest)) return "item";
  return null;
}

const stated = new Map(); // tool -> [{ usd, unit, where }]
function claim(tool, usd, unit, where) {
  const actual = PRICE.get(tool);
  if (!actual) return; // a name that is not a tool is readme-parity's finding
  if (!stated.has(tool)) stated.set(tool, []);
  stated.get(tool).push({ usd, unit, where });
  if (!eq(actual.usd, usd)) {
    problems.push(`${where}: README prices \`${tool}\` at $${usd}, the package declares ${fmt(actual)}`);
  } else if (unit && actual.usd !== 0 && unit !== actual.unit) {
    problems.push(`${where}: README bills \`${tool}\` per ${unit === "item" ? "item" : "call"}, the package declares ${fmt(actual)}`);
  }
}

// ---- walk the README ------------------------------------------------------
const lines = readme.split("\n");
let inFence = false;
let fence = [];
let heading = "";
let headingTools = [];
const prose = []; // { text, line, headingTools }
const PRICE_RE = /\$(\d+(?:\.\d+)?)/g;
const TOOL_RE = /`(twitter_[a-z0-9_]+)`/g;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const at = `README.md:${i + 1}`;
  if (/^```/.test(line)) {
    if (inFence) {
      // 4) a fenced JSON example that names a tool and a cost
      const body = fence.join("\n");
      const tool = body.match(/"tool"\s*:\s*"(twitter_[a-z0-9_]+)"/);
      const cost = body.match(/"cost"\s*:\s*"(?:\$(\d+(?:\.\d+)?)([^"]*)|(free)[^"]*)"/i);
      if (tool && cost) claim(tool[1], cost[3] ? 0 : Number(cost[1]), cost[3] ? null : unitAfter(cost[2]), `${at} (provenance example)`);
      fence = [];
    }
    inFence = !inFence;
    continue;
  }
  if (inFence) {
    fence.push(line);
    continue;
  }
  const h = line.match(/^#{1,6}\s+(.*)$/);
  if (h) {
    heading = h[1];
    headingTools = [...heading.matchAll(TOOL_RE)].map((m) => m[1]);
    continue;
  }
  if (/^\s*\|/.test(line)) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || /^:?-+:?$/.test(cells[0])) continue;
    // 1) pricing table row: the first cell is a price
    const p = cells[0].match(/^\$(\d+(?:\.\d+)?)(.*)$/);
    if (p) {
      const tools = [...cells.slice(1).join(" | ").matchAll(TOOL_RE)].map((m) => m[1]);
      if (!tools.length) problems.push(`${at}: pricing row "${cells[0]}" names no tool`);
      for (const t of tools) claim(t, Number(p[1]), unitAfter(p[2]), `${at} (pricing table)`);
      continue;
    }
    // 3) tool-table row: `tool` | description that calls it free
    const tr = cells[0].match(/^`(twitter_[a-z0-9_]+)`$/);
    if (tr) {
      const desc = cells.slice(1).join(" ");
      if (/\bfree\b/i.test(desc)) claim(tr[1], 0, null, `${at} (tool row says free)`);
      else if (/\bfree\b/i.test(heading) && /_\([^)]*\bfree\b/i.test(heading)) claim(tr[1], 0, null, `${at} (under "${heading}")`);
    }
    continue;
  }
  if (line.trim()) prose.push({ text: line, line: i + 1, headingTools: [...headingTools] });
}

// 2) prose sentences
for (const { text, line, headingTools: ht } of prose) {
  const at = `README.md:${line}`;
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z`*(\[])/);
  for (const s of sentences) {
    const tokens = [];
    for (const m of s.matchAll(TOOL_RE)) tokens.push({ i: m.index, tool: m[1] });
    for (const m of s.matchAll(PRICE_RE)) tokens.push({ i: m.index, usd: Number(m[1]), unit: unitAfter(s.slice(m.index + m[0].length)) });
    tokens.sort((a, b) => a.i - b.i);
    const toolsHere = tokens.filter((t) => t.tool);
    const pricesHere = tokens.filter((t) => t.usd !== undefined);
    if (!toolsHere.length && pricesHere.length && ht.length === 1 && /\bbill/i.test(s)) {
      claim(ht[0], pricesHere[0].usd, pricesHere[0].unit, `${at} (under the \`${ht[0]}\` heading)`);
      continue;
    }
    let pending = [];
    for (const t of tokens) {
      if (t.tool) pending.push(t.tool);
      else {
        for (const tool of pending) claim(tool, t.usd, t.unit, at);
        pending = [];
      }
    }

    // 6a) an unqualified claim that reads, as a class, cost one price
    const u = s.match(/(?:^|[.;:]\s*|\s)(\w+\s+)?reads (?:cost|bill|are billed at|are)\s+\$(\d+(?:\.\d+)?)/i);
    if (u && !/^(?:most|standard|public|simple|plain|other|the standard|nearly)\s+$/i.test(u[1] || "")) {
      const usd = Number(u[2]);
      const off = TOOLS.filter((t) => !t.write && PRICE.get(t.name)?.usd > 0 && !eq(PRICE.get(t.name).usd, usd)).map((t) => t.name);
      if (off.length) problems.push(`${at}: "${u[0].trim()}" is stated for every read, but ${off.length} paid read(s) cost something else: ${off.join(", ")}`);
    }
  }
}

// 6b) a count claim about reads off the read rate
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const offRate = TOOLS.filter((t) => !t.write && PRICE.get(t.name)?.usd > 0 && !eq(PRICE.get(t.name).usd, STANDARD.usd));
for (const m of readme.matchAll(/\b(\w+) (?:list )?reads?,? (?:that|which) (?:are|is) not at the (?:read|standard) rate/gi)) {
  const n = WORDS[m[1].toLowerCase()] ?? (Number.isFinite(Number(m[1])) ? Number(m[1]) : null);
  if (n !== null && n !== offRate.length) {
    problems.push(`README says "${m[0]}", but ${offRate.length} paid reads are priced above $${STANDARD.usd}: ${offRate.map((t) => t.name).join(", ")}`);
  }
}

// 5) completeness: every non-standard paid price is stated
const nonStandard = [...PRICE].filter(([, p]) => p.usd > 0 && !(eq(p.usd, STANDARD.usd) && p.unit === STANDARD.unit));
for (const [tool, p] of nonStandard) {
  if (!stated.has(tool)) problems.push(`\`${tool}\` costs ${fmt(p)} but README.md never states its price`);
}

const claims = [...stated.values()].reduce((n, l) => n + l.length, 0);
console.log(`  readme-prices: ${PRICE.size} of ${TOOLS.length} tools priced in src/tools.js, ${claims} README price claim(s) across ${stated.size} tools, ${nonStandard.length} non-standard prices required (${readmePath === resolve(ROOT, "README.md") ? "README.md" : readmePath})`);
if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`  \x1b[31m✗ ${p}\x1b[0m`);
  console.error(`\n  \x1b[31m✗ readme-prices: ${problems.length} README price(s) disagree with the price the package declares\x1b[0m`);
  process.exit(1);
}
console.log(`  \x1b[32m✓ readme-prices: every README price for a named tool matches src/tools.js, and every non-standard price is stated\x1b[0m`);
