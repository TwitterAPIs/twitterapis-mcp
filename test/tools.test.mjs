// Unit tests for the tool catalog + query builder. No network, no SDK server.
import { TOOLS, buildQuery, resolvePathParams, MissingPathParamError } from "../src/tools.js";
import { readFileSync } from "node:fs";

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
// Bumped 75 -> 76 on 2026-08-16 with twitter_user_status (GET /user/status), per
// the rule directly above: bump deliberately, in the same commit as the tool.
// Bumped 80 -> 86 on 2026-08-16 with the five community reads
// (twitter_community_info / _members / _moderators / _tweets / _memberships) and
// twitter_tweet_quotes, all GET reads, so writes are unchanged at 31.
// Bumped 86 -> 91 on 2026-08-17 with the X List operation family: two reads
// (twitter_list_tweets, twitter_list_timeline) and three writes
// (twitter_list_add_member, twitter_list_remove_member, twitter_list_create).
// Bumped 94 -> 95 on 2026-08-28 fixing the generator-drift: PR #39 added
// twitter_customer_session_status (GET, read) by hand-editing src/tools.js
// directly instead of going through scripts/tools.overrides.mjs, so this
// constant was never bumped and the generator never learned the endpoint
// existed. Backfilled into the override + refreshed the vendored spec so the
// tool is generated again, not hand-maintained; writes unchanged at 34.
// Bumped 95 -> 96 on 2026-08-31 with twitter_monitor_webhook_redrive (POST,
// write), which replays deliveries that dead-lettered while a customer endpoint
// was down. Writes 34 -> 35, reads unchanged at 61, so the MCP catalog is now at
// exact parity with the API: 96 endpoints, 61 reads and 35 writes.
// Bumped 96 -> 98 on 2026-09-04 with twitter_feedback_send (POST /feedback, a
// write with a local draft queue) and twitter_feedback_get (GET /feedback/{id},
// a read): 98 endpoints, 62 reads and 36 writes, still exact parity.
// Bumped 98 -> 99 on 2026-09-05 with twitter_feedback_list (GET /feedback), which
// the API shipped after 0.9.7 and which no tool covered: 99 endpoints, 63 reads
// and 36 writes, still exact parity.
// Bumped 99 -> 106 on 2026-09-13 with the seven compose tools (#123): five writes
// (draft create/edit/delete, scheduled create/delete) and two reads (draft/list,
// scheduled/list). The API had shipped them dark behind two env flags, verified
// them end to end against a real customer session, then published them and removed
// the flags. 106 endpoints, 65 reads and 41 writes, still exact parity.
// Bumped 106 -> 107 on 2026-09-13 with twitter_update_profile (#105), the one of
// the three profile writes that has been called end to end through the running
// service. Its two siblings, update_avatar and update_banner, stay UNPUBLISHED:
// they need a real image upload, so their host is an inference from
// update_profile's capture rather than an observation, and that is the reasoning
// that shipped a draft with no text in it earlier today.
//
// UNPUBLISHED IS NOT THE SAME AS UNREACHABLE, and an adversarial review of this
// release caught the difference. Those two routes sit behind PROFILE_WRITES_ENABLED
// on the API, and that flag is currently ON in production, so they answer rather
// than 503. They are absent from every published surface, which is what lets this
// package claim exact parity, but a caller who guesses the URL reaches them. The
// API-side fix is to turn the flag off once update_profile no longer needs it,
// which is exactly what the backend change accompanying this release makes possible.
// 107 endpoints, 65 reads and 42 writes, still exact parity.
const EXPECTED_TOOLS = 107;
const EXPECTED_READS = 65;
const EXPECTED_WRITES = 42;
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
check("all paths /twitter/* or /account/* or /oapi/x_user_stream/* or /feedback*", TOOLS.every((t) => t.path.startsWith("/twitter/") || t.path.startsWith("/account/") || t.path.startsWith("/oapi/x_user_stream/") || t.path === "/feedback" || t.path.startsWith("/feedback/")));
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
//
// Fixed 2026-08-16: the 5 monitor/webhook write tools below were shipped with
// jsonBody unset (defaulting to false, query-string args), but their backend
// handlers (createMonitorRoute, updateMonitorRoute, createWebhookRoute,
// addUserToMonitorTweetRoute, removeUserToMonitorTweetRoute) all read ONLY
// `await c.req.json()` with no query-string fallback -- unlike most write
// endpoints, which go through resolveBodyParam's dual-mode query-or-body
// resolution. Every call to any of these 5 tools failed with a 400 "Provide
// `handle`/`url`/... in the JSON body" error, live-reproduced against
// production before this fix (products/twitterapis-backend, monitor.ts /
// webhook.ts / the x_user_stream compat module).
const JSON_BODY_WRITES = [
  "twitter_feedback_send", // POST /feedback reads a JSON body (2026-09-04)
  "twitter_media_upload", "twitter_customer_session", "twitter_user_login", "twitter_article_update_content",
  "twitter_monitor_create", "twitter_monitor_update", "twitter_monitor_webhook_create",
  "twitter_x_user_stream_add_user", "twitter_x_user_stream_remove_user",
  // Added 2026-08-31 with the redrive tool. Its handler reads max_age_hours and
  // limit from the body only, so without jsonBody every call would go out as a
  // query string and 400, the same live failure the five tools above hit.
  "twitter_monitor_webhook_redrive",
  // Added 2026-09-13 (#105). The backend's route-body-modes.json classifies
  // updateProfileRoute "json-only", so body-mode-parity refuses the build unless
  // the tool sets jsonBody. That classification is CONSERVATIVE rather than
  // exact: the handler reads every field as `body.X ?? c.req.query("X")`, so a
  // query string would work too, but it uses a raw c.req.query() instead of the
  // param-compat helpers the classifier recognises. The error is in the safe
  // direction, since it forces the mode that always works.
  "twitter_update_profile",
];
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
const DESTRUCTIVE = ["twitter_delete_tweet", "twitter_unfavorite_tweet", "twitter_unretweet", "twitter_unbookmark_tweet", "twitter_unfollow_user", "twitter_article_unpublish", "twitter_article_delete", "twitter_monitor_delete", "twitter_monitor_webhook_delete", "twitter_list_remove_member"];
check("destructive writes flagged", DESTRUCTIVE.every((n) => TOOLS.find((t) => t.name === n)?.destructive === true));

