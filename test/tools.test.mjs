// Unit tests for the tool catalog + query builder. No network, no SDK server.
import { TOOLS, buildQuery, resolvePathParams, MissingPathParamError } from "../src/tools.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("  FAIL:", name); } };

const reads = TOOLS.filter((t) => !t.write);
const writes = TOOLS.filter((t) => t.write);

// Catalog shape (full parity: reads + writes).
//
// THESE THREE WERE RED ON MAIN FOR TWELVE DAYS. twitter_users_by_ids and
// twitter_media_status were merged on 2026-07-31 (49 tools, 35 reads) and these
// constants were left at the pre-merge 47/33. Because prepublishOnly runs
// `npm test`, that made the package UNPUBLISHABLE: the release everyone was
// waiting on would have failed at its first step, and the reason was never the
// npm credential. Nothing caught it because GitHub Actions is permanently off
// and nobody ran the suite locally after the merge.
//
// Keep the exact counts, they are what catches an accidentally DELETED tool,
// which no other gate here would notice. Bump them deliberately in the same
// commit that adds or removes a tool.
const EXPECTED_TOOLS = 71;
const EXPECTED_READS = 44;
const EXPECTED_WRITES = 27;
check(`${EXPECTED_TOOLS} tools (got ${TOOLS.length})`, TOOLS.length === EXPECTED_TOOLS);
check(`${EXPECTED_READS} reads (got ${reads.length})`, reads.length === EXPECTED_READS);
check(`${EXPECTED_WRITES} writes (got ${writes.length})`, writes.length === EXPECTED_WRITES);
// Arithmetic invariant, independent of the three constants above: every tool is
// either a read or a write. A partition that does not add up means `write` is
// missing or misspelled on some tool, which the three counts alone can miss when
// two errors cancel out.
check(
  `reads + writes == total (${reads.length} + ${writes.length} == ${TOOLS.length})`,
  reads.length + writes.length === TOOLS.length,
);
check("names unique", new Set(TOOLS.map((t) => t.name)).size === TOOLS.length);
// Path is NOT globally unique: the monitor/webhook family serves more than one
// HTTP method on the same REST path (POST update + DELETE remove both target
// /twitter/monitor/{id}), so the catalog's true routing key is (method, path).
check("(method, path) unique", new Set(TOOLS.map((t) => `${t.method || "GET"} ${t.path}`)).size === TOOLS.length);
check("all names twitter_*", TOOLS.every((t) => /^twitter_[a-z0-9_]+$/.test(t.name)));
check("all paths /twitter/* or /account/*", TOOLS.every((t) => t.path.startsWith("/twitter/") || t.path.startsWith("/account/")));
check("all have a real description", TOOLS.every((t) => typeof t.description === "string" && t.description.length > 20));
check("all have an object shape", TOOLS.every((t) => t.shape && typeof t.shape === "object" && !Array.isArray(t.shape)));

// Method discipline: reads are GET (no method or "GET"); writes are POST or
// DELETE (a DELETE mutates account state just as much as a POST write does).
check("reads have no POST/DELETE method", reads.every((t) => !t.method || t.method === "GET"));
check("writes are POST or DELETE", writes.every((t) => t.method === "POST" || t.method === "DELETE"));
check("only writes carry write:true", TOOLS.every((t) => Boolean(t.write) === (t.method === "POST" || t.method === "DELETE")));
// A tool whose path carries a {name} template must list it in pathParams, and
// nothing else may claim pathParams (it is meaningless without a template).
check("pathParams match {name} templates in path", TOOLS.every((t) => {
  const templated = [...(t.path.matchAll(/\{([^}]+)\}/g) || [])].map((m) => m[1]);
  const declared = t.pathParams || [];
  return JSON.stringify([...templated].sort()) === JSON.stringify([...declared].sort());
}));

// Previously-walled endpoints are now first-class tools: media/upload (base64
// image in a JSON body), customer/session and user_login (session bootstrap, JSON
// body). Each reads a JSON request body, so it sets jsonBody:true and is a POST
// write. dm/send is also live (below).
const JSON_BODY_WRITES = ["twitter_media_upload", "twitter_customer_session", "twitter_user_login", "twitter_article_update_content"];
check("json-body writes present: POST + write + jsonBody", JSON_BODY_WRITES.every((n) => {
  const t = TOOLS.find((x) => x.name === n);
  return t && t.method === "POST" && t.write === true && t.jsonBody === true;
}));
check("only the json-body tools set jsonBody", TOOLS.every((t) => !t.jsonBody || JSON_BODY_WRITES.includes(t.name)));
// New read tools (account/billing + trends) are read-only; account reads live on
// the un-prefixed /account/* path (billing proxy), not under /twitter/.
const NEW_READS = ["twitter_trends", "twitter_trends_locations", "twitter_account_me", "twitter_account_payments"];
check("new read tools present and read-only", NEW_READS.every((n) => { const t = TOOLS.find((x) => x.name === n); return t && !t.write; }));
check("account tools use /account/* path", ["twitter_account_me", "twitter_account_payments"].every((n) => TOOLS.find((t) => t.name === n)?.path.startsWith("/account/")));
check("dm_send present and is a write", TOOLS.find((t) => t.name === "twitter_dm_send")?.method === "POST" && TOOLS.find((t) => t.name === "twitter_dm_send")?.write === true);

