// Unit tests for the tool catalog + query builder. No network, no SDK server.
import { TOOLS, buildQuery } from "../src/tools.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("  FAIL:", name); } };

// Catalog shape
check("16 tools", TOOLS.length === 16);
check("names unique", new Set(TOOLS.map((t) => t.name)).size === TOOLS.length);
// Regression: customer-session-only endpoints (require POST /customer/session, so an
// API-key-only MCP user always gets 409) must NOT be in the catalog. user/likes was
// removed for exactly this reason — keep it out.
check("no customer-session-only paths", !TOOLS.some((t) => t.path === "/twitter/user/likes"));
check("all names twitter_*", TOOLS.every((t) => /^twitter_[a-z_]+$/.test(t.name)));
check("all paths /twitter/*", TOOLS.every((t) => t.path.startsWith("/twitter/")));
check("paths unique-ish (>=15 distinct)", new Set(TOOLS.map((t) => t.path)).size >= 15);
check("all have a real description", TOOLS.every((t) => typeof t.description === "string" && t.description.length > 20));
check("all have an object shape", TOOLS.every((t) => t.shape && typeof t.shape === "object" && !Array.isArray(t.shape)));
check("required-arg tools declare a required field", ["twitter_advanced_search", "twitter_user_search", "twitter_user_info", "twitter_user_info_by_id", "twitter_list_members", "twitter_user_mentions"].every((n) => {
  const t = TOOLS.find((x) => x.name === n);
  return t && Object.keys(t.shape).length > 0;
}));

// Query builder
check("buildQuery drops empty/null/undefined", buildQuery({ a: "", b: null, c: undefined, d: "x" }) === "d=x");
check("buildQuery url-encodes spaces", buildQuery({ query: "AI agents" }) === "query=AI+agents");
check("buildQuery encodes operators", buildQuery({ query: "from:openai min_faves:100" }).includes("from%3Aopenai"));
check("buildQuery empty object -> ''", buildQuery({}) === "");
check("buildQuery null arg -> ''", buildQuery(null) === "");
check("buildQuery keeps count + cursor", (() => { const q = buildQuery({ username: "x", count: 20, cursor: "abc" }); return q.includes("username=x") && q.includes("count=20") && q.includes("cursor=abc"); })());
// count is zod .positive() upstream so 0 never reaches buildQuery; the builder itself
// keeps any non-empty stringified value (it is a dumb stringifier, not a validator).
check("buildQuery stringifies numeric 0 as count=0", buildQuery({ count: 0 }) === "count=0");

console.log(`tools.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