// The X List family (task #2251): two reads that look like two spellings of one
// capability and are not, plus three session-backed writes. The two reads must
// stay DIFFERENT in their parameter sets, which is the only thing that separates
// them: list/tweets is search-backed so it carries since/until/include_replies,
// list/timeline is X's native feed so it carries none of the three. A future
// edit that "harmonises" them would silently make one answer the other's
// question, so the difference is pinned here rather than left to prose.
check("list read family present and read-only", ["twitter_list_members", "twitter_list_tweets", "twitter_list_timeline"].every((n) => {
  const t = TOOLS.find((x) => x.name === n);
  return t && !t.write && !t.method;
}));
check("list/tweets is the filterable (search-backed) feed", (() => {
  const t = TOOLS.find((x) => x.name === "twitter_list_tweets");
  return t && ["list_id", "since", "until", "include_replies", "count", "cursor"].every((a) => a in t.shape);
})());
check("list/timeline takes NO filters, only list_id + paging", (() => {
  const t = TOOLS.find((x) => x.name === "twitter_list_timeline");
  return t && JSON.stringify(Object.keys(t.shape)) === JSON.stringify(["list_id", "count", "cursor"]);
})());
check("list writes are POST writes on the customer's own session (inline creds exposed)", ["twitter_list_add_member", "twitter_list_remove_member", "twitter_list_create"].every((n) => {
  const t = TOOLS.find((x) => x.name === n);
  return t && t.method === "POST" && t.write === true && !t.jsonBody && t.shape.auth_token && t.shape.ct0;
}));

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

// twitter_user_tweets_complete is cursor-paged and truncating. These guard the
// exact drift shipped in 0.5.0: no cursor arg, and a "default 800" that the
// backend had already dropped to 200. Verified live 2026-07-20.
// Every assertion below is crash-safe (optional chaining + "" fallbacks) so each
// one fails by ASSERTION against the pre-fix catalog rather than throwing and
// aborting the run before the later checks get to speak.
const COMPLETE = TOOLS.find((t) => t.name === "twitter_user_tweets_complete");
const C_DESC = COMPLETE?.description ?? "";
const C_MAX = COMPLETE?.shape?.max?.description ?? "";
check("tweets_complete exposes a cursor arg (resume path)", !!COMPLETE?.shape?.cursor);
check("tweets_complete cursor is optional (omitted on first call)", COMPLETE?.shape?.cursor?.isOptional?.() === true);
// NB: JSON.stringify on a zod schema does NOT expose .describe() text, so this
// must read the description strings directly or it silently passes forever.
check("tweets_complete no longer claims the removed 800 default", !/default 800/i.test(C_MAX + " " + C_DESC));
check("tweets_complete documents the real 200 default", /default(?:s to)? 200\b/i.test(C_MAX));
check("tweets_complete documents max as a minimum, not a cap", /minimum target/i.test(C_MAX));
check("tweets_complete documents next_cursor as the completion signal", /next_cursor/i.test(C_DESC) && /not count/i.test(C_DESC));
check("tweets_complete warns the response can be truncated", /truncat/i.test(C_DESC));
check("tweets_complete documents flat per-call billing", /per CALL/i.test(C_DESC));
check("no tool promises a full history in one call", !TOOLS.some((t) => /full back-catalogue in one call|near-complete/i.test(t.description || "")));

// The server instructions ask for a rare-term control before an "ignored
// parameter" report: a generic query on a score-ordered sort returns the global
// listing, which reads exactly like a dropped parameter and is not one.
const INDEX_SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
check("instructions ask for a distinctive-value control before an ignored-parameter report", /re-run the call with a distinctive value that could only match if the parameter was honoured/.test(INDEX_SRC));
check("instructions say to retitle the report by what the control showed", /title it that way and say what the control showed/.test(INDEX_SRC));

console.log(`tools.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
