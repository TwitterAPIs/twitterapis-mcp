#!/usr/bin/env node
// pack-for-smithery.mjs — build a Smithery-publishable MCPB bundle.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A CHANGE TO gen-manifest-tools.mjs
// -----------------------------------------------------------------------------
// Smithery's publish API REJECTS a bundle whose manifest tools carry only
// {name, description}. Measured 2026-09-06 on a real publish of this exact
// bundle: HTTP 400 with EXACTLY 99 errors, one per tool, each reading
// "Invalid input: expected object, received undefined". The count matching the
// tool count is what identifies it as per-tool rather than a bundle-level fault.
//
// The missing field is `inputSchema`, and that is not a guess. In the published
// @smithery/cli the tool validator declares
//     inputSchema: object({type: literal("object"), properties, required}).catchall(...)
// with NO .optional(), while `description` beside it IS optional; and the publish
// path builds its payload as
//     serverCard: { serverInfo: {...}, ...(r.tools ? {tools: r.tools} : {}) }
// where `r` is the parsed MCPB manifest. So it passes manifest.tools STRAIGHT
// THROUGH with no transformation, and a tool without inputSchema fails the schema.
//
// THE CONFLICT, which is the whole reason this file is separate from the
// generator. MCPB v0.3 validates manifest.json with a STRICT object schema and
// REJECTS that key. Both directions measured on this repo:
//
//     generator emits inputSchema  ->  mcpb validate FAILS, 99x
//                                      "Unrecognized key(s) in object: 'inputSchema'"
//     generator omits inputSchema  ->  mcpb validate PASSES, Smithery 400s
//
// manifest.json cannot satisfy both. This is an upstream incompatibility between
// the MCPB manifest schema and Smithery's serverCard schema, not a defect in our
// generator. The first attempt at this DID edit the generator, broke a passing
// gate, and was reverted rather than shipped, because trading a working local
// check for an unverified remote one is a bad trade in both directions.
//
// So: the REPO's manifest.json stays MCPB-valid and untouched, and the bundle
// SENT TO SMITHERY gets the field injected at pack time. One artifact, one
// consumer, no drift, and `mcpb validate` keeps meaning what it means.
//
// THE SCHEMAS ARE DERIVED, NEVER RESTATED. src/tools.js carries `shape`, a raw
// Zod shape, and src/index.js hands that SAME object to the SDK as inputSchema.
// So the schema the running server serves and the schema published here come
// from ONE source. A hand-written JSON Schema beside it would be a second copy
// free to drift, and it would drift SILENTLY because the two are read by
// different consumers who never meet.
//
// Usage:
//   node scripts/pack-for-smithery.mjs [outfile]   default: ./smithery-server.mcpb
//   node scripts/pack-for-smithery.mjs --selftest
//
// Exit: 0 built and verified · 1 a verification failed (nothing usable written)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { TOOLS } from "../src/tools.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MCPB = ["-y", "@anthropic-ai/mcpb@2.1.2"];

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
}

/** JSON Schema for one tool, converted from the SHIPPED Zod shape. */
export function inputSchemaFor(tool) {
  // Validate the INPUT before converting. `z.object(null)` does not throw; it
  // yields {type:"object", properties:{}}, which passes an output-side guard and
  // would publish an empty schema for a tool that really has parameters. Caught
  // by a red test that expected a throw and got a plausible-looking object.
  if (!tool || typeof tool.shape !== "object" || tool.shape === null) {
    throw new Error(
      `${tool?.name ?? "<unnamed>"}: shape is ${tool?.shape === null ? "null" : typeof tool?.shape}, ` +
        `not an object. Refusing to convert.`,
    );
  }
  const schema = z.toJSONSchema(z.object(tool.shape), { io: "input" });
  // NOTE: empty `properties` is LEGITIMATE here and must not be rejected. 9 of
  // the 99 shipped tools genuinely take no parameters (twitter_account_me,
  // twitter_trends_locations and friends), so a non-empty check would refuse
  // real tools. That is why the guard above is on the INPUT, not the output.
  if (!schema || schema.type !== "object" || !schema.properties) {
    throw new Error(
      `${tool.name}: did not convert to an object JSON Schema. ` +
        `Got ${JSON.stringify(schema).slice(0, 200)}`,
    );
  }
  return schema;
}

/** Inject inputSchema into a parsed manifest's tools. Pure, so it is testable. */
export function withInputSchemas(manifest, tools = TOOLS) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const out = (manifest.tools ?? []).map((entry) => {
    const src = byName.get(entry.name);
    if (!src) {
      // A manifest tool with no counterpart in src/tools.js means the manifest is
      // stale relative to the code. Publishing that would advertise a tool the
      // server does not serve, so refuse rather than silently drop it.
      throw new Error(
        `manifest names tool "${entry.name}" which does not exist in src/tools.js. ` +
          `Run \`npm run build\` first.`,
      );
    }
    return { ...entry, inputSchema: inputSchemaFor(src) };
  });
  if (out.length !== (manifest.tools ?? []).length) {
    throw new Error("tool count changed during injection");
  }
  return { ...manifest, tools: out };
}

function assertBundle(path, expectedCount) {
  // Verify the ARTIFACT, not the steps that produced it. A rewrite that produces
  // a corrupt zip, or drops tools, must not reach a publish.
  const listing = run("/usr/bin/unzip", ["-l", path]);
  if (!/\bmanifest\.json\b/.test(listing)) {
    throw new Error("rebuilt bundle has no manifest.json at its root");
  }
  const manifest = JSON.parse(run("/usr/bin/unzip", ["-p", path, "manifest.json"]));
  const tools = manifest.tools ?? [];
  if (tools.length !== expectedCount) {
    throw new Error(`bundle carries ${tools.length} tools, expected ${expectedCount}`);
  }
  const bad = tools.filter(
    (t) => !t.inputSchema || t.inputSchema.type !== "object" || !t.inputSchema.properties,
  );
  if (bad.length) {
    throw new Error(
      `${bad.length} of ${tools.length} tools lack an object inputSchema, ` +
        `e.g. ${bad[0].name}`,
    );
  }
  return { manifest, tools };
}