// The destructive (reversing) writes are flagged for client warnings.
const DESTRUCTIVE = ["twitter_delete_tweet", "twitter_unfavorite_tweet", "twitter_unretweet", "twitter_unbookmark_tweet", "twitter_unfollow_user", "twitter_article_unpublish", "twitter_article_delete", "twitter_monitor_delete", "twitter_monitor_webhook_delete"];
check("destructive writes flagged", DESTRUCTIVE.every((n) => TOOLS.find((t) => t.name === n)?.destructive === true));

// Monitoring family (task #14/#488): the first tools in this catalog that carry
// a REST path parameter (/monitor/{id}, /webhook/{id}, /webhook/{id}/test) and
// the first that serve more than one HTTP method on the very same path
// (/monitor/{id} is POST to update, DELETE to remove; /monitor and /webhook are
// each GET to list, POST to create).
const MONITORING = [
  "twitter_monitor_create", "twitter_monitor_list", "twitter_monitor_update",
  "twitter_monitor_delete", "twitter_monitor_health", "twitter_monitor_deliveries",
  "twitter_monitor_webhook_create", "twitter_monitor_webhook_list",
  "twitter_monitor_webhook_delete", "twitter_monitor_webhook_test",
];
check("all monitoring tools present", MONITORING.every((n) => TOOLS.some((t) => t.name === n)));
check("monitor DELETE tool present and is a real DELETE write", (() => {
  const t = TOOLS.find((x) => x.name === "twitter_monitor_delete");
  return t && t.method === "DELETE" && t.write === true && t.destructive === true;
})());
check("webhook DELETE tool present and is a real DELETE write", (() => {
  const t = TOOLS.find((x) => x.name === "twitter_monitor_webhook_delete");
  return t && t.method === "DELETE" && t.write === true && t.destructive === true;
})());
check("monitor update (POST) and monitor delete (DELETE) share one REST path but differ in method", (() => {
  const upd = TOOLS.find((x) => x.name === "twitter_monitor_update");
  const del = TOOLS.find((x) => x.name === "twitter_monitor_delete");
  return upd && del && upd.path === del.path && upd.method === "POST" && del.method === "DELETE";
})());
check("path-templated tools carry a matching pathParams entry", (() => {
  const templated = TOOLS.filter((t) => t.name === "twitter_monitor_update" || t.name === "twitter_monitor_delete" || t.name === "twitter_monitor_health" || t.name === "twitter_monitor_webhook_delete" || t.name === "twitter_monitor_webhook_test");
  return templated.length === 5 && templated.every((t) => Array.isArray(t.pathParams) && t.pathParams.includes("id") && t.shape.id);
})());

// Spot-check that the key new tools landed.
const EXPECTED_NEW = [
  "twitter_user_about", "twitter_user_affiliates", "twitter_check_follow_relationship",
  "twitter_user_tweets_complete", "twitter_user_likes", "twitter_followers_you_know",
  "twitter_home_timeline", "twitter_bookmarks", "twitter_bookmark_search",
  "twitter_dm_list", "twitter_dm_conversation",
  "twitter_create_tweet", "twitter_delete_tweet", "twitter_favorite_tweet",
  "twitter_retweet", "twitter_bookmark_tweet", "twitter_follow_user",
];
check("all expected new tools present", EXPECTED_NEW.every((n) => TOOLS.some((t) => t.name === n)));

check("required-arg tools declare a required field", ["twitter_advanced_search", "twitter_user_search", "twitter_user_info", "twitter_user_info_by_id", "twitter_list_members", "twitter_user_mentions", "twitter_create_tweet", "twitter_follow_user", "twitter_dm_conversation"].every((n) => {
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
check("buildQuery keeps tweet text for writes", buildQuery({ text: "gm world", reply_to: "123" }) === "text=gm+world&reply_to=123");
// count is zod .positive() upstream so 0 never reaches buildQuery; the builder itself
// keeps any non-empty stringified value (it is a dumb stringifier, not a validator).
check("buildQuery stringifies numeric 0 as count=0", buildQuery({ count: 0 }) === "count=0");

// Path-param substitution (backs the monitor/webhook {id} tools).
check("resolvePathParams substitutes {id} and strips it from args", (() => {
  const { path, args } = resolvePathParams("/twitter/monitor/{id}", ["id"], { id: "abc-123", status: "paused" });
  return path === "/twitter/monitor/abc-123" && !("id" in args) && args.status === "paused";
})());
check("resolvePathParams URL-encodes the substituted value", (() => {
  const { path } = resolvePathParams("/twitter/webhook/{id}", ["id"], { id: "a b/c" });
  return path === "/twitter/webhook/a%20b%2Fc";
})());
check("resolvePathParams with no pathParams is a no-op passthrough", (() => {
  const { path, args } = resolvePathParams("/twitter/monitor", [], { handle: "elonmusk" });
  return path === "/twitter/monitor" && args.handle === "elonmusk";
})());
check("resolvePathParams throws MissingPathParamError on a missing value", (() => {
  try {
    resolvePathParams("/twitter/monitor/{id}", ["id"], {});
    return false;
  } catch (e) {
    return e instanceof MissingPathParamError && e.paramName === "id";
  }
})());
check("resolvePathParams throws on an empty-string value too", (() => {
  try {
    resolvePathParams("/twitter/monitor/{id}", ["id"], { id: "" });
    return false;
  } catch (e) {
    return e instanceof MissingPathParamError;
  }
})());

console.log(`tools.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
