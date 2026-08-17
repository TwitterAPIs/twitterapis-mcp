// registry-manifests.mjs — fail-closed gate over the three registry descriptors
// (server.json, smithery.yaml, glama.json) AND over every other file that keeps
// its own copy of the package version. Wired into `npm test`.
//
// WHY THIS EXISTS. Adding server.json puts the package version in a SECOND place.
// The same fact in two files always drifts, so it gets a gate or it gets
// generated; this is the gate. It also pins the things a hosted installer breaks
// on silently: a config field with no description shows the user a bare variable
// name, and a wrong required-flag means the server starts with no API key and
// fails on the first tool call instead of at install time.
//
// The version now lives in FIVE places: package.json, server.json twice (top
// level and the npm package entry), and package-lock.json twice (top level and
// packages[""]). Every one of them is checked here. This is deliberately ONE
// gate rather than one gate per file: a second test file on the same subject is
// how the checks themselves drift apart.
//
// The lockfile half was added after it drifted for real. package.json read 0.9.0
// while both lockfile fields read 0.7.4, a version npm was never even served,
// and it survived because nothing in the suite opened package-lock.json. A
// stale lockfile version is not cosmetic: `npm ci` and any consumer reading the
// lockfile see the wrong version for a tree that is several releases ahead.
// Regenerate with `npm install --package-lock-only`, never by hand-editing JSON.
//
// It further enforces the tenant firewall on these files specifically, because
// they are PUBLIC surfaces submitted to third-party directories, and a firewall
// that only runs on the npm tarball would never see them (they are not in the
// package `files` list).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const read = (f) => readFileSync(resolve(ROOT, f), "utf8");

const fail = [];
const check = (cond, msg) => {
  if (!cond) fail.push(msg);
};

const pkg = JSON.parse(read("package.json"));

// ── server.json ─────────────────────────────────────────────────────────────
check(existsSync(resolve(ROOT, "server.json")), "server.json is missing");
const server = JSON.parse(read("server.json"));

// The three fields the official schema marks required.
for (const k of ["name", "description", "version"]) {
  check(typeof server[k] === "string" && server[k].length > 0, `server.json: missing required field "${k}"`);
}

// Reverse-DNS, exactly one slash. Copied from the live schema's own pattern
// (static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json), not
// from memory: a name that fails this is rejected at publish time.
check(
  /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(server.name ?? ""),
  `server.json: name "${server.name}" is not reverse-DNS with exactly one slash`,
);

// THE DRIFT GATE. Three copies of the version now exist.
check(
  server.version === pkg.version,
  `server.json version ${server.version} != package.json version ${pkg.version}`,
)

