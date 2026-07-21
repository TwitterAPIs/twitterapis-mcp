// Unit tests for the tool catalog + query builder. No network, no SDK server.
import { TOOLS, buildQuery } from "../src/tools.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("  FAIL:", name); } };

const reads = TOOLS.filter((t) => !t.write);
const writes = TOOLS.filter((t) => t.write);

// Catalog shape (full parity: reads + writes)
check("47 tools", TOOLS.length === 47);
check("33 reads", reads.length === 33);
check("14 writes", writes.length === 14);
check("names unique", new Set(TOOLS.map((t) => t.name)).size === TOOLS.length);
check("paths unique", new Set(TOOLS.map((t) => t.path)).size === TOOLS.length);
check("all names twitter_*", TOOLS.every((t) => /^twitter_[a-z0-9_]+$/.test(t.name)));
check("all paths /twitter/* or /account/*", TOOLS.every((t) => t.path.startsWith("/twitter/") || t.path.startsWith("/account/")));
check("all have a real description", TOOLS.every((t) => typeof t.description === "string" && t.description.length > 20));
check("all have an object shape", TOOLS.every((t) => t.shape && typeof t.shape === "object" && !Array.isArray(t.shape)));

// Method discipline: reads are GET (no method or "GET"), writes are POST.
check("reads have no POST method", reads.every((t) => !t.method || t.method === "GET"));
check("writes are POST", writes.every((t) => t.method === "POST"));
check("only writes carry write:true", TOOLS.every((t) => Boolean(t.write) === (t.method === "POST")));

// Previously-walled endpoints are now first-class tools: media/upload (base64
// image in a JSON body), customer/session and user_login (session bootstrap, JSON
// body). Each reads a JSON request body, so it sets jsonBody:true and is a POST
// write. dm/send is also live (below).
const JSON_BODY_WRITES = ["twitter_media_upload", "twitter_customer_session", "twitter_user_login"];
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
const DESTRUCTIVE = ["twitter_delete_tweet", "twitter_unfavorite_tweet", "twitter_unretweet", "twitter_unbookmark_tweet", "twitter_unfollow_user"];
check("destructive writes flagged", DESTRUCTIVE.every((n) => TOOLS.find((t) => t.name === n)?.destructive === true));

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

console.log(`tools.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
