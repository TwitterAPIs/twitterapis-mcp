// Playbooks and provenance: the two things this package serves over the MCP
// RESOURCE primitive rather than as tools.
//
// WHY RESOURCES AND NOT TOOLS. src/tools.js is generated, and the generator is
// bijective with the vendored REST contract: every spec endpoint needs exactly
// one tool and every tool needs a real (method, path) in the spec, or the build
// refuses to emit (scripts/gen-tools.mjs, "spec endpoint ... has NO tool" and
// "targets endpoint ..., which the vendored spec does not have"). So a tool that
// wraps no endpoint cannot exist in this package, by design. A recipe an agent
// follows and the provenance of a row it already holds are both read-only
// context, which is what resources/list and resources/read are for, so they fit
// the primitive that is actually open here instead of forcing a tool-shaped hole
// in a catalog whose whole value is that it matches the API exactly.
//
// WHAT A PLAYBOOK IS. A short recipe an agent runs with the tools the catalog
// already lists. It is fetched only when a client asks for it (the MCP spec calls
// resources application-driven), so it costs nothing in context until it is read.
//
// A RESOURCE DESCRIPTION IS LISTED, A RESOURCE BODY IS FETCHED. Clients show the
// description in resources/list beside every tool description, so the description
// is held to the same Connectors Directory attestation as a tool description:
// product facts, no model instructions, no tool names, no hidden text
// (test/description-compliance.mjs reads both). The BODY is only ever returned
// for a URI the caller asked for by name, so it names tools freely, the way the
// server instructions do.

export const PLAYBOOK_MIME = "text/markdown";

// ── Playbooks ────────────────────────────────────────────────────────────────

const LAUNCH_DAY_MONITOR = `# Launch-day monitor

Watch a launch in near real time and keep a record of who amplified it.

## Before the launch

1. \`twitter_monitor_create\` with the handle or keyword you are launching under.
   Monitors cost no credits; the monitoring plan is the paywall, not per-call
   credits, so a plan slot has to be free or creation fails with a slot limit.
2. \`twitter_monitor_webhook_create\` if you want the matches pushed somewhere
   instead of polled. \`twitter_monitor_webhook_test\` proves the endpoint answers
   before launch day, when a silent webhook is expensive.
3. \`twitter_monitor_health\` to confirm the stream is live. Read stream liveness
   first and coverage second; unknown or null is unanswered, not healthy.

## During the launch

4. \`twitter_tweet_detail\` on the launch post every 10 to 15 minutes for the
   true view, reply, repost and quote counts. The quote count here is the real
   total; a search-backed quote listing is a sample of it.
5. \`twitter_tweet_quotes\` and \`twitter_tweet_retweeters\` for who amplified,
   paging with the cursor until it comes back null. A null cursor with a
   truncated listing status is a partial answer, so widen the timeframe rather
   than reporting the partial count as the total.
6. \`twitter_advanced_search\` for mentions that do not quote the post. Search is
   freshness-sensitive and is not served from a cache, so a repeated query
   genuinely re-reads X rather than replaying an earlier answer.

## After

7. \`twitter_monitor_deliveries\` shows where each match went, which is the record
   of what the monitor actually caught rather than what it was configured to catch.
8. \`twitter_user_about_batch\` over the amplifier handles collected in step 5,
   so follower counts and bios land in one call instead of one call per handle.
9. \`twitter_monitor_delete\` or \`twitter_monitor_update\` when the launch window
   closes, so the plan slot is free for the next one.

## What this costs

Monitor, webhook and account tools are free. The reads in steps 4 to 6 and 8 are
priced per call, and each tool's own description states its price.
`;

