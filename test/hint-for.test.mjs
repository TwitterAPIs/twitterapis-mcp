#!/usr/bin/env node
// hint-for.test.mjs: the error hint appended to a failed call.
//
// The 404 hint used to be status-only, so EVERY 404 told the caller that "the
// user, tweet, or list may have been deleted", including a 404 for a feedback
// report id. That sent a customer chasing a report off to look at a tweet. The
// hint now varies by PATH for 404 and only for 404.
//
// No network: hintFor is pure, so this asserts the exact strings a model reads.
import { hintFor } from "../src/index.js";

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) pass++;
  else { fail++; console.error("  FAIL:", name, detail); }
};

// --- the defect this file exists for -------------------------------------
const fb = hintFor(404, "/feedback/7c9e6679-7425-40de-944b-e07fc1f90ae7");
check("a feedback 404 does NOT mention a tweet", !/tweet/i.test(fb), fb);
check("a feedback 404 does NOT mention a user", !/\buser\b/i.test(fb), fb);
check("a feedback 404 does NOT mention a list", !/\blist\b/i.test(fb), fb);
check("a feedback 404 names the feedback report", /feedback report/i.test(fb), fb);
check("a feedback 404 says where the id comes from", /twitter_feedback_send/.test(fb), fb);
check("the list route gets it too", hintFor(404, "/feedback") === fb, hintFor(404, "/feedback"));

// --- the sibling that would have been next --------------------------------
const acct = hintFor(404, "/account/me");
check("an account 404 does not mention a tweet", !/tweet/i.test(acct), acct);
check("an account 404 names the account resource", /account resource/i.test(acct), acct);

// --- NEGATIVE CONTROL: the default must still be the timeline sentence -----
// Without this, deleting the whole table would still pass every case above.
const tw = hintFor(404, "/twitter/tweet/detail");
check("a twitter 404 KEEPS the user/tweet/list sentence", /user, tweet, or list/.test(tw), tw);
check("an unknown path falls back to the default", hintFor(404, "/nope") === tw, hintFor(404, "/nope"));
check("an empty path does not throw and falls back", hintFor(404, "") === tw, hintFor(404, ""));
check("a null path does not throw and falls back", hintFor(404, null) === tw, String(hintFor(404, null)));

// --- ONLY the 404 varies. Prove the others are path-independent. ----------
// A per-path branch on a status that is about the KEY or OUR service would be
// surface area with no reader, so this pins that they stay identical.
for (const status of [401, 402, 403, 409, 429, 500, 503]) {
  const a = hintFor(status, "/feedback/abc");
  const b = hintFor(status, "/twitter/tweet/detail");
  check(`${status} reads identically on every path`, a === b, `${a} vs ${b}`);
  check(`${status} is non-empty`, a.length > 0, a);
}
check("an unmapped status yields no hint", hintFor(418, "/feedback") === "", hintFor(418, "/feedback"));

// --- EXACT-STRING PINS ------------------------------------------------------
// Everything above this line is a PROPERTY check: does the feedback hint avoid the
// word "tweet", does it mention a feedback report, does the default still carry the
// timeline sentence. Those catch the original defect and they are worth keeping.
//
// They do NOT catch a REWORD. A future edit could rewrite any of these three
// sentences into something wrong, or copy the timeline sentence back onto the
// feedback route in different words, and every property check above would still
// pass. That is exactly how the original defect survived: it read plausibly.
//
// So the three strings a model actually receives are pinned BYTE FOR BYTE. A
// deliberate reword is then a two-line change, this file and src/index.js, made on
// purpose. A drive-by reword is a failing test. The point is not that these
// sentences are sacred; it is that changing them cannot happen QUIETLY.
const PINNED = {
  "/feedback": " (not found. No feedback report with that id on this account, and an id from another account will not resolve here. Use the id returned by twitter_feedback_send action=send.)",
  "/account/me": " (not found. That account resource does not exist for this key.)",
  "/twitter/tweet/detail": " (not found. The user, tweet, or list may have been deleted or the id is wrong)",
};
for (const [path, expected] of Object.entries(PINNED)) {
  const actual = hintFor(404, path);
  check(
    `404 on ${path} is byte-identical to its pinned string`,
    actual === expected,
    `\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`,
  );
}

// The pin above is only as good as its ability to fail. If `hintFor` returned the
// empty string for everything, each comparison would fail loudly, which is right.
// But a subtler regression is the ORIGINAL one: the feedback route silently falling
// back to the default. Assert the two are DIFFERENT strings, so a future refactor
// that deletes the NOT_FOUND_HINTS table cannot pass by making them identical.
check(
  "the feedback 404 and the default 404 are still DIFFERENT strings",
  hintFor(404, "/feedback") !== hintFor(404, "/twitter/tweet/detail"),
  "the feedback route has fallen back to the default hint again",
);
check(
  "the account 404 and the default 404 are still DIFFERENT strings",
  hintFor(404, "/account/me") !== hintFor(404, "/twitter/tweet/detail"),
  "the account route has fallen back to the default hint again",
);
// And prove this file's comparison operator can actually fail, so a green run is
// evidence rather than decoration.
check(
  "the pin comparison DOES reject a near-miss (self-test of the check itself)",
  " (not found. That account resource does not exist for this key)" !== PINNED["/account/me"],
  "the pin comparison accepted a string missing its final period",
);

console.log(`hint-for.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
