#!/usr/bin/env node
// prepublish-version-class.mjs: a tool added to the catalog is a capability
// change and ships as a MINOR, so a consumer pinned to the previous minor opts
// in rather than receiving it silently. Nothing enforced that on the sibling
// product until 2026-09-11, when a release was first cut as a patch while adding
// a tool and only an adversarial review caught it. This compares the authored
// catalog against the PUBLISHED tarball (the emitting system, never a recorded
// count) and refuses a patch bump when the catalog grew. Pure verdict in
// versionClassVerdict so it can be red-tested offline; the live path fails
// CLOSED when npm or the tarball cannot be read. Run with --selftest for the
// offline cases.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toolNames, versionClassVerdict, selftest } from "./version-class.mjs";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");


if (process.argv.includes("--selftest")) {
  process.exit(selftest() ? 0 : 1);
}

const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));
let published;
try {
  published = execFileSync("npm", ["view", pkg.name, "version"], { encoding: "utf8" }).trim();
} catch (e) {
  console.error(`\n[prepublish-version-class] BLOCKED: could not read the published version of ${pkg.name} from npm (${e.message.split("\n")[0]}). A publish that cannot see what it replaces does not proceed.`);
  process.exit(1);
}
const scratch = mkdtempSync(join(tmpdir(), "prepublish-class-"));
let publishedTools;
try {
  execFileSync("npm", ["pack", `${pkg.name}@${published}`, "--pack-destination", scratch], { stdio: "pipe" });
  const tgz = readdirSync(scratch).find((f) => f.endsWith(".tgz"));
  execFileSync("tar", ["-xzf", join(scratch, tgz), "-C", scratch]);
  publishedTools = readFileSync(join(scratch, "package", "src", "tools.js"), "utf8");
} catch (e) {
  console.error(`\n[prepublish-version-class] BLOCKED: could not read the published tarball of ${pkg.name}@${published} (${e.message.split("\n")[0]}). If src/tools.js moved in the published layout, update the path this check reads rather than skipping it.`);
  process.exit(1);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
const localNames = toolNames(readFileSync(join(PKG_ROOT, "src", "tools.js"), "utf8"));
const publishedNames = toolNames(publishedTools);
if (localNames.length === 0 || publishedNames.length === 0) {
  console.error(`\n[prepublish-version-class] BLOCKED: tool name reader saw ${localNames.length} authored and ${publishedNames.length} published tools; a zero means the anchor drifted, not an empty catalog.`);
  process.exit(1);
}
const v = versionClassVerdict(pkg.version, published, localNames, publishedNames);
if (!v.ok) { console.error(`\n[prepublish-version-class] BLOCKED: ${v.reason}.`); process.exit(1); }
console.log(`[prepublish-version-class] OK: ${v.reason}.`);