const COMPETITOR_FOLLOWER_OUTREACH = `# Competitor-follower outreach

Build a qualified list from who follows an account in your market, then reach the
people on it from your own linked account.

## Build the list

1. \`twitter_user_info\` on the competitor handle for the numeric user id the
   follower tools take. A handle that 404s here is a typo; a handle that resolves
   but looks wrong is worth checking with \`twitter_user_status\`, which tells a
   suspension from a misspelling.
2. \`twitter_user_verified_followers\` first when the list needs to be short and
   high signal, or \`twitter_user_followers\` for the full set. Page with the
   cursor until it is null and keep the cursor between runs; restarting from the
   first page re-reads and re-bills work you already have.
3. \`twitter_user_about_batch\` over the ids collected, which returns bio,
   follower count and location for many users in one call.

## Qualify

4. \`twitter_user_tweets\` on the shortlist for whether the account actually
   posts, and what about. An account with followers and no posts in a year is a
   list entry, not a prospect.
5. \`twitter_check_follow_relationship_batch\` to drop anyone you already follow
   or who already follows you, so first contact is not a second contact.

## Reach out

Steps 6 and 7 act as your own linked X account, so an X session has to be linked
first. \`playbook://link-x-account\` is the walk-through.

6. \`twitter_follow_user\` on the qualified set, spread over days rather than in
   one burst.
7. \`twitter_dm_send\` for the ones who follow back, or a public reply via
   \`twitter_create_tweet\` where a DM would be cold. \`twitter_dm_list\` gives the
   conversation id an existing thread needs.

## Keep it

8. \`twitter_list_create\` and \`twitter_list_add_member\` to hold the qualified
   set as an X list, so the next pass starts from the list instead of rebuilding
   it from the competitor's followers.
`;

const ACCOUNT_AUDIT = `# Account audit

A reproducible read of one account: what it is, what it posts, what lands, and
who is actually listening.

## Identity

1. \`twitter_user_info\` for the profile, follower and following counts, and the
   numeric id every other tool here takes.
2. \`twitter_user_status\` to separate a live account from a suspended or
   restricted one before reading anything into low numbers.
3. \`twitter_user_about\` for the fuller profile record, including the fields the
   compact user object leaves out.

## Output

4. \`twitter_user_tweets\` for original posts and \`twitter_user_tweets_and_replies\`
   for the conversational half. The difference between the two is the account's
   real posting mix, which a single endpoint cannot show.
5. \`twitter_user_media\` for how much of the output carries an image or video.
6. \`twitter_user_mentions\` for inbound attention the account did not create.

## Reach

7. \`twitter_audience_summary\` for the aggregate read of the follower base.
8. \`twitter_user_verified_followers\` and \`twitter_user_followers_v2\` for who
   those followers are. Page to a null cursor before quoting any share, because a
   share computed on one page is a share of that page.
9. \`twitter_followers_you_know\` for overlap with your own graph. This one acts
   as your linked X account, so it needs a session.

## Engagement

10. \`twitter_tweet_detail\` on the five or six top posts from step 4 for true
    view, reply, repost and quote counts.
11. \`twitter_tweet_replies\` on those posts for whether the replies are
    conversation or noise.

## Reporting

State the window every number came from and the cursor state each listing ended
on. A follower count read today and an engagement rate computed over a quarter
are two observation windows and do not divide into each other.
`;

