// Unit tests for the tool catalog + query builder. No network, no SDK server.
import { TOOLS, buildQuery } from "../src/tools.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error("  FAIL:", name); } };

const reads = TOOLS.filter((t) => !t.write);
const writes = TOOLS.filter((t) => t.write);

// Catalog shape (full parity: reads + writes)
check("40 tools", TOOLS.length === 40);
check("29 reads", reads.length === 29);
check("11 writes", writes.length === 11);
check("names unique", new Set(TOOLS.map((t) => t.name)).size === TOOLS.length);
check("paths unique", new Set(TOOLS.map((t) => t.path)).size === TOOLS.length);
check("all names twitter_*", TOOLS.every((t) => /^twitter_[a-z0-9_]+$/.test(t.name)));
check("all paths /twitter/*", TOOLS.every((t) => t.path.startsWith("/twitter/")));
check("all have a real description", TOOLS.every((t) => typeof t.description === "string" && t.description.length > 20));
check("all have an object shape", TOOLS.every((t) => t.shape && typeof t.shape === "object" && !Array.isArray(t.shape)));

// Method discipline: reads are GET (no method or "GET"), writes are POST.
check("reads have no POST method", reads.every((t) => !t.method || t.method === "GET"));
check("writes are POST", writes.every((t) => t.method === "POST"));
check("only writes carry write:true", TOOLS.every((t) => Boolean(t.write) === (t.method === "POST")));

// Excluded endpoints must NOT be in the catalog: media/upload (its base64 body
// does not fit the query-string transport, and create_tweet already takes
// pre-uploaded media_ids) and the session-management paths (not data tools).
// dm/send was previously walled and is now live, so it IS included (below).
const EXCLUDED = ["/twitter/media/upload", "/twitter/user/user_login", "/twitter/customer/session"];
check("no walled/excluded paths", !TOOLS.some((t) => EXCLUDED.includes(t.path)));
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

console.log(`tools.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
