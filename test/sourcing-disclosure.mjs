#!/usr/bin/env node
// V-SOURCING for the MCP package: no text this package ships (tool descriptions, prompts, README,
// manifests) describes how reads are sourced. Same phrase set as the docs and website checks.
//
// WHY. The 2026-06-21 rule (feedback_twitterapis_no_internal_infra_in_public_copy): a public
// surface never exposes the account pool, pooled reads, rotating accounts, our scraping
// infrastructure or the anti-bot layer. The marketing site has enforced it since 2026-10-15
// (scripts/ratchet/audit-sourcing-disclosure.mjs in the website repo, fail-closed estate-wide since
// 2026-10-20), but this repo had no check at all, and on 2026-10-20 its reference pages, the
// catalog they are generated from, the OpenAPI spec and the Postman collection carried 79 such
// phrases. They were reworded to customer-facing behaviour ("a public read that needs no session",
// "acts as your own account", "monitoring capacity"); this check keeps them out.
//
// SCOPE: everything this package ships to an MCP client or a reader: src/** (tool descriptions,
// prompts, provenance strings), README.md, manifest.json, server.json, scripts/tools.overrides.mjs
// (the source of the curated tool descriptions).
//
// Exit 0 clean, 1 on any hit, 2 if it scanned nothing (a check that reads no file passes everything).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Same phrase classes as the website gate. Word-bounded so "pool" alone (a webhook retry pool,
// a connection pool in a code sample) never fires.
// Hyphens and "poll" spellings included (review of #135: "pooled-read", "shared-pool", "shared
// poll pool" and "pooled account" reached live pages while an earlier, narrower list read 0).
export const PATTERNS = [
  /\bpooled[\s-]+(?:public[\s-]+)?reads?\b/i,
  /\bpooled[\s-]+(?:account|session|identity|one)s?\b/i,
  /\b(?:account[\s-]+pool|pool[\s-]+accounts?)\b/i,
  /\bshared[\s-]+(?:poll(?:ing)?[\s-]+)?pool(?:ed)?\b/i,
  /\bpool\s+of\s+(?:x\s+|twitter\s+)?accounts?\b/i,
  /\brotating\s+(?:pool\s+)?accounts?\b/i,
  /\bour\s+(?:account\s+|shared\s+)?pool\b/i,
  /\breads?\s+(?:are\s+)?pooled\b/i,
  /\banti-?bot\s+layer\b/i,
  /\bour\s+(?:scraping\s+|request\s+)?infrastructure\b/i,
];

function walk(dir, exts, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

export function targets(root = ROOT) {
  const files = [...walk(path.join(root, "src"), [".js", ".mjs"], [])];
  for (const f of ["README.md", "CHANGELOG.md", "manifest.json", "server.json", "scripts/tools.overrides.mjs"]) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) files.push(p);
  }
  return files;
}

export function scan(text) {
  const hits = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const re of PATTERNS) {
      const m = re.exec(line);
      if (m) hits.push({ line: i + 1, match: m[0] });
    }
  });
  return hits;
}

function main() {
  if (process.argv.includes("--selftest")) {
    const bad = scan("This is a pooled read served by our account pool.\nruns as your own account");
    // Hyphen and "poll" spellings must each be caught on their own.
    for (const v of ["the same pooled-read reason", "rather than a pooled account", "the shared poll pool", "shared-pool admission"]) {
      if (scan(v).length === 0) { console.log(`[check-sourcing-disclosure] selftest FAIL: missed "${v}"`); process.exit(1); }
    }
    const good = scan("A public read that needs no session. Webhook retries use a pool of workers.");
    // "pooled read", "account pool" and "our account pool" each match: 3 hits on the planted line.
    const ok = bad.length === 3 && good.length === 0;
    console.log(`[check-sourcing-disclosure] selftest ${ok ? "PASS" : "FAIL"} (planted 3, found ${bad.length}; clean text found ${good.length})`);
    process.exit(ok ? 0 : 1);
  }
  const files = targets();
  if (files.length === 0) {
    console.error("[check-sourcing-disclosure] FATAL: scanned 0 files; a check that reads nothing passes everything.");
    process.exit(2);
  }
  const all = [];
  for (const f of files) {
    for (const h of scan(fs.readFileSync(f, "utf8"))) all.push({ file: path.relative(ROOT, f), ...h });
  }
  console.log(`[check-sourcing-disclosure] scanned ${files.length} customer-facing file(s)`);
  if (all.length) {
    console.error(`[check-sourcing-disclosure] FAIL: ${all.length} phrase(s) describe how reads are sourced (2026-06-21 rule):`);
    for (const h of all.slice(0, 100)) console.error(`  ${h.file}:${h.line}  "${h.match}"`);
    console.error("  Say what the caller gets instead: a public read that needs no session, acts as your own account, monitoring capacity.");
    process.exit(1);
  }
  console.log("[check-sourcing-disclosure] PASS: 0 hits");
}

main();