function build(outfile) {
  const repoManifestBefore = readFileSync(join(ROOT, "manifest.json"), "utf8");
  const work = mkdtempSync(join(tmpdir(), "smithery-pack-"));
  const staged = join(work, "server.mcpb");
  try {
    // 1. Pack the normal, MCPB-valid bundle from the repo as it stands.
    run("npx", [...MCPB, "pack", ROOT, staged], { cwd: ROOT });

    // 2. Unpack, rewrite ONLY manifest.json, repack.
    const x = join(work, "x");
    run("/usr/bin/unzip", ["-q", staged, "-d", x]);
    const manifestPath = join(x, "manifest.json");
    const patched = withInputSchemas(JSON.parse(readFileSync(manifestPath, "utf8")));
    writeFileSync(manifestPath, JSON.stringify(patched, null, 2) + "\n");
    const rebuilt = join(work, "smithery.mcpb");
    run("/usr/bin/zip", ["-q", "-r", "-X", rebuilt, "."], { cwd: x });

    // 3. Verify the artifact.
    const { tools } = assertBundle(rebuilt, TOOLS.length);

    // 4. The repo's own manifest must be untouched. This is the guarantee that
    //    makes this approach safe: `mcpb validate` keeps passing on the repo.
    const repoManifestAfter = readFileSync(join(ROOT, "manifest.json"), "utf8");
    if (repoManifestAfter !== repoManifestBefore) {
      throw new Error("repo manifest.json changed during packing; it must not");
    }

    copyFileSync(rebuilt, outfile);
    const bytes = readFileSync(outfile).length;
    console.log(
      `✓ smithery bundle: ${outfile}\n` +
        `  ${tools.length} tools, every one carrying an object inputSchema\n` +
        `  ${bytes} bytes\n` +
        `  repo manifest.json UNCHANGED (still MCPB-valid)`,
    );
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function selftest() {
  const fails = [];
  const ok = (label, cond) => {
    console.log(`  ${cond ? "PASS" : "FAIL"} ${label}`);
    if (!cond) fails.push(label);
  };

  // GREEN: every shipped tool converts to an object schema with properties.
  let converted = 0;
  for (const t of TOOLS) {
    const s = inputSchemaFor(t);
    if (s.type === "object" && s.properties) converted++;
  }
  ok(`green: all ${TOOLS.length} shipped tools convert to an object schema`,
     converted === TOOLS.length);

  // GREEN: descriptions survive the conversion. A schema with no parameter
  // descriptions would publish, and would be materially worse for the model
  // choosing the tool, so blank output must not read as success.
  const withDesc = TOOLS.filter((t) => {
    const p = inputSchemaFor(t).properties ?? {};
    return Object.values(p).some((v) => typeof v?.description === "string" && v.description);
  }).length;
  ok("green: parameter descriptions survive conversion", withDesc > TOOLS.length / 2);

  // RED: a manifest naming a tool the code does not have must REFUSE, not drop.
  let refusedStale = false;
  try {
    withInputSchemas({ tools: [{ name: "twitter_this_tool_does_not_exist" }] });
  } catch { refusedStale = true; }
  ok("red: a stale manifest tool is refused, never silently dropped", refusedStale);

  // RED: a tool whose shape does not convert must throw rather than emit junk.
  let refusedBadShape = false;
  try { inputSchemaFor({ name: "x", shape: null }); } catch { refusedBadShape = true; }
  ok("red: an unconvertible shape throws instead of emitting a bad schema", refusedBadShape);

  // RED: injection must not change the tool count.
  const sample = { tools: TOOLS.slice(0, 3).map((t) => ({ name: t.name, description: t.description })) };
  ok("red: injection preserves the tool count",
     withInputSchemas(sample).tools.length === 3);

  // RED, the load-bearing one: the injected manifest must be REJECTED by mcpb
  // validate. If it were accepted, this whole file would be unnecessary and the
  // generator fix would have been correct, so this assertion is what proves the
  // conflict is real rather than remembered.
  const work = mkdtempSync(join(tmpdir(), "smithery-selftest-"));
  let mcpbRejects = false;
  try {
    const m = withInputSchemas(JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")));
    const p = join(work, "manifest.json");
    writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
    try {
      run("npx", [...MCPB, "validate", p], { cwd: work });
    } catch { mcpbRejects = true; }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  ok("red: mcpb validate REJECTS the injected manifest (the conflict is real)", mcpbRejects);

  // GREEN: and the repo's own manifest still passes, which is the guarantee.
  let repoValid = true;
  try { run("npx", [...MCPB, "validate", join(ROOT, "manifest.json")], { cwd: ROOT }); }
  catch { repoValid = false; }
  ok("green: the repo's manifest.json still passes mcpb validate", repoValid);

  console.log(`\nselftest: ${fails.length ? `FAIL ${JSON.stringify(fails)}` : "PASS"}`);
  return fails.length ? 1 : 0;
}

const arg = process.argv[2];
if (arg === "--selftest") {
  process.exit(selftest());
} else {
  const out = resolve(ROOT, arg ?? "smithery-server.mcpb");
  if (existsSync(out)) rmSync(out);
  process.exit(build(out));
}