// mcpName IS THE OWNERSHIP PROOF, and nothing pinned it until 2026-08-17.
//
// The official MCP registry does not take our word that we own @twitterapis/mcp.
// It downloads the tarball FROM NPM and reads `mcpName` out of the package.json
// inside it. No repo-only change can satisfy that check, which is why a missing
// mcpName cannot be caught by looking at the working tree alone.
//
// MEASURED 2026-08-17: the published 0.9.0 tarball carried NO mcpName at all,
// while the registry listing sat at 0.6.4. The field was added in an earlier PR
// that was never merged, so it reached neither main nor any publish, and the
// listing quietly went three minor versions stale. This assertion is the half
// that makes that impossible to repeat: the value must exist AND must equal the
// server name the registry knows us by, or the suite fails before publish.
check(
  typeof pkg.mcpName === "string" && pkg.mcpName.length > 0,
  "package.json: mcpName is missing. The MCP registry reads this from the PUBLISHED tarball to prove we own the npm package; without it a registry publish is rejected.",
);
check(
  pkg.mcpName === server.name,
  `package.json mcpName "${pkg.mcpName}" != server.json name "${server.name}". They are the same identity and the registry compares them.`,
);
const npmPkg = (server.packages ?? []).find((p) => p.registryType === "npm");
check(npmPkg != null, "server.json: no npm package entry");
if (npmPkg) {
  check(
    npmPkg.identifier === pkg.name,
    `server.json package identifier ${npmPkg.identifier} != package.json name ${pkg.name}`,
  );
  check(
    npmPkg.version === pkg.version,
    `server.json package version ${npmPkg.version} != package.json version ${pkg.version}`,
  );
  check(npmPkg.transport?.type === "stdio", "server.json: npm package transport must be stdio");

  // Every env var the SERVER ACTUALLY READS must be declared, and nothing may be
  // declared that the server ignores. Derived from the source, never hand-listed,
  // so adding a process.env read without declaring it fails here.
  const src = read("src/index.js");
  const used = [...src.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const declared = (npmPkg.environmentVariables ?? []).map((e) => e.name);
  for (const v of new Set(used)) {
    check(declared.includes(v), `server.json: src/index.js reads ${v} but server.json does not declare it`);
  }
  for (const d of declared) {
    check(used.includes(d), `server.json declares ${d} but src/index.js never reads it`);
  }
  for (const e of npmPkg.environmentVariables ?? []) {
    check(
      typeof e.description === "string" && e.description.length > 20,
      `server.json: env var ${e.name} needs a real description, installers show it to the user`,
    );
  }
  // The key is a secret and is mandatory. Getting either wrong is the difference
  // between a working install and a 401 on the first call.
  const key = (npmPkg.environmentVariables ?? []).find((e) => e.name === "TWITTERAPIS_KEY");
  check(key?.isRequired === true, "server.json: TWITTERAPIS_KEY must be isRequired");
  check(key?.isSecret === true, "server.json: TWITTERAPIS_KEY must be isSecret");
}

// ── smithery.yaml ───────────────────────────────────────────────────────────
check(existsSync(resolve(ROOT, "smithery.yaml")), "smithery.yaml is missing");
const smith = read("smithery.yaml");
check(/type:\s*stdio/.test(smith), "smithery.yaml: startCommand.type must be stdio");
check(/configSchema:/.test(smith), "smithery.yaml: no configSchema, installers cannot prompt");
check(/twitterapisKey:/.test(smith), "smithery.yaml: configSchema must expose twitterapisKey");
check(/required:\s*\n\s*-\s*twitterapisKey/.test(smith), "smithery.yaml: twitterapisKey must be required");
check(/TWITTERAPIS_KEY:\s*config\.twitterapisKey/.test(smith), "smithery.yaml: commandFunction must map twitterapisKey to TWITTERAPIS_KEY");
// Each prompted field needs a title, or the installer shows a bare key name.
//
// The window MUST end at the next property, not at a fixed character count. The
// first version of this check sliced 400 characters forward, which ran past the
// end of the property and found the NEXT one's title: deleting a title left the
// gate green. Caught by red-testing it, which is the only reason it is correct
// now. Bound each block by the next key at the same indentation.
const propsAt = smith.indexOf("properties:");
check(propsAt !== -1, "smithery.yaml: configSchema has no properties block");
const propsBody = propsAt === -1 ? "" : smith.slice(propsAt);
/** The YAML block belonging to one property, ending where the next 6-space key starts. */
function propertyBlock(name) {
  const start = propsBody.search(new RegExp(`^ {6}${name}:`, "m"));
  if (start === -1) return null;
  const rest = propsBody.slice(start + 1);
  const nextRel = rest.search(/^ {6}\w+:/m);
  return nextRel === -1 ? propsBody.slice(start) : propsBody.slice(start, start + 1 + nextRel);
}
for (const f of ["twitterapisKey", "twitterapisBaseUrl", "twitterapisTimeoutMs"]) {
  const block = propertyBlock(f);
  check(block != null, `smithery.yaml: property ${f} not found in configSchema`);
  if (block) {
    check(/^\s+title:\s*\S/m.test(block), `smithery.yaml: ${f} has no title`);
    check(/^\s+description:/m.test(block), `smithery.yaml: ${f} has no description`);
  }
}

// ── glama.json ──────────────────────────────────────────────────────────────
check(existsSync(resolve(ROOT, "glama.json")), "glama.json is missing");
const glama = JSON.parse(read("glama.json"));
check(Array.isArray(glama.maintainers) && glama.maintainers.length > 0, "glama.json: no maintainers");

// ── manifest.json + .mcpbignore (the MCPB bundle surface) ───────────────────
// Smithery no longer lists a stdio server from a repo file. Its current publish
// path takes either a hosted Streamable HTTP URL or an uploaded .mcpb bundle,
// and this package is stdio-only with no hosted endpoint, so the bundle is the
// only route. manifest.json is what `mcpb pack` reads to build it.
//
// That makes the bundle a SECOND public distribution surface with DIFFERENT
// default contents from the npm tarball. npm ships only the `files` allowlist;
// `mcpb pack` starts from the whole working directory. MEASURED before
// .mcpbignore existed: a test pack shipped .claude/RESUME.md, test/ and
// scripts/, which carry foreign-tenant identity strings. The npm firewall gate
// could not see any of it, because none of those files are on the npm publish
// surface. Hence the deny-list assertions below.
check(existsSync(resolve(ROOT, "manifest.json")), "manifest.json is missing (mcpb bundle cannot be built)");
const mcpb = JSON.parse(read("manifest.json"));

for (const k of ["manifest_version", "name", "version", "description", "author", "server"]) {
  check(mcpb[k] != null, `manifest.json: missing required field "${k}"`);
}
// THE SIXTH COPY OF THE VERSION. Same drift rule as the other five.
check(
  mcpb.version === pkg.version,
  `manifest.json version ${mcpb.version} != package.json version ${pkg.version}`,
);
// $schema must match the declared manifest_version, or the file validates
// against a spec it does not claim to follow.
check(
  typeof mcpb.$schema === "string" && mcpb.$schema.includes(`v${mcpb.manifest_version}.schema.json`),
  `manifest.json: $schema ${mcpb.$schema} does not match manifest_version ${mcpb.manifest_version}`,
);
check(mcpb.server?.type === "node", "manifest.json: server.type must be node");
// The entry point must be a file that EXISTS, not a plausible path. A bundle
// whose entry_point is wrong packs fine and fails at first launch.
check(
  typeof mcpb.server?.entry_point === "string" && existsSync(resolve(ROOT, mcpb.server.entry_point)),
  `manifest.json: server.entry_point "${mcpb.server?.entry_point}" does not exist`,
);
check(mcpb.server?.mcp_config?.command === "node", "manifest.json: mcp_config.command must be node");

// Same derive-from-source rule as server.json: every env var the server READS
// must be wired here, and nothing may be wired that it ignores.
{
  const src = read("src/index.js");
  const used = new Set([...src.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]));
  const envMap = mcpb.server?.mcp_config?.env ?? {};
  for (const v of used) {
    check(envMap[v] != null, `manifest.json: src/index.js reads ${v} but mcp_config.env does not set it`);
  }
  for (const d of Object.keys(envMap)) {
    check(used.has(d), `manifest.json: mcp_config.env sets ${d} but src/index.js never reads it`);
  }
  // Every env value must resolve from a DECLARED user_config key, or the
  // installer collects nothing and the server starts unconfigured.
  for (const [name, expr] of Object.entries(envMap)) {
    const ref = /^\$\{user_config\.([a-z0-9_]+)\}$/.exec(String(expr));
    check(ref != null, `manifest.json: env ${name} is not a \${user_config.*} reference`);
    if (ref) {
      check(
        mcpb.user_config?.[ref[1]] != null,
        `manifest.json: env ${name} references user_config.${ref[1]}, which is not declared`,
      );
    }
  }
}
// The key is mandatory and secret here too. `sensitive` is what stops an
// installer rendering the API key as plain text on screen.
{
  const keyCfg = mcpb.user_config?.twitterapis_key;
  check(keyCfg != null, "manifest.json: user_config.twitterapis_key is missing");
  check(keyCfg?.required === true, "manifest.json: twitterapis_key must be required");
  check(keyCfg?.sensitive === true, "manifest.json: twitterapis_key must be sensitive");
  for (const [name, cfg] of Object.entries(mcpb.user_config ?? {})) {
    check(typeof cfg.title === "string" && cfg.title.length > 0, `manifest.json: user_config.${name} has no title`);
    check(
      typeof cfg.description === "string" && cfg.description.length > 20,
      `manifest.json: user_config.${name} needs a real description, installers show it to the user`,
    );
  }
}