const LINK_X_ACCOUNT = `# Link an X account

Writes and account-only reads (likes, bookmarks, DMs, home timeline, follow, post)
act as a real X account. Of the catalog's tools, 47 run as the caller's linked
account and the rest run on the shared pool behind the API key. This is the
sequence that gets one linked, and the states it can end in.

## 1. Find out which state you are in

\`twitter_customer_session_status\` is free and takes no arguments. It is the only
way to tell "never linked" from "linked but expired": a failing call reports both
the same way, because a dead session is filtered out of the lookup and reads as no
session at all.

- \`registered: false\` means no account has ever been linked on this key.
- \`status: "dead"\` means one was linked and X has since rejected the cookies.
  Re-linking replaces it; there is nothing to clean up first.
- \`status: "ok"\` means a session is live, and the username and X user id it
  resolved to are in the same response. If that is not the account you expected,
  \`twitter_customer_session_delete\` clears it before you link the right one.

The response also carries an egress block, which says whether calls leave over a
customer-supplied proxy or the shared address. \`playbook://residential-egress\`
covers that.

## 2. Pick how to link

There are two ways in, and they are not interchangeable.

**\`twitter_customer_session\`** takes \`auth_token\` and \`ct0\` cookies you already
hold. It is free, it returns in a normal request, and it validates the cookies
against X before answering, so a bad pair is rejected at registration rather than
at the first real call. Use it whenever you have the cookies.

**\`twitter_user_login\`** takes a username and password and mints the cookies by
driving a real browser session. It costs $0.01, billed only on success, and it is
capped at 10 attempts an hour per key.

## 3. The login timing problem, if you use the password path

The login can take up to 120 seconds, and a tool call times out at 30 by default.
A login that times out at the client has not necessarily failed at the server, so
the correct move after a timeout is to raise the client timeout
(\`TWITTERAPIS_TIMEOUT_MS\`) and check \`twitter_customer_session_status\` before
retrying. Retrying blind burns one of the ten hourly attempts and can link an
account that was already linked a moment earlier.

Two-factor accounts need \`totp_secret\` supplied up front, in the same call. The
secret is used to generate the code server side. There is no endpoint that accepts
a code after the fact, so a login that reaches a code prompt without a secret ends
there.

## 4. The endings that are not failures

Some outcomes mean the account needs attention on X itself, and no retry here
changes them:

- an email or phone confirmation step, which has to be cleared from the account,
  after which the same call works
- a one-time code mailed to the account's address, same shape
- a locked account, which has to be confirmed from the X app
- a suspended account, which ends the attempt for good
- a login that resolves to a different account than the one requested, which
  usually means the credentials belong to that other account

## 5. Confirm

\`twitter_customer_session_status\` again. \`status: "ok"\` with the expected
username is the only confirmation that counts; a login response that returned
without an error is weaker evidence than the stored state.

## What a linked session unlocks

Posting, deleting, liking, reposting, bookmarking, following, DMs, drafts,
scheduled posts, articles, list membership changes, profile and media updates,
the home timeline, and the bookmark and like histories. Search, user lookups,
tweet detail, trends, communities, spaces and monitors need no session at all.

## Housekeeping

One session is stored per API key, with no history, so re-linking replaces what
was there. The cookies are encrypted at rest and are never returned by any tool.
\`twitter_customer_session_delete\` is free and removes them.
`;

const RESIDENTIAL_EGRESS = `# Residential egress

Where the calls made on behalf of your linked X account leave from, and how to
control it.

## There is no install step

A proxy is not installed and has no state of its own. It is a value attached to a
session or to a call, and there are three places to attach it. All three are
already in the catalog.

1. **At registration.** \`twitter_customer_session\` takes \`proxy_url\` (and
   \`user_agent\`) alongside the cookies. The value is stored with the session and
   is used for every later call made under it.
2. **At login.** \`twitter_user_login\` takes the same two, and the login itself
   is driven through the proxy, so the cookies are minted from the address they
   will later be used from.
3. **Per call.** The 47 session tools each take \`auth_token\`, \`ct0\`,
   \`proxy_url\` and \`user_agent\` directly. Supplied there, they travel as request
   headers rather than in the URL, and they override the stored session for that
   one call. This is how one API key can act as several accounts.

A hosted deployment can hide the per-call arguments, in which case routes 1 and 2
are the only ones available.

## What a URL has to be

A public host. A private, loopback or link-local address is refused with a
proxy-host error before anything is attempted, so a proxy pointed at an internal
network fails at registration rather than quietly succeeding.

## What happens if you supply nothing

Calls leave over the service's own shared address. That works, and for reads it
is usually what you want. For writes from a linked account it means your account
and other accounts share an address, which some actions on X treat differently
from a consistent residential one.

## Checking what is in force

\`twitter_customer_session_status\` returns an egress block naming the source in
use and whether a customer proxy is in effect. No tool returns the proxy URL
itself, for the same reason none returns the cookies.

## Changing it

Register the session again with the new \`proxy_url\`. There is one session row per
key and re-registering replaces it, so there is no separate update or removal
step. Passing the old cookies with a new proxy value is enough.
`;

