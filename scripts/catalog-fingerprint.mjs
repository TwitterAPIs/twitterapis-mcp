// One place builds the catalog fingerprint.
//
// The fingerprint is the machine-comparable description of what an MCP client
// actually receives: per tool, its name, the REST endpoint it calls, the HTTP
// method, the read/write/destructive/jsonBody flags, and the full JSON Schema of
// its input object (arg names, ordering, required-ness, types, numeric bounds,
// enum members, and every arg description).
//
// Both the frozen baseline in test/catalog.baseline.json and the live check in
// test/catalog-identity.mjs are produced by THIS function, so a writer and a
// reader can never disagree about what a fingerprint is.
//
// Why JSON Schema and not the Zod objects: JSON Schema is the wire form the MCP
// SDK advertises to the client, so comparing it compares the thing the model
// reads. Comparing Zod internals would compare an implementation detail that can
// change shape between Zod releases without any client-visible effect.

import { z } from "zod";

if (typeof z.toJSONSchema !== "function") {
  // Fail closed. A fingerprint we cannot compute is not a fingerprint that
  // passes; silently degrading here would turn the identity gate into a green
  // that cannot see a defect.
  console.error(
    "catalog-fingerprint: this dev gate needs zod >= 4 (z.toJSONSchema). " +
      "package-lock.json pins the dev tree; run `npm ci`.",
  );
  process.exit(1);
}

/** Canonical fingerprint of one tool. */
export function fingerprintTool(tool) {
  const schema = z.toJSONSchema(z.object(tool.shape || {}), { io: "input" });
  // Drop the $schema banner: it is a JSON Schema dialect marker, not part of the
  // tool contract, and pinning it would make a Zod upgrade look like tool drift.
  delete schema.$schema;
  return {
    name: tool.name,
    path: tool.path,
    method: tool.method || "GET",
    write: Boolean(tool.write),
    destructive: Boolean(tool.destructive),
    jsonBody: Boolean(tool.jsonBody),
    description: tool.description,
    args: Object.keys(schema.properties || {}),
    required: schema.required || [],
    inputSchema: schema,
  };
}

/** Canonical fingerprint of a whole catalog, keyed by tool name. */
export function fingerprintCatalog(tools) {
  const out = { toolCount: tools.length, order: tools.map((t) => t.name), tools: {} };
  for (const t of tools) out.tools[t.name] = fingerprintTool(t);
  return out;
}