// The deny-list. Each entry here was measured leaking into a real pack.
check(existsSync(resolve(ROOT, ".mcpbignore")), ".mcpbignore is missing, `mcpb pack` would ship test/, scripts/ and .claude/");
{
  const ign = read(".mcpbignore")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const entry of [".claude/", "test/", "scripts/", ".env", "*.mcpb"]) {
    check(
      ign.includes(entry),
      `.mcpbignore: "${entry}" is not excluded, so \`mcpb pack\` would put it in the public bundle`,
    );
  }
}

// ── package-lock.json ───────────────────────────────────────────────────────
// The lockfile carries its own copy of the package identity, and npm only
// refreshes it when something prompts npm to write it. A version bump that
// touches package.json alone leaves both of these fields behind.
check(existsSync(resolve(ROOT, "package-lock.json")), "package-lock.json is missing");
const lock = JSON.parse(read("package-lock.json"));

check(
  lock.version === pkg.version,
  `package-lock.json version ${lock.version} != package.json version ${pkg.version} ` +
    `(regenerate with: npm install --package-lock-only)`,
);
check(
  lock.name === pkg.name,
  `package-lock.json name ${lock.name} != package.json name ${pkg.name}`,
);

// lockfileVersion 2 and 3 repeat the root package under packages[""], and the
// two copies can disagree with each other as well as with package.json, so the
// absence of that entry on a v2+ lockfile is itself the failure, not a skip.
const lockRoot = lock.packages?.[""];
check(
  lockRoot != null,
  `package-lock.json: lockfileVersion ${lock.lockfileVersion} has no packages[""] entry to check`,
);
if (lockRoot) {
  check(
    lockRoot.version === pkg.version,
    `package-lock.json packages[""] version ${lockRoot.version} != package.json version ${pkg.version} ` +
      `(regenerate with: npm install --package-lock-only)`,
  );
  check(
    lockRoot.name === pkg.name,
    `package-lock.json packages[""] name ${lockRoot.name} != package.json name ${pkg.name}`,
  );
}

// ── tenant firewall on all three ────────────────────────────────────────────
// Bare case-insensitive substrings, never word boundaries: \bforkoff\b misses
// officialForkoff, which is exactly the string that must not appear here.
const BANNED = ["forkoff", "0x0simba", "simba", "bozad", "getxapi", "redditapis", "users/apple"];
for (const f of ["server.json", "smithery.yaml", "glama.json", "manifest.json"]) {
  const body = read(f).toLowerCase();
  for (const term of BANNED) {
    check(!body.includes(term), `${f}: tenant-firewall breach, contains "${term}"`);
  }
}

if (fail.length) {
  console.error(`✗ registry-manifests: ${fail.length} problem(s)`);
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `✓ registry-manifests: server.json + smithery.yaml + glama.json + manifest.json + package-lock.json ` +
    `consistent at v${pkg.version} (6 version copies agree), ` +
    `env vars match src/index.js, mcpb bundle surface denies test/ scripts/ .claude/, firewall clean`,
);