export const PLAYBOOKS = [
  {
    uri: "playbook://launch-day-monitor",
    name: "launch-day-monitor",
    title: "Launch-day monitor",
    description:
      "A recipe for watching an X launch in near real time with this server's monitoring and read tools: set up a monitor and webhook before the launch, track true counts and amplifiers during it, and collect the amplifier profiles after.",
    text: LAUNCH_DAY_MONITOR,
  },
  {
    uri: "playbook://competitor-follower-outreach",
    name: "competitor-follower-outreach",
    title: "Competitor-follower outreach",
    description:
      "A recipe for turning another account's followers into a qualified outreach list with this server's follower, profile and relationship reads, then contacting them from a linked X account.",
    text: COMPETITOR_FOLLOWER_OUTREACH,
  },
  {
    uri: "playbook://account-audit",
    name: "account-audit",
    title: "Account audit",
    description:
      "A recipe for auditing one X account with this server's profile, timeline, media, mention, audience and engagement reads, including which numbers share an observation window.",
    text: ACCOUNT_AUDIT,
  },
  {
    uri: "playbook://link-x-account",
    name: "link-x-account",
    title: "Link an X account",
    description:
      "The account-linking sequence for this server: how to read the current link state, the two ways to link (stored cookies or a password login), the login's 120-second ceiling against a 30-second call timeout, the outcomes that need attention on X itself, and what a linked session unlocks.",
    text: LINK_X_ACCOUNT,
  },
  {
    uri: "playbook://residential-egress",
    name: "residential-egress",
    title: "Residential egress",
    description:
      "How outbound address control works on this server: the three places a proxy URL and user agent attach (session registration, password login, per call), what a URL has to be, what happens when none is supplied, and how the session status read reports which source is in force.",
    text: RESIDENTIAL_EGRESS,
  },
];

// ── Provenance ───────────────────────────────────────────────────────────────

// Provenance of a returned row, addressed by the tool that produced it. Every row
// this package returns is the body of exactly one REST call, so the tool name is
// the whole key.
//
// WHAT IS AND IS NOT HERE. Everything below is derived from the committed catalog:
// the endpoint and method the row came from, whether the call acted as the
// caller's own linked X account or the service's shared pool, whether it was a
// read or a write, what it cost, and where it is documented. Row-level upstream
// facts (when the service fetched it from X, whether it was served from an
// upstream cache, which account read it) are not in any response this package
// receives, so they are absent rather than guessed. Adding them means the REST
// API returning them first.
export const PROVENANCE_URI_TEMPLATE = "provenance://tool/{tool_name}";
export const provenanceUri = (toolName) => `provenance://tool/${toolName}`;

const COST_RE = /\bCost: (Free|\$\d+(?:\.\d+)?)[^.]*\./;
const DOCS_RE = /\bDocs: (https:\/\/\S+)\s*$/;

export function provenanceFor(toolName, tools) {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) return null;
  const method = tool.method || "GET";
  // headerArgs are the per-call X session credentials (auth_token, ct0, ...). A
  // tool that accepts them is one the API serves with the caller's own linked X
  // account; a tool that does not is served from the shared pool behind the key.
  // twitter_customer_session is the one tool whose credentials are its payload
  // rather than per-call headers, so it is named explicitly rather than inferred.
  const actsAsLinkedAccount = (tool.headerArgs || []).length > 0;
  const costMatch = COST_RE.exec(tool.description || "");
  const docsMatch = DOCS_RE.exec(tool.description || "");
  return {
    tool: tool.name,
    endpoint: `${method} ${tool.path}`,
    kind: tool.write ? "write" : "read",
    destructive: Boolean(tool.destructive),
    served_by: actsAsLinkedAccount ? "the caller's linked X account" : "the service's shared account pool",
    cost: costMatch ? (costMatch[1] === "Free" ? "free" : `${costMatch[1]} per call`) : "unstated",
    docs: docsMatch ? docsMatch[1] : null,
    not_available:
      "Row-level upstream provenance (when the service read it from X, whether an upstream cache answered, which account read it) is not in any response this server receives.",
  };
}
