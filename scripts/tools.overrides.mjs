// AUTHORED BY HAND. This file is the other half of the catalog.
//
// scripts/gen-tools.mjs reads test/openapi.snapshot.json for the STRUCTURE it can
// prove (which endpoints exist, which params each one accepts, whether a param is
// required, and its base type) and reads THIS file for everything the spec cannot
// express:
//
//   - the agent-facing tool description, which is what a model actually reads to
//     decide whether and how to call a tool. The spec's own descriptions are
//     endpoint documentation for a human with the docs page open, they average a
//     fraction of the length, and they carry none of the "use X instead when Y"
//     routing between sibling tools.
//   - the per-arg descriptions, which carry cross-field rules a per-field spec has
//     nowhere to put, for example "Provide exactly one of username or user_id".
//   - the per-call inline credential block, which travels as x-* request headers
//     and therefore appears in no spec at all.
//   - the write / destructive / jsonBody flags, which drive the MCP annotations a
//     client shows before a mutating call, and which the spec does not model.
//
// Rules of the road:
//   - Every arg name here must be a real param of that endpoint in the spec, or
//     be marked header:true. The build FAILS otherwise.
//   - Every spec param must either appear in args or be listed in omit with a
//     reason. The build FAILS otherwise, so a param added upstream cannot be
//     silently ignored.
//   - required-ness and base type are DERIVED from the spec. Set them here only
//     to deviate deliberately, and say why in the neighbouring comment.
//   - After editing this file run `npm run build`.
//   - BEFORE adding a new write:true tool, or copy-pasting one as a template:
//     open the corresponding route handler in products/twitterapis-backend and
//     check whether it reads `c.req.json()` directly (needs jsonBody:true here)
//     or goes through resolveBodyParam/similar dual-mode query-or-body helper
//     (jsonBody can stay unset). Getting this wrong is NOT caught by any test
//     in THIS repo -- gen-tools.mjs and catalog-identity.mjs only check internal
//     consistency, never whether jsonBody actually matches what the backend
//     reads. Incident 2026-08-16: 5 tools (twitter_monitor_create/update,
//     twitter_monitor_webhook_create, twitter_x_user_stream_add_user/
//     remove_user) shipped with jsonBody unset while their backend handlers
//     read ONLY the JSON body -- every call to any of them failed with a 400,
//     for an unknown period, caught only by an independent code-review pass
//     that happened to trace one call path all the way into the sibling repo.
//     Verify with a REAL live call (see test/smoke.mjs for the pattern), not
//     just by reading the route -- a static read is a hypothesis, not proof.

/** Reusable arg runs. A tool references one as the string "@NAME". */
export const ARG_GROUPS = {
  // Response projection on every read (API 2026-09-23, docs components.parameters
  // fields/compact). Both are optional, GET-only, and never empty a body: the
  // envelope keys (ok, count, next_cursor, has_more) always survive. Exposed on
  // every read tool because a model paying per token for a 40-tweet page is the
  // caller these were built for.
  PROJECTION: [
    { name: "fields",
      describe:
        "Optional. Comma-separated dotted field paths to KEEP in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) always survive; any other top-level key you do not name is dropped. Use it to cut a page down to the fields you will actually read." },
    { name: "compact", enum: ["1", "true"],
      describe:
        "Optional. Set to \"1\" for the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. Trims what it recognises and, on its own, never turns a body into {}. Combine with fields to keep extra paths (then only the named paths and the envelope keys survive)." },
  ],
  // Paid partnership filter (API 2026-09-30, docs components.parameters
  // paid_promotion). Only on tools whose endpoint returns a top-level tweets
  // list: the spec attaches it to exactly those operations.
  PAID_PROMOTION: [
    { name: "paid_promotion", enum: ["only", "exclude"],
      describe:
        "Optional. Filter this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and does not fetch more, so a page can hold fewer tweets than asked for, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it." },
  ],
  // Opaque forward-only pagination cursor.
  CURSOR: [
    { name: "cursor",
      describe:
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page." },
  ],
  // Page size + cursor, in that order. The spec lists them in the
  // opposite order on some endpoints; the catalog is consistent instead.
  PAGINATION: [
    { name: "count", type: "int", min: 1, max: 200,
      // Measured live 2026-09-02 (main commit 088759b, which hand-edited the
      // GENERATED tools.js and was silently dropped by the next regeneration):
      // X caps search pages regardless of the value requested.
      describe:
        "Requested page size, capped at 200. Advisory only for this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested here, an upstream limit, not something this API controls. To retrieve more results, page with the cursor from the previous response rather than raising this value." },
    { name: "cursor",
      describe:
        "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call; pass on subsequent calls to fetch the next page." },
  ],
  // Either-or account reference. The spec marks username required on most of
  // these endpoints because it documents the common call; the catalog accepts
  // user_id instead, so both are optional here and the cross-field rule lives in
  // the descriptions.
  USER_REF: [
    { name: "username", required: false,
      describe:
        "Twitter/X handle WITHOUT the leading @ (e.g. \"elonmusk\", \"openai\"). Provide exactly one of username or user_id." },
    { name: "user_id",
      describe:
        "Numeric Twitter/X user id (e.g. \"44196397\"). Provide exactly one of username or user_id." },
  ],
  // Either-or tweet reference.
  TWEET_REF: [
    { name: "id",
      describe:
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Provide exactly one of id or url." },
    { name: "url",
      describe:
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Provide exactly one of id or url." },
  ],
  // Per-call inline credentials. Pass an account's own X session cookies to act
  // AS that account for this one call, without pre-registering a session, so a
  // single API key can act as many accounts (polling several inboxes, or posting
  // from a pool). Omit them to use the key's linked session. Marked header:true
  // so they appear in no spec and are exempt from the param cross-check.
  //
  // WHERE THEY ACTUALLY TRAVEL, corrected 2026-09-13 after an adversarial review
  // read src/index.js rather than this comment. There are TWO transports and the
  // text below used to name only one. On a query-string tool they are pulled out
  // of the args and sent as x-auth-token / x-ct0 / x-proxy-url / x-user-agent
  // request headers. On a jsonBody tool the whole arg object is serialised into
  // the request body, credentials included, and the API reads them back with
  // extractInlineCredentials(). Both work; the one thing that is true in both
  // cases, and the property that matters, is that they never become a query
  // parameter and so never reach a URL or an access log. Saying "sent as the
  // x-auth-token header" full stop was false for three tools.
  INLINE: [
    { name: "auth_token", required: false, header: true,
      describe:
        "Optional. The account's auth_token cookie, to act AS that account for this call (must be paired with ct0). Travels out of band: as the x-auth-token request header on most tools, or inside the JSON request body on the tools that take one. Never a query parameter, so it never reaches a URL or an access log." },
    { name: "ct0", required: false, header: true,
      describe:
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking tool. Never a query parameter." },
    { name: "proxy_url", required: false, header: true,
      describe:
        "Optional. Residential proxy URL to egress this call through. Recommended for writes: X soft-blocks writes from datacenter IPs as automated. Sent as the x-proxy-url request header, or in the JSON body on a body-taking tool." },
    { name: "user_agent", required: false, header: true,
      describe:
        "Optional. User-Agent string to send for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking tool." },
  ],
};

/** One entry per tool, in the order the catalog advertises them. */
export const TOOL_OVERRIDES = [
  // ── Reads: search + discovery ──────────────────────────────────────────────
  {
    name: "twitter_advanced_search",
    endpoint: "/tweet/advanced_search",
    description:
      "Search recent tweets using X's advanced-search operators. Supports from:, to:, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:links, -filter:replies, lang:en, and free-text. Returns tweet text, author info, engagement metrics, and a pagination cursor. Use product='Latest' for chronological results; 'Top' (default) for engagement-ranked. Example queries: 'AI agents min_faves:100', 'from:openai filter:links since:2024-01-01', '#buildinpublic -filter:replies lang:en'.",
    args: [
      { name: "query",
        describe:
          "Full advanced-search query string. Supports X operators: from:handle, to:handle, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:links, filter:images, filter:videos, -filter:replies, lang:en, #hashtag, \"exact phrase\". Example: 'from:openai min_faves:500 since:2024-01-01'." },
      { name: "product", enum: ["Top","Latest","Media","People"],
        describe:
          "Result ranking mode. 'Latest' = reverse-chronological (best for monitoring). 'Top' = engagement-ranked (best for finding popular tweets, default when omitted). 'Media' = tweets with images/video. 'People' = matching user accounts." },
      "@PAGINATION",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_user_search",
    endpoint: "/user/search",
    description:
      "Search for Twitter/X user accounts by display name or handle (X's People search; bio text is NOT searched, so a word that appears only in a bio returns no match). Returns matching profiles (username, display name, bio, follower count, verification status) with a pagination cursor. Use this to find brand handles, resolve a partial handle, or locate a person when you only know their name. To find accounts by what their bio says, use twitter_user_followers on a relevant account or twitter_advanced_search for tweets mentioning it, then filter the description field.",
    args: [
      { name: "query",
        describe:
          "Name, brand, or partial handle to search accounts for, matched against display name and handle. Examples: 'OpenAI', 'Sam Altman', 'stablecoin'." },
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_info",
    endpoint: "/user/info",
    description:
      "Get a user's complete public profile by their @handle: display name, bio, follower count, following count, verification status, location, website, account creation date, and pinned tweet. Use this before fetching tweets or followers to confirm the account exists and resolve the numeric user_id.",
    args: [
      { name: "username",
        describe:
          "Twitter/X handle WITHOUT the leading @ (e.g. 'elonmusk', 'openai', 'sama')." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_info_by_id",
    endpoint: "/user/info_by_id",
    description:
      "Get a user's complete public profile by their numeric user id. Identical response to twitter_user_info. Use this when you already have a user_id from a previous API response and want to avoid a handle lookup.",
    args: [
      { name: "user_id",
        describe:
          "Numeric Twitter/X user id (e.g. '44196397' for @elonmusk). Found in responses from other tools as user_id or author_id." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_status",
    endpoint: "/user/status",
    description:
      "Check whether a Twitter/X account is alive, suspended, or deleted. Returns a status field that is one of 'alive', 'suspended', 'not_found', or 'unavailable', plus the numeric id when the account is alive and X's own reason when it gives one. Use this instead of twitter_user_info when the QUESTION is whether the account still exists: user info answers a suspended account, a deleted account, and a handle that never existed all the same way, so it cannot tell a ban from a typo. Every outcome here is a successful response, so read the status field rather than treating a suspension as an error. A protected (private) account counts as alive, since protection is a visibility setting and not an account state.",
    args: [
      { name: "userName",
        describe:
          "Twitter/X handle WITHOUT the leading @ (e.g. 'elonmusk', 'openai', 'sama')." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_about",
    endpoint: "/user/user_about",
    description:
      "Get a user's full 'About' object: the structured profile facts X surfaces beyond the bio, including account category and professional/business labels, verification and identity-verification flags, joined date, location and linked website, follower/following counts, and X's 'About this account' transparency panel (the account's country, how the account was created, and its username-change history). Provide a username or a user_id. Use this to enrich a profile beyond what twitter_user_info returns.",
    args: [
      "@USER_REF",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_about_batch",
    endpoint: "/user/user_about/batch",
    description:
      "Get the 'About' object (account country, how the account was created, username-change history, verification and the rest of twitter_user_about) for up to 100 accounts in ONE call. Provide usernames or user_ids as a comma-separated list, never both. Results come back in request order, each with an about object or an error code (not_found is billed; forbidden is free but X refuses that account to everyone; rate_limited and unavailable are free and safe to retry). Billed per account X answered for, so use this instead of looping twitter_user_about when vetting a list of accounts, e.g. checking where a creator's audience sample is based. One batch per API key runs at a time: a second concurrent call gets 429 batch_in_progress (not billed), so run batches one after another. fields/compact apply inside each item's about object (fields=account_based_in); a results.* path returns about: {}.",
    args: [
      { name: "usernames",
        describe:
          "Comma-separated handles, with or without the leading @ (e.g. 'openai,naval,sama'). 1 to 100 after duplicates are removed." },
      { name: "user_ids",
        describe:
          "Comma-separated numeric user ids (e.g. '44196397,745273'), as an alternative to usernames. 1 to 100." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_affiliates",
    endpoint: "/user/affiliates",
    description:
      "List the affiliated accounts of an organization profile (the smaller accounts X displays under a company's 'Affiliated' badge, e.g. employees or sub-brands). Provide a username or user_id. Returns profile data per affiliate plus a pagination cursor. Returns empty for accounts with no affiliations.",
    args: [
      "@USER_REF",
      { name: "team",
        describe:
          "Optional team/sub-group name to filter affiliates by, when the org exposes named teams." },
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_check_follow_relationship",
    endpoint: "/user/check_follow_relationship",
    description:
      "Check the follow relationship between two accounts by numeric user id: whether the source follows the target, whether the target follows the source, blocking/muting flags where available. Both ids are required. Use this to verify a follow before/after a follow action, or to detect mutuals.",
    args: [
      { name: "source_user_id",
        describe:
          "Numeric user id of the SOURCE account (the 'is this account following...' subject)." },
      { name: "target_user_id",
        describe:
          "Numeric user id of the TARGET account (the '...the target?' object)." },
      "@PROJECTION",
    ],
  },
  // ── Reads: a user's tweets / timeline ──────────────────────────────────────
  {
    name: "twitter_user_tweets",
    endpoint: "/user/tweets",
    description:
      "Get a user's recent posting timeline. IMPORTANT: this endpoint does NOT filter server-side, so the response routinely includes retweets and replies alongside original posts. Every item carries is_retweet, is_reply and is_quote booleans, so filter client-side on those flags if you need originals only, and read author.username rather than assuming every item was written by the requested user (a retweet's retweeted_tweet holds the original author). Returns tweet text, id, timestamp, and engagement metrics. Paginate with cursor to go further back. To pull a back-catalogue in bulk with fewer round-trips, use twitter_user_tweets_complete (which is also cursor-paged, not one-shot).",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_user_tweets_and_replies",
    endpoint: "/user/tweets_and_replies",
    description:
      "Get a user's full activity timeline: their original tweets AND replies to others. Useful for understanding how someone engages with a community, not just what they post. Paginate with cursor. Items carry is_retweet, is_reply and is_quote booleans; filter on those if you need a specific subset. Note that twitter_user_tweets does NOT filter replies or retweets out either, so on many accounts the two endpoints return overlapping or identical pages.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_user_tweets_complete",
    endpoint: "/user/tweets/complete",
    description:
      "Get a large batch of a user's tweet history in one call, auto-paginating server-side across upstream pages. Heavier than twitter_user_tweets; use it to pull a back-catalogue with fewer round-trips. Returns { count, next_cursor, has_more, tweets }. IMPORTANT, this does NOT guarantee the whole history in one call: next_cursor is the completion signal, NOT count. A non-null next_cursor means the history is TRUNCATED and more remains, so call this tool again with cursor set to that value, and repeat until next_cursor is null (has_more is the same signal as a boolean). Each call is bounded by BOTH max and a server-side wall-clock budget, so a response can be truncated even when it returned fewer tweets than you asked for, which is why count must never be used to decide whether you are done. Requires the numeric user_id (resolve a handle first with twitter_user_info). Billed a flat $0.0024 per call regardless of how many tweets come back, so fewer, larger calls are cheaper than many small ones.",
    args: [
      { name: "user_id",
        describe:
          "Numeric Twitter/X user id. Required: this endpoint does not accept a username. Resolve a handle to a user_id first with twitter_user_info." },
      { name: "max", type: "int", min: 1, max: 3200,
        describe:
          "Target number of tweets to collect in this call. Defaults to 200 when omitted. This is a MINIMUM target, not a hard cap: pages arrive in whole chunks, so a response may contain up to one page (<=100) more than requested (measured live 2026-09-05: max=10 returned 20). Never assume count === max. Twitter's ~3200-per-user history ceiling still applies overall." },
      { name: "cursor",
        describe:
          "Resume point from a previous response's next_cursor. Omit on the first call. Pass it back to continue collecting where the last call stopped, and keep repeating while next_cursor is non-null." },
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_user_media",
    endpoint: "/user/media",
    description:
      "Get the images and videos a user has posted. Returns media-containing tweets with URLs to the media files, dimensions, and type (photo/video/animated_gif). Paginate with cursor. Use this to pull a user's visual content history.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_user_mentions",
    endpoint: "/user/mentions",
    description:
      "Get recent public tweets that mention (@ tag) a user. Searches for tweets directed at the username using the to: operator. Returns matching tweets with author info and metrics. Paginate with cursor. Use this to monitor brand mentions, replies directed at an account, or public conversations about a person.",
    args: [
      { name: "username",
        describe:
          "Twitter/X handle WITHOUT the leading @ of the user to find mentions for (e.g. 'openai' to find tweets mentioning @openai)." },
      "@PAGINATION",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_user_likes",
    endpoint: "/user/likes",
    description:
      "Get the tweets a user has liked (their public Likes tab), most recent first. Returns each liked tweet with author and metrics, plus a pagination cursor. Use this to infer interests or find content a user has endorsed. Returns empty if the account hides its likes. Requires the numeric user_id (resolve a handle first with twitter_user_info).",
    args: [
      { name: "user_id",
        describe:
          "Numeric Twitter/X user id (e.g. '44196397'). Required: this endpoint does not accept a username. Resolve a handle to a user_id first with twitter_user_info." },
      "@PAGINATION",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  // ── Reads: followers / following graph ─────────────────────────────────────
  {
    name: "twitter_user_followers",
    endpoint: "/user/followers",
    description:
      "List the accounts that follow a given user. Returns profile data for each follower (username, display name, bio, follower count). Paginate with cursor for large audiences. Useful for audience analysis, finding who follows a brand or influencer.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_following",
    endpoint: "/user/following",
    description:
      "List the accounts that a given user follows. Returns profile data for each account followed. Paginate with cursor. Useful for mapping a user's information sources, influencer networks, or competitor monitoring lists.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_followers_v2",
    endpoint: "/user/followers_v2",
    description:
      "List a user's followers using the v2 response shape (richer profile fields and more reliable cursoring for large audiences). Same inputs as twitter_user_followers; prefer this when you need the fuller v2 payload or are paging deep follower lists.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_following_v2",
    endpoint: "/user/following_v2",
    description:
      "List the accounts a user follows using the v2 response shape (richer profile fields and more reliable cursoring). Same inputs as twitter_user_following; prefer this when you need the fuller v2 payload or are paging deep following lists.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_user_verified_followers",
    endpoint: "/user/verified_followers",
    description:
      "List a user's followers who have a verified account (checkmark). Filters the follower list to verified accounts only, useful for identifying notable or institutional followers. Paginate with cursor.",
    args: [
      "@USER_REF",
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_followers_you_know",
    endpoint: "/user/followers_you_know",
    description:
      "List the 'Followers you know' for a target user id: the followers of that account that YOUR authenticated account also follows (mutual-connection overlap). Requires an authenticated session behind your key. Returns profile data per overlap account plus a cursor.",
    args: [
      { name: "user_id",
        describe:
          "Numeric user id of the target account to compute shared followers against." },
      "@PAGINATION",
      "@INLINE",
      "@PROJECTION",
    ],
  },
  // ── Reads: a single tweet + its conversation ───────────────────────────────
  {
    name: "twitter_tweet_detail",
    endpoint: "/tweet/detail",
    description:
      "Get the full detail of a single tweet: text, author profile, post timestamp, like/retweet/reply/quote counts, attached media, referenced quoted tweet, and parent reply context. Use this to inspect a specific tweet before fetching its replies or thread. Accepts either the tweet id or its full URL.",
    args: [
      "@TWEET_REF",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_tweet_replies",
    endpoint: "/tweet/replies",
    description:
      "Get replies to a specific tweet. Returns each reply tweet with author, text, and metrics. Paginate with cursor to load more. Use this to read the conversation under a tweet, gauge sentiment, or find notable responses.",
    args: [
      "@TWEET_REF",
      "@CURSOR",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    // No cursor here on purpose: /twitter/tweet/thread returns the whole ordered
    // thread in one response and takes no pagination param (the spec lists only
    // id/url). An earlier version of the catalog advertised a cursor the endpoint
    // ignores, which produced a false "paginate with cursor" claim in the tool
    // description. The build now enforces this: adding a cursor arg here would
    // fail, because cursor is not a param of this endpoint.
    name: "twitter_tweet_thread",
    endpoint: "/tweet/thread",
    description:
      "Get all tweets in a thread: the connected chain of tweets posted by the SAME author in sequence (a tweetstorm or numbered thread). Pass any tweet id/url from the thread and the API returns the full ordered sequence in a single call. Does NOT return replies from other users, use twitter_tweet_replies for that. Accepts either the tweet id or its full URL.",
    args: [
      "@TWEET_REF",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_tweet_retweeters",
    endpoint: "/tweet/retweeters",
    description:
      "List the accounts that retweeted a specific tweet. Returns profile data for each retweeter. Paginate with cursor. Useful for finding who amplified a piece of content or mapping a tweet's distribution network.",
    args: [
      "@TWEET_REF",
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_tweet_quotes",
    endpoint: "/tweet/quotes",
    description:
      "List the tweets that QUOTE a specific tweet, cursor-paginated as full tweet objects, so you get the commentary people attached rather than just a number. Different from twitter_tweet_retweeters (a plain retweet carries no text) and from twitter_tweet_replies (a reply is not a quote). IMPORTANT, state this to the user whenever you report a number from it: this endpoint is SEARCH-BACKED, because X exposes no dedicated quote-tweets operation, so it runs the query quoted_tweet_id:<id> against X's search index. The returned 'count' is therefore how many quotes THIS SEARCH returned, never the tweet's true total; the authoritative total is 'quote_count' on the tweet object from twitter_tweet_detail, and the two WILL differ because of index lag and because deleted, protected, suspended and region-withheld quotes are absent from search. Every response carries 'source' (always \"search\"), 'search_query' (the exact query sent), and 'quote_matched' (how many returned tweets demonstrably quote the requested id). quote_matched equal to count means every row is genuine; quote_matched 0 on a NON-EMPTY page means X stopped honouring the operator and the rows are junk, so discard that page rather than reporting it. An empty first Top page is served from Latest instead of reading as zero quotes: the response then says product_used \"Latest\" and top_fallback true, and its next_cursor keeps paging that Latest list, so pass it back unchanged.",
    args: [
      "@TWEET_REF",
      { name: "product", enum: ["Latest","Top"],
        describe:
          "Search ordering. 'Latest' (default) is reverse-chronological and cheap. 'Top' is X's ranked ordering and is materially slower upstream. Any other value falls back to Latest rather than changing what the tool means." },
      { name: "strict", type: "boolean",
        describe:
          "Set true to DROP every returned row that does not demonstrably quote the requested tweet, instead of only counting them in quote_matched. Default false, because X does not embed the quoted original on every search result, so strict trades a false-positive risk for a false-negative one. Billing follows what you receive, so rows dropped by strict are not charged." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max quote tweets to request for this page. Defaults to 20 and is clamped to 1-100 by the underlying search, so a larger number returns at most 100 rather than erroring." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_list_members",
    endpoint: "/list/members",
    description:
      "List the members of a Twitter/X List by its numeric list id. Returns profile data for each member. Paginate with cursor. Use this to enumerate curated account sets, including competitor lists, industry watchlists, or media outlet lists. The list_id appears in the X.com list URL (x.com/i/lists/<list_id>).",
    args: [
      { name: "list_id",
        describe:
          "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>." },
      "@PAGINATION",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_list_followers",
    endpoint: "/list/followers",
    description:
      "Fetch a public List's followers by its numeric id, cursor-paginated. Followers and members are different sets of people: members are the accounts the List owner added to it, followers are the accounts that subscribed to read it. A List with hundreds of members commonly has only a handful of followers, so a small count here is normal and is not a truncated page. Use twitter_list_members for the member roster instead.",
    args: [
      { name: "list_id",
        describe:
          "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max items to return for this page. Defaults to 20 and is clamped to 1-100." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call. next_cursor is null once X marks the follower list complete." },
      "@PROJECTION",
    ],
  },
  // TWO LIST FEEDS, TWO CAPABILITIES, NOT TWO SPELLINGS OF ONE. The names read
  // like versions of each other and they are not: list/tweets is SEARCH-BACKED,
  // so it can answer a time-ranged or reply-filtered question and carries no
  // retweets; list/timeline is X's OWN native List feed, so it carries retweets
  // and X's ordering and accepts no filters at all, only paging. Their PARAMETER
  // SETS are what separates them, which is why each description below states the
  // trade and names the other tool: a model handed only the names will pick one
  // at random and silently answer a different question than the user asked.
  {
    name: "twitter_list_tweets",
    endpoint: "/list/tweets",
    description:
      "Read the posts written by the members of a public Twitter/X List, newest first, through X's search index. This is the FILTERABLE List feed: it accepts since and until date bounds and an include_replies toggle. It does NOT return retweets, and search-index lag applies, so a post made moments ago can be missing for a short while. Use twitter_list_timeline instead when you want the List exactly as X shows it, retweets and native ordering included, and accept that it takes no filters. Paginate with cursor. The list_id appears in the X.com list URL (x.com/i/lists/<list_id>).",
    args: [
      { name: "list_id",
        describe:
          "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>. The List must be public." },
      { name: "since",
        describe:
          "Optional. Only posts on or after this date, as YYYY-MM-DD (e.g. \"2026-08-01\"). Any other format is rejected with a 400." },
      { name: "until",
        describe:
          "Optional. Only posts BEFORE this date, as YYYY-MM-DD. EXCLUSIVE, matching X's own until: search operator, so a post made on the until date is not returned. Any other format is rejected with a 400." },
      { name: "include_replies", type: "boolean",
        describe:
          "Optional. Whether to include replies written by List members. Pass the string \"true\" or \"false\"; defaults to true when omitted. Any other value is rejected with a 400 rather than read as false." },
      { name: "product", enum: ["Latest","Top"],
        describe:
          "Which search ranking to read. 'Latest' (default) is reverse-chronological. 'Top' is X's ranked ordering. Any unrecognised value falls back to Latest rather than erroring." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max posts to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns at most 100 rather than erroring." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_list_timeline",
    endpoint: "/list/timeline",
    description:
      "Read a public Twitter/X List's NATIVE feed, the same posts and the same ordering the List shows on x.com, including members' retweets. It takes only list_id, count and cursor: no date range and no reply filter exist on this endpoint, because a native timeline cannot honour search operators. Use twitter_list_tweets when you need a date range or want replies filtered out, and accept that it drops retweets in exchange. Paginate with cursor until the tweets array comes back empty.",
    args: [
      { name: "list_id",
        describe:
          "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>. The List must be public." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max posts to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns at most 100 rather than erroring." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  // ── Reads: trends ──────────────────────────────────────────────────────────
  {
    name: "twitter_spaces_info",
    endpoint: "/spaces/info",
    description:
      "Get metadata and the participant roster for one X Space by id, live or ended: title, lifecycle state (Scheduled, NotStarted, Running or Ended), host, topics, scheduled and actual start/end times, peak live listener count, replay view count, and the admin, speaker and listener rosters. Returns metadata only, NOT the Space audio. Note that X does not retain the per-person listener roster once a Space ends, so listeners comes back empty for an ended Space while total_live_listeners and total_replay_watched still reflect the real audience. All timestamps are millisecond-epoch numbers.",
    args: [
      { name: "id",
        describe:
          "The Space id: the trailing token of a x.com/i/spaces/<id> URL, e.g. '1RKZzjkoYRAKB'. A '/peek' suffix on the URL is not part of the id." },
      { name: "with_listeners", required: false,
        describe:
          "Optional. Include the listener roster. Defaults to true. X drops this roster once a Space ends, so it is empty for an ended Space regardless of this flag." },
      { name: "with_replays", required: false,
        describe:
          "Optional. Include replay availability and related metadata. Defaults to true." },
      "@PROJECTION",
    ],
  },
  // ── Reads: communities ─────────────────────────────────────────────────────
  // Five PUBLIC POOLED reads. They are served by our account pool rather than by
  // the caller's session, which is why every one of these descriptions states
  // that role / can_join / is_pinned / viewer_relationship_type come back null:
  // those four describe the account that made the upstream call, and on a pooled
  // read that is a rotating account the customer has never heard of. A model
  // that is not told this will report them to a user as a broken field.
  {
    name: "twitter_community_search",
    endpoint: "/community/search",
    description:
      "Find X Communities by keyword, cursor-paginated. This is the discovery step the rest of the community family assumes: every other community endpoint starts from a community id, and this is the one that produces one. Each hit is a compact record, id, name, member count, nsfw flag, topic name, banners and the facepile avatars, exactly what X's own search sends and nothing more. Once you have an id, use twitter_community_info or twitter_community_about for detail, twitter_community_members / twitter_community_moderators for the roster, and twitter_community_tweets for its posts.",
    args: [
      { name: "query",
        describe:
          "Keyword to search for, 1 to 500 characters, e.g. 'build in public'." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_community_info",
    endpoint: "/community/info",
    description:
      "Get the metadata for one X Community by its numeric id: name, description, member_count, moderator_count, join_policy, invites_policy, the join question, primary topic, search tags, the posted rules, both the custom and the default banner plus a resolved banner_url, the permalink, the admin and creator profiles, and the facepile member ids. The community id is the digits in a x.com/i/communities/<id> URL. IMPORTANT: role, can_join, is_pinned and viewer_relationship_type are ALWAYS null here and that is deliberate, not an error, because they describe the account that made the call and this is a pooled read served by a rotating account. rules[].description is also always null: X sends only the rule id and name on this payload. Use twitter_community_members for the roster and twitter_community_tweets for the posts.",
    args: [
      { name: "community_id",
        describe:
          "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'. Digits only. This is NOT a Space id (those are base-62 tokens) and NOT a user id." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_community_about",
    endpoint: "/community/about",
    description:
      "The About tab for one X Community: its moderators, and a preview of its members, both returned as FULL user profiles with bio, follower and following counts, tweet counts, location, website, banner and join date. twitter_community_members and twitter_community_moderators return a reduced row instead, so this is the endpoint that answers who runs a community in one call rather than one call plus a profile lookup per person. Use twitter_community_info instead for the community's own metadata (name, description, rules, join policy); this endpoint is about the PEOPLE, not the community object.",
    args: [
      { name: "community_id",
        describe:
          "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_community_members",
    endpoint: "/community/members",
    description:
      "List the member roster of an X Community, cursor-paginated, with each row carrying that member's own role in the community: 'Admin', 'Moderator' or 'Member'. Rows are { user, role }. The user object is deliberately REDUCED (id, username, name, profile_image_url, is_blue_verified, verified, is_protected) because X's roster operation sends no bio, no follower or following counts and no created_at; call twitter_user_info with an id when the full profile is needed. Note that the role on a member ROW is NOT caller-relative and is returned in full, unlike the role field on the community object itself. Admins and moderators are interleaved through this list at arbitrary positions, so do NOT derive a moderator list by filtering the first page: use twitter_community_moderators. Paging is a bare next_cursor with no total count from X; stop when members comes back empty or has_more is false.",
    args: [
      { name: "community_id",
        describe:
          "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max roster rows to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns 100 rather than erroring." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call. Absence of next_cursor is the only end-of-list signal X gives on this operation." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_community_moderators",
    endpoint: "/community/moderators",
    description:
      "List the moderators and admins of an X Community, cursor-paginated, in the same { user, role } row shape twitter_community_members returns (the array is also called members, deliberately, so the two cannot drift apart). This is a SEPARATE upstream operation, not a filter over the member roster, and that matters for correctness: moderators sit at arbitrary positions inside the full roster, so filtering one page of twitter_community_members would return 'the moderators among the first 20 members' while looking like a complete answer. Read each row's role rather than assuming every row is a Moderator, since admins appear here too. Paging is a bare next_cursor with no total count from X.",
    args: [
      { name: "community_id",
        describe:
          "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max rows to return for this page. Defaults to 20 and is clamped to 1-100." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_community_tweets",
    endpoint: "/community/tweets",
    description:
      "Read an X Community's own post timeline, cursor-paginated as full tweet objects, with the community's PINNED post returned as its own separate 'pinned' field rather than as an item inside 'tweets'. That split is not cosmetic: X delivers the pinned post under a different timeline instruction and does not repeat it in the feed, so a client that iterates only 'tweets' silently loses it, and it is very often the community's rules post, the single most useful item in the response. To build one flat list, read 'pinned' first if non-null, then 'tweets' (the pinned post is excluded from 'tweets', so there is no duplicate). ranking_mode is a REAL upstream parameter, not a local sort. Use twitter_advanced_search instead when the search should span all of X rather than one community.",
    args: [
      { name: "community_id",
        describe:
          "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'." },
      { name: "ranking_mode", enum: ["Recency","Relevance"],
        describe:
          "Ordering, sent to X as a real request parameter. 'Recency' is the default and the only value confirmed against a live capture. 'Relevance' is accepted because X's own community tab offers exactly two orderings, but it is NOT confirmed live, so do not depend on it. Any other value is rejected with a 400." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max posts to return for this page. Defaults to 20 and is clamped to 1-100." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_community_memberships",
    endpoint: "/community/memberships",
    description:
      "The INVERSE community lookup: given a numeric X USER id, list the communities that account belongs to, cursor-paginated. Every other community tool starts from a community; this one starts from an account, which makes it the tool for profiling which audiences a person sits inside. Each row is the FULL community object (the same shape twitter_community_info returns, with member counts, rules, topic, policies, admin and creator), so no follow-up call per community is needed. Takes a numeric user id ONLY, not a @handle: resolve a handle with twitter_user_info first, because resolving it here would silently cost a second call. An EMPTY communities array is a real, successful answer (the account is in no communities), not a not-found. As on twitter_community_info, role / can_join / is_pinned / viewer_relationship_type are always null on every community returned, because this is a pooled read.",
    args: [
      { name: "user_id",
        describe:
          "Numeric X user id, e.g. '1281109705495130113'. NOT a @handle and NOT a community id. Resolve a handle to its id with twitter_user_info first." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max communities to return for this page. Defaults to 20 and is clamped to 1-100." },
      { name: "cursor",
        describe:
          "Opaque pagination cursor from a previous response's next_cursor field. Omit on the first call." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_grok_chat",
    endpoint: "/grok/chat",
    write: true,
    description:
      "Ask X's own Grok a question AS your authenticated account, and get ONE complete JSON reply with the answer plus the sources it cited. Unlike a general LLM, Grok reads X in real time, so it can answer about what is being said right now, and passing a bare tweet or status URL as the message returns a structured summary of that post. Returns answer text, citations (url, title, snippet) merged and de-duplicated across every search Grok ran, the searches themselves, and the model that ACTUALLY answered (which can differ from the one you asked for). Buffered, not streamed. STATELESS: nothing is stored, so to continue a conversation pass the prior turns back in messages[] along with conversation_id. Requires an authenticated session for the acting account.",
    args: [
      { name: "message", required: false,
        describe:
          "The prompt, for a single-turn question. A bare tweet or status URL is a first-class input and comes back as a summary of that post. Provide either this or messages[]." },
      { name: "messages", required: false,
        describe:
          "Prior turns for a multi-turn conversation, oldest first, each { role: 'user' | 'grok', content: '...' }. The endpoint stores nothing, so the full history you want Grok to see must travel in this array. Provide either this or message." },
      { name: "conversation_id", required: false,
        describe:
          "Conversation id returned by a previous call. Omit on the first turn and one is created for you." },
      { name: "mode", required: false,
        describe:
          "Which Grok to use: 'auto' (default, balanced), 'fast' (quicker, less thorough) or 'expert' (slowest, most thorough). The response reports the model that actually answered, which can differ from the mode requested." },
      { name: "image_count", required: false,
        describe:
          "How many images Grok may generate if the prompt calls for one. Defaults to the value X's own client sends. Set 0 for a text-only answer." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_grok_config",
    endpoint: "/grok/config",
    description:
      "Check whether the authenticated account can use Grok, and which models it may pick. Returns eligibility, X's own reasons when it is NOT eligible (passed through verbatim, since we cannot know X's policy), whether free access is enabled, and the available model options. Eligibility is a property of the X ACCOUNT rather than of the API key, so ask this about the same account you intend to run twitter_grok_chat as. Free.",
    args: [
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_trends",
    endpoint: "/trends",
    description:
      "Get the current top trends for a location. With no location parameter, returns Worldwide (WOEID 1, X's own default). Pass country (an ISO code or country name, e.g. 'US' or 'Japan') or a numeric woeid from twitter_trends_locations; woeid wins when both are given. Returns the resolved location, the as_of / created_at timestamps, and the ranked trends list. Use count to truncate the list. A location X will not serve returns a 400.",
    args: [
      { name: "country",
        describe:
          "Country name or ISO code to get trends for, e.g. 'US' or 'Japan'. Resolved against the trends locations list. Omit for Worldwide." },
      { name: "woeid", type: "string",
        describe:
          "Numeric WOEID from twitter_trends_locations. Takes precedence over country when both are supplied." },
      { name: "count", type: "int", min: 1,
        describe:
          "Truncate the returned trends list to at most this many. Omit to return X's full list for the location." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_trends_locations",
    endpoint: "/trends/locations",
    description:
      "List every location X publishes trends for, each with the numeric WOEID to pass back to twitter_trends as woeid. Takes no required parameters. Use this to resolve a country or city to its WOEID before requesting trends for that place.",
    args: ["@PROJECTION"],
  },
  // ── Reads: your twitterapis.com account (billing; not Twitter data) ─────────
  {
    name: "twitter_account_me",
    endpoint: "/account/me",
    description:
      "Get YOUR twitterapis.com account details: email, name, credits remaining, credits used, total requests made, and account creation date. Authenticated by your API key. This is an account read, not Twitter data, and is free (it does not spend credits).",
    args: [],
  },
  {
    name: "twitter_account_payments",
    endpoint: "/account/payments",
    description:
      "Get YOUR twitterapis.com payment history: the list of top-ups and charges on your account. Authenticated by your API key. This is an account read, not Twitter data, and is free (it does not spend credits).",
    args: [],
  },
  // ── Feedback: product reports from inside the customer's AI tool (2026-09-04) ─
  // Modelled on Claude Code's own feedback tool: the model DRAFTS at a
  // high-signal moment into a local queue (src/feedback.js) and nothing is sent
  // until the user reviews and names the drafts to send. Free, not metered,
  // zero-rated in billing like account/* and the monitoring tools. The
  // DESCRIPTION below is the product: it is what tells a model when to draft
  // and what shape a useful report has. The `local` handler owns the queue;
  // `action` and `ids` never reach the API.
  {
    name: "twitter_feedback_send",
    endpoint: "/feedback",
    method: "POST",
    write: true, jsonBody: true,
    local: "feedback",
    description:
      "Report a product problem or gap in twitterapis.com to its team from inside this session, the way Claude Code's own feedback tool works: a report is DRAFTED to a local queue first (action \"draft\", the default) and SENT only after the user reviews it. Drafting sends nothing, needs no confirmation, and should not be announced mid-task. WHEN TO DRAFT, only at high-signal moments: a twitterapis tool call failed with an error that was not a missing key (401), credits (402), no linked session (409) or a rate limit (429), and the user had to work around it; the user asked for something no twitterapis tool covers; a documented field came back empty or wrong; the user was clearly frustrated with a result. One draft per distinct issue, never twice for the same one. FORMAT for details, four labelled bullets in this order: 'What happened:' observed vs expected, exact error text if short. 'What the user said:' quoted verbatim, or 'user did not comment'. 'Repro:' the minimal call that reproduces it. 'Evidence:' tool name, endpoint, HTTP status, request id (the last failing call is attached automatically where you leave a gap). Facts only: no guessing, no API keys or secrets, no personal names. REVIEW: when the user asks to see or send feedback, call action \"list\", then action \"send\" with ONLY the draft ids the user named in their own message, or action \"discard\". Sending posts each draft to POST /feedback (free) and returns a server id that twitter_feedback_get can check later.",
    args: [
      { name: "action", local: true, type: "enum", enum: ["draft", "list", "send", "discard"], required: false,
        describe:
          "What to do. \"draft\" (default) queues a new report locally and sends nothing. \"list\" shows the pending drafts with their ids. \"send\" posts the drafts named in ids to twitterapis.com; use it only for ids the user named. \"discard\" drops the drafts named in ids." },
      { name: "type", type: "enum", enum: ["bug", "idea", "missing_capability"], required: false,
        describe:
          "Required for a draft. \"bug\": a tool or endpoint misbehaved. \"idea\": a change that would have made the task easier. \"missing_capability\": the user needed something no tool provides." },
      { name: "title", required: false,
        describe:
          "Required for a draft. One specific line, at most 120 characters, naming the tool or endpoint and the defect, e.g. \"twitter_tweet_thread returns 502 when the root tweet is deleted\"." },
      { name: "details", required: false,
        describe:
          "Required for a draft. At most 8000 characters, four labelled bullets in order: What happened, What the user said (verbatim), Repro, Evidence." },
      { name: "area",
        describe:
          "Optional. The endpoint or feature the report is about, e.g. \"tweet/thread\" or \"monitoring\". At most 80 characters." },
      { name: "evidence", type: "json",
        describe:
          "Optional identifiers only, never payloads: {tool, endpoint, status, request_id}. Whatever you leave out is filled from the last failing call in this session; mcp_version and client are always attached." },
      { name: "ids", local: true, type: "strings",
        describe:
          "For action \"send\" or \"discard\": the draft ids to act on, exactly as shown by action \"list\" and named by the user." },
    ],
    omit: {
      client: "filled by the handler from the MCP handshake clientInfo plus this package's version, never typed by a model",
    },
  },
  {
    name: "twitter_feedback_get",
    endpoint: "/feedback/{id}",
    description:
      "Check the status of a feedback report this account sent earlier (the server id returned by twitter_feedback_send action \"send\"): status new, triaged, shipped or declined, the team's response text if any, and updated_at, which moves only when the team acts on it. Free per call. 404 if the id is not on this account.",
    args: [
      { name: "id",
        describe:
          "The server id of a sent report, as returned by twitter_feedback_send action \"send\" (a UUID). Not a local draft id." },
    ],
  },
  // GET /feedback (List Feedback) shipped upstream after 0.9.7 and had no tool,
  // which made test/openapi-parity.mjs red on origin/main and, because
  // prepublishOnly runs npm test, made the package unpublishable. The allowlist
  // in that gate is deliberately empty ("every public endpoint has a tool"), so
  // the in-policy fix is the tool, not an exemption. Distinct from
  // twitter_feedback_send action "list", which shows LOCAL drafts that were
  // never sent; this reads the reports the server has.
  {
    name: "twitter_feedback_list",
    endpoint: "/feedback",
    method: "GET",
    description:
      "List the feedback reports this account has already SENT to twitterapis.com, newest first. Use it when the user asks what they have reported, or to find the server id of an earlier report so twitter_feedback_get can read its full status. NOT the same as twitter_feedback_send action \"list\", which shows local drafts that have not been sent yet. Each item carries id, type, title, area, status (new, triaged, shipped or declined), the team's response if any, created_at and updated_at, and never details or evidence, so paging this can never bulk-export a report's body: read one by id with twitter_feedback_get for that. Page with cursor while next_cursor is non-null. Free per call, and shares a 10-per-minute limit with the other feedback tools.",
    args: [
      { name: "limit", type: "int", min: 1, max: 100,
        describe:
          "Max reports to return, 1 to 100. Defaults to 25. Anything outside that range is rejected with 400 naming limit." },
      { name: "cursor",
        describe:
          "Opaque continuation token from a previous response's next_cursor. Omit it to start from the newest report. A cursor that cannot be decoded is a 400 naming cursor, never a silently empty page." },
      { name: "status", type: "enum", enum: ["new", "triaged", "shipped", "declined"],
        describe:
          "Optional. Return only reports in this state. Anything else is rejected with 400 naming status." },
      { name: "type", type: "enum", enum: ["bug", "idea", "missing_capability"],
        describe:
          "Optional. Return only reports of this kind. Anything else is rejected with 400 naming type." },
    ],
  },
  // ── Reads: authenticated-account surfaces (require a session behind your key) ─
  {
    name: "twitter_home_timeline",
    endpoint: "/user/home_timeline",
    description:
      "Get YOUR authenticated account's Home timeline (the 'Following'/'For you' feed), most recent first. Requires an authenticated session behind your key. Returns tweets with author and metrics plus a cursor. Use this to read what your account would see when it opens X.",
    args: [
      "@PAGINATION",
      "@INLINE",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_bookmarks",
    endpoint: "/user/bookmarks",
    description:
      "List YOUR authenticated account's bookmarked tweets, most recent first. Requires an authenticated session behind your key. Returns each bookmarked tweet with author and metrics plus a cursor.",
    args: [
      "@PAGINATION",
      "@INLINE",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_blocking",
    endpoint: "/user/blocking",
    description:
      "List the accounts YOUR authenticated account has BLOCKED, as full user objects, cursor-paginated. Requires an authenticated session behind your key. There is no user_id argument: X provides no way to read another account's block list, so this reads yours only. An empty users array is a real answer meaning you block nobody, never a silent failure, because the endpoint returns an error status rather than an empty page when it cannot read the list.",
    args: [
      "@PAGINATION",
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_muting",
    endpoint: "/user/muting",
    description:
      "List the accounts YOUR authenticated account has MUTED, as full user objects, cursor-paginated. Muting hides an account's posts from your timeline without blocking it, so this is a different list from twitter_blocking and an account can appear in one and not the other. Requires an authenticated session behind your key. There is no user_id argument: X provides no way to read another account's mute list. An empty users array means you mute nobody, never a silent failure.",
    args: [
      "@PAGINATION",
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_bookmark_search",
    endpoint: "/user/bookmark_search",
    description:
      "Full-text search within YOUR authenticated account's bookmarks. Requires an authenticated session behind your key. Returns matching bookmarked tweets plus a cursor. Use this to retrieve a previously bookmarked tweet by keyword.",
    args: [
      { name: "query",
        describe:
          "Search terms to match against your bookmarked tweets' text." },
      "@PAGINATION",
      "@INLINE",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_bookmark_folders",
    endpoint: "/user/bookmark_folders",
    description:
      "List YOUR authenticated account's bookmark FOLDERS (X's internal name: collections), the named groups you can organize saved tweets into, separate from your flat bookmarks list (twitter_bookmarks). Requires an authenticated session behind your key. Returns each folder's id, name, and a cover image. Takes no arguments; your folders resolve from your session alone. Use twitter_bookmark_folder_timeline with a folder's id to read the tweets inside it.",
    args: [
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_bookmark_folder_timeline",
    endpoint: "/user/bookmark_folder_timeline",
    description:
      "Read the tweets inside ONE of your authenticated account's bookmark folders, identified by folder_id (from twitter_bookmark_folders). Requires an authenticated session behind your key. Cursor-paginated; there is no count/page-size argument for this op.",
    args: [
      { name: "folder_id",
        describe:
          "The bookmark folder's id, from twitter_bookmark_folders (e.g. '2073826456430592429')." },
      "@CURSOR",
      "@INLINE",
      "@PROJECTION",
      "@PAID_PROMOTION",
    ],
  },
  {
    name: "twitter_dm_list",
    endpoint: "/dm/list",
    description:
      "List YOUR authenticated account's Direct Message conversations (inbox), each with the participant and a conversation_id you can pass to twitter_dm_conversation. Requires an authenticated session behind your key. Read-only: this does not send DMs.",
    args: [
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_dm_conversation",
    endpoint: "/dm/conversation",
    description:
      "Get the messages in one Direct Message conversation by its conversation_id (from twitter_dm_list). Requires an authenticated session behind your key. Returns each message with sender id, time, and text, plus min_entry_id and max_entry_id for the page; to walk the thread back in time, call again with max_id set to the previous page's min_entry_id. Read-only: this does not send DMs.",
    args: [
      { name: "conversation_id",
        describe:
          "The conversation_id from a twitter_dm_list entry identifying which DM thread to read." },
      { name: "max_id",
        describe:
          "Optional. Page backwards: return entries older than this numeric entry id. Pass the previous page's min_entry_id to walk a thread back in time; omit for the newest page. Must be a numeric entry id; any other value returns 400." },
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_dm_send",
    endpoint: "/dm/send",
    write: true,
    description:
      "Send a Direct Message AS your authenticated account. Provide the recipient's numeric user id (recipient_id, resolve a @handle with twitter_user_info first) and the message text. Requires an authenticated session with write capability behind your key; X soft-blocks writes from datacenter IPs, so route through a residential proxy_url for reliability. Returns message_id and conversation_id. Delivers a real DM and is not silently reversible.",
    args: [
      { name: "recipient_id",
        describe:
          "Numeric Twitter/X user id of the recipient (e.g. '44196397'). Resolve a @handle to its id with twitter_user_info first. The recipient must allow DMs from you." },
      { name: "text", minLength: 1,
        describe:
          "The Direct Message body text to send (non-empty)." },
      "@INLINE",
    ],
  },
  // ── Writes: tweet authoring ────────────────────────────────────────────────
  {
    name: "twitter_create_tweet",
    endpoint: "/tweet/create",
    write: true,
    description:
      "Post a new tweet AS your authenticated account. Set reply_to to post a reply, or quote to post a quote-tweet. This publishes publicly and is not silently reversible (use twitter_delete_tweet to remove it). Requires an authenticated session with write capability behind your key. Returns the new tweet_id and url.",
    args: [
      { name: "text", minLength: 1,
        describe:
          "The tweet body text (1 to 280 characters, or longer if the account has extended limits)." },
      { name: "reply_to",
        describe:
          "Optional. Numeric id of the tweet to reply to. When set, this tweet is posted as a reply in that conversation." },
      { name: "quote",
        describe:
          "Optional. Numeric id of the tweet to quote. When set, this tweet quote-tweets that tweet." },
      { name: "media_ids",
        describe:
          "Optional. Comma-separated media id(s) from a prior media upload to attach (images/video)." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_delete_tweet",
    endpoint: "/tweet/delete",
    write: true, destructive: true,
    description:
      "Delete a tweet AS your authenticated account. Irreversible: the tweet is permanently removed. You can only delete tweets your authenticated account authored. Provide the tweet id or url. Requires write capability behind your key.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
  },
  {
    name: "twitter_update_profile",
    endpoint: "/user/update_profile",
    write: true,
    // jsonBody, and the gate is why. body-mode-parity read the backend's
    // route-body-modes.json, saw updateProfileRoute classified "json-only" and
    // refused the build until this was set. Worth knowing the classification is
    // CONSERVATIVE rather than exact: that handler reads every field as
    // `body.X ?? c.req.query("X")`, so a query string would in fact work, but it
    // does that with a raw c.req.query() instead of the param-compat helpers the
    // classifier looks for, so it lands in the stricter bucket. The error is in
    // the safe direction (it forces the mode that always works) and jsonBody:true
    // is correct regardless, since the docs document these as body params.
    jsonBody: true,
    description:
      "Change the display name, bio, location or link on your authenticated account's own X profile. This is a PARTIAL update: send only the fields you want to change and everything you omit keeps its current value, so passing just a name will NOT wipe the bio. An empty string CLEARS that field, which is different from omitting it: \"\" blanks the value, an absent key leaves it alone. At least one of name, description, location or url is required, and a request whose only value is an empty string is a valid clear rather than an empty request. It writes a real profile and takes effect immediately with no undo, so read the current values with twitter_user_info first if you may need to restore them. Requires an authenticated session behind your key. Returns ok and updated_fields, which echoes the field names you SENT rather than a diff against the previous profile.",
    args: [
      { name: "name",
        describe:
          "Optional. New display name, up to 50 characters. Omit to leave it unchanged." },
      { name: "description",
        describe:
          "Optional. New bio. Send an EMPTY STRING to clear it; OMIT the field to leave it alone. Those are different." },
      { name: "location",
        describe:
          "Optional. New location text. Same rule: an empty string clears it, omitting the field leaves it alone." },
      { name: "url",
        describe:
          "Optional. New profile link." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_update_avatar",
    endpoint: "/user/update_avatar",
    write: true,
    // json-only, and not the conservative classification update_profile gets.
    // imageWrite reads c.req.json() and nothing else, with no query fallback at
    // all, so the backend's route-body-modes.json classification is exact here.
    jsonBody: true,
    description:
      "Replace the profile picture on your authenticated account's own X profile. Takes ONE field, image, holding base64-encoded image bytes: not a URL, not multipart, and not a media_id from twitter_media_upload. It writes a real profile and takes effect immediately with NO UNDO, and X keeps no history of the previous picture, so if the old image might be wanted back, read profile_image_url with twitter_user_info and save that file BEFORE calling this. Returns ok. To confirm it applied, read the account back with twitter_user_info: X mints a new media id for every accepted upload, so profile_image_url changes even when the image is byte-identical to the one already in place. Requires an authenticated session behind your key.",
    args: [
      { name: "image",
        describe:
          "REQUIRED. Base64-encoded image bytes. Not a URL, not multipart, and not a media_id. banner and data are accepted as aliases for this same field." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_update_banner",
    endpoint: "/user/update_banner",
    write: true,
    jsonBody: true,
    description:
      "Replace the wide header image on your authenticated account's own X profile. Takes ONE field, banner, holding base64-encoded image bytes: not a URL, not multipart, and not a media_id from twitter_media_upload. X renders the header as a wide strip, so a 3:1 image fills it without cropping. It writes a real profile and takes effect immediately with NO UNDO, and X keeps no history of the previous banner, so if the old image might be wanted back, read cover_picture with twitter_user_info and save that file BEFORE calling this. Returns ok. To confirm it applied, read the account back with twitter_user_info and check cover_picture specifically: at least one of X's own endpoints reports that field as empty for accounts that plainly have a banner, so an empty answer from anywhere else is not evidence the account has none. Requires an authenticated session behind your key.",
    args: [
      { name: "banner",
        describe:
          "REQUIRED. Base64-encoded image bytes. Not a URL, not multipart, and not a media_id. image and data are accepted as aliases for this same field." },
      "@INLINE",
    ],
  },
  // ── Writes + reads: the compose surface (drafts and scheduled posts) ───────
  // The one thing a model cannot read off the schema is which of these two
  // families actually posts. A DRAFT is private and NEVER posts. A SCHEDULED
  // post WILL publish publicly at its execute_at unless it is cancelled first.
  // Every description below says so in its first two sentences, because a model
  // choosing between them on the word "create" alone will get it wrong.
  {
    name: "twitter_draft_create",
    endpoint: "/draft/create",
    write: true,
    description:
      "Save a PRIVATE draft tweet on your authenticated account. Nothing is posted and nobody can see it: the draft lands in X's own composer under Drafts until a human publishes or deletes it. Use this when a person still has to approve the wording. Use twitter_create_tweet to post right now, and twitter_scheduled_create when it should go out on its own at a known time. Requires an authenticated session behind your key. Returns ok and draft_tweet_id. A null draft_tweet_id means X refused the create, answers 422, and is not billed.",
    args: [
      { name: "text", minLength: 1,
        describe:
          "The draft body text. Required: a draft with no text is refused with 400, so a media-only draft cannot be created through this API." },
      { name: "reply_to",
        describe:
          "Optional. Numeric id of the tweet this draft replies to. Send it as a string; X ids are 19 digits and an unquoted number is refused rather than silently rounded to a different tweet." },
      { name: "quote",
        describe:
          "Optional. Numeric id of the tweet this draft quotes. Send it as a string, same reason as reply_to." },
      { name: "media_ids",
        describe:
          "Optional. Comma-separated media id(s) from a prior media upload to attach. Up to 4." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_draft_edit",
    endpoint: "/draft/edit",
    write: true,
    description:
      "Replace the contents of one existing PRIVATE draft on your authenticated account. The fields you send BECOME the draft rather than merging into it, so anything you leave out is dropped, including media. Get the id from twitter_draft_list or from the twitter_draft_create call that saved it. Still posts nothing. Requires an authenticated session behind your key. Returns ok and the draft_tweet_id you edited.",
    args: [
      { name: "id",
        describe:
          "Numeric id of the draft to edit, from twitter_draft_list. Also accepted by the API as draft_tweet_id." },
      { name: "text", minLength: 1,
        describe:
          "The replacement draft body text. Required: an edit with no text is refused with 400." },
      { name: "reply_to",
        describe:
          "Optional. Numeric id of the tweet this draft replies to. Send it as a string." },
      { name: "quote",
        describe:
          "Optional. Numeric id of the tweet this draft quotes. Send it as a string." },
      { name: "media_ids",
        describe:
          "Optional. Comma-separated media id(s) to attach. Omitting this drops whatever media the draft had; it is not merged." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_draft_delete",
    endpoint: "/draft/delete",
    write: true, destructive: true,
    description:
      "Delete one PRIVATE draft from your authenticated account by id. Irreversible, but low-stakes in a way twitter_delete_tweet is not: a draft was never public, so this retracts nothing and notifies nobody. Use twitter_delete_tweet for a post that is already live. Requires an authenticated session behind your key. Returns ok, deleted, and the draft_tweet_id you targeted.",
    args: [
      { name: "id",
        describe:
          "Numeric id of the draft to delete, from twitter_draft_list. Also accepted by the API as draft_tweet_id." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_draft_list",
    endpoint: "/draft/list",
    description:
      "List the PRIVATE drafts saved on your authenticated account. This is where a draft id comes from for an edit or a delete. Reads only your own account: drafts are private to the account that holds them, so there is no way to read anyone else's. Requires an authenticated session behind your key. Returns drafts (each with draft_tweet_id, text, thread_truncated), count, and sometimes partial. thread_truncated true means the draft is a THREAD and text is only its first tweet, which is a parse that succeeded. partial true means X's answer was read but not fully understood, which is NOT 'you have no drafts': it is absent entirely on a clean read, so an empty drafts array with no partial flag means the account genuinely has none. One call returns the whole list; there is no cursor and no timestamp on a draft row.",
    args: [
      { name: "ascending", type: "boolean", required: false,
        describe:
          "Optional. Pass the STRING \"true\" to ask X for the oldest draft first. Anything else, including omitting it, sends ascending=false, which is what X's own composer sends. The resulting order is X's and is not re-sorted, so do not promise a user newest-first." },
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_scheduled_create",
    endpoint: "/scheduled/create",
    write: true,
    description:
      "Schedule a tweet to POST PUBLICLY at a future instant from your authenticated account. This is NOT a draft: it goes out on its own at execute_at whether or not anyone is watching, unless it is cancelled first with twitter_scheduled_delete. Use twitter_draft_create when a human still has to approve the wording. execute_at is epoch SECONDS, never milliseconds: Date.now() returns milliseconds, so divide by 1000, and a millisecond value is refused with a message naming the unit rather than scheduling the post tens of thousands of years out. It must also be strictly in the future. Requires an authenticated session behind your key. Returns ok, scheduled_tweet_id, and the execute_at you sent.",
    args: [
      { name: "text", minLength: 1,
        describe:
          "The tweet body text that will be published. Required: a scheduled post with no text is refused with 400." },
      { name: "execute_at", type: "int",
        describe:
          "When to post, as epoch SECONDS in the future (for example 1829752200). NOT milliseconds: a value of 1000000000000 or more is rejected as a millisecond timestamp. Also accepted by the API as schedule_at." },
      { name: "reply_to",
        describe:
          "Optional. Numeric id of the tweet this post replies to. Send it as a string." },
      { name: "quote",
        describe:
          "Optional. Numeric id of the tweet this post quotes. Send it as a string." },
      { name: "media_ids",
        describe:
          "Optional. Comma-separated media id(s) from a prior media upload to attach. Up to 4." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_scheduled_delete",
    endpoint: "/scheduled/delete",
    write: true, destructive: true,
    description:
      "Cancel one PENDING scheduled post on your authenticated account so it never publishes. Only works before its execute_at: once the post has gone out there is no scheduled row left to cancel, and the thing to remove is the resulting tweet, with twitter_delete_tweet. Get the id from twitter_scheduled_list. Requires an authenticated session behind your key. Returns ok, deleted, and the scheduled_tweet_id you targeted.",
    args: [
      { name: "id",
        describe:
          "Numeric id of the scheduled post to cancel, from twitter_scheduled_list. Also accepted by the API as scheduled_tweet_id." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_scheduled_list",
    endpoint: "/scheduled/list",
    description:
      "List the posts QUEUED to publish on your authenticated account. This is where a scheduled id comes from for a cancel, and it is worth reading before scheduling anything so a retry in your own code does not quietly queue the same post twice. Rows carry X's own state label verbatim (for example Scheduled), and a row that has already published leaves the queue and becomes an ordinary tweet. Requires an authenticated session behind your key. Returns scheduled (each with scheduled_tweet_id, text, thread_truncated, execute_at, state), count, and sometimes partial. thread_truncated is INFERRED on this endpoint rather than captured: a scheduled row carries the same compose payload a draft row does, and the captured scheduled row elides that body, so the flag is sound and fail-safe (an absent key yields false) but has not been seen true. execute_at comes back in epoch SECONDS: X answers this operation in milliseconds and the value is normalised, so a timestamp read here can be passed straight back into twitter_scheduled_create. partial true means X's answer was read but not fully understood, which is not the same as an empty queue; on a clean read it is absent entirely.",
    args: [
      { name: "ascending", type: "boolean", required: false,
        describe:
          "Optional. Pass the STRING \"true\" for the oldest row first. Anything else, including omitting it, returns X's default order." },
      "@INLINE",
      "@PROJECTION",
    ],
  },
  // ── Writes: engagement (favorite / retweet / bookmark) + inverses ──────────
  {
    name: "twitter_favorite_tweet",
    endpoint: "/tweet/favorite",
    write: true,
    description:
      "Like (favorite) a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unfavorite_tweet.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  {
    name: "twitter_unfavorite_tweet",
    endpoint: "/tweet/unfavorite",
    write: true, destructive: true,
    description:
      "Remove a like (unfavorite) from a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  {
    name: "twitter_retweet",
    endpoint: "/tweet/retweet",
    write: true,
    description:
      "Retweet a tweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unretweet.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  {
    name: "twitter_unretweet",
    endpoint: "/tweet/unretweet",
    write: true, destructive: true,
    description:
      "Undo a retweet AS your authenticated account. Provide the tweet id or url. Requires write capability behind your key.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  {
    name: "twitter_bookmark_tweet",
    endpoint: "/tweet/bookmark",
    write: true,
    description:
      "Bookmark a tweet to YOUR authenticated account's private bookmarks. Provide the tweet id or url. Requires write capability behind your key. Reverse with twitter_unbookmark_tweet.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  {
    name: "twitter_unbookmark_tweet",
    endpoint: "/tweet/unbookmark",
    write: true, destructive: true,
    description:
      "Remove a tweet from YOUR authenticated account's bookmarks. Provide the tweet id or url. Requires write capability behind your key.",
    args: [
      "@TWEET_REF",
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  // ── Writes: follow graph ───────────────────────────────────────────────────
  {
    name: "twitter_follow_user",
    endpoint: "/user/follow",
    write: true,
    description:
      "Follow a user AS your authenticated account, by numeric user_id or by @handle (provide exactly one). Requires write capability behind your key. Reverse with twitter_unfollow_user.",
    args: [
      { name: "user_id",
        describe:
          "Numeric user id of the account to follow. Provide exactly one of user_id or username; user_id skips the handle lookup." },
      { name: "username",
        describe:
          "The @handle WITHOUT the leading @ (e.g. \"elonmusk\") of the account to follow. Provide exactly one of user_id or username; the API resolves the handle to its id on every call, never from a cache, so a renamed account is followed by its current handle." },
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  {
    name: "twitter_unfollow_user",
    endpoint: "/user/unfollow",
    write: true, destructive: true,
    description:
      "Unfollow a user AS your authenticated account, by numeric user_id or by @handle (provide exactly one). Requires write capability behind your key.",
    args: [
      { name: "user_id",
        describe:
          "Numeric user id of the account to unfollow. Provide exactly one of user_id or username." },
      { name: "username",
        describe:
          "The @handle WITHOUT the leading @ of the account to unfollow. Provide exactly one of user_id or username; resolved to its id on every call, never from a cache." },
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
  },
  // ── Writes: Lists (create a List, curate its membership) ───────────────────
  // These run on the CUSTOMER'S REGISTERED X SESSION, never on a pooled account,
  // because a List belongs to a specific account: a pooled write would mutate a
  // rotation account's Lists, which nobody asked for and nobody could read back.
  // Register once with twitter_customer_session, or pass auth_token and ct0 per
  // call via @INLINE.
  //
  // jsonBody deliberately UNSET, and this was checked rather than copied: the
  // backend handlers (listAddMemberRoute / listRemoveMemberRoute /
  // listCreateRoute in twitterapis-backend scraper/src/server/routes/
  // list-write.ts) read every field through resolveBodyParam, the dual-mode
  // query-or-body helper, so query-string args work. The backend's own
  // route-body-modes.json manifest classifies all three as mode "either", which
  // is what test/body-mode-parity.mjs asserts against.
  //
  // ON member_count: X returns a populated errors[] on 100% of SUCCESSFUL calls
  // to these three ops, so a caller cannot use the error array to decide whether
  // the write applied. The List's member_count, read back from X after the
  // write, is the check that works, which is why every description below points
  // a model at it instead of at ok alone.
  {
    name: "twitter_list_add_member",
    endpoint: "/list/add_member",
    write: true,
    description:
      "Add one account to a Twitter/X List that YOUR registered X session owns, by numeric list id and numeric user id. Use it to curate a List from code, for example adding each speaker at a conference to a List as they are announced. Returns ok, action, list_id, user_id, the List's member_count read back from X after the write, and the full list object. Read member_count to confirm the change landed: it is null when X returned no list object at all, which is itself the not-applied signal. A write that does not apply (the account is already a member, the List is not yours) comes back with the SAME field layout plus a 422 and a machine-readable reason, and is not billed. Reverse with twitter_list_remove_member.",
    args: [
      { name: "list_id",
        describe:
          "Numeric id of the List you own. Found in the list URL: x.com/i/lists/<list_id>." },
      { name: "user_id",
        describe:
          "Numeric user id of the account to add. Resolve a handle to a user_id first with twitter_user_info." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_list_remove_member",
    endpoint: "/list/remove_member",
    write: true, destructive: true,
    description:
      "Remove one account from a Twitter/X List that YOUR registered X session owns, by numeric list id and numeric user id. Use it to prune a curated List, for example dropping accounts that have gone quiet. Returns ok, action, list_id, user_id, the List's member_count read back from X after the write, and the full list object. Read member_count to confirm the removal landed: it is null when X returned no list object at all, which is itself the not-applied signal. A write that does not apply (the account was never a member, the List is not yours) comes back with the SAME field layout plus a 422 and a machine-readable reason, and is not billed. Reverse with twitter_list_add_member.",
    args: [
      { name: "list_id",
        describe:
          "Numeric id of the List you own. Found in the list URL: x.com/i/lists/<list_id>." },
      { name: "user_id",
        describe:
          "Numeric user id of the account to remove. Resolve a handle to a user_id first with twitter_user_info." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_list_create",
    endpoint: "/list/create",
    write: true,
    description:
      "Create a new Twitter/X List owned by YOUR registered X session, with a name and an optional description and privacy flag. This is the starting point for building a List from code: create it here, then fill it with twitter_list_add_member using the list id this returns. Returns ok, action, the new list_id, member_count, and the full list object X returned. A List is PUBLIC unless you explicitly ask for a private one, and a private List is not readable by the public List read tools (twitter_list_members, twitter_list_tweets, twitter_list_timeline).",
    args: [
      { name: "name", minLength: 1,
        describe:
          "Display name for the new List, e.g. \"Founders\". Required; an empty or whitespace-only name is rejected with a 400." },
      { name: "description",
        describe:
          "Optional. Description shown on the List, e.g. \"People building in public\". Defaults to empty." },
      { name: "is_private", type: "boolean",
        describe:
          "Optional. Pass the string \"true\" to create a PRIVATE List. Defaults to false (public), because a public List can be made private later while a leak cannot be undone. Note a private List is not readable by the public List read tools." },
      "@INLINE",
    ],
  },
  // ── Session bootstrap + media: link an X account to your key, then act as it ─
  // Once a session is linked (via twitter_customer_session or twitter_user_login)
  // the authenticated-account reads and the write actions run AS that account.
  // customer/session, user_login and media/upload send a JSON request body
  // (jsonBody:true), so their fields travel in the body, not the query string,
  // matching the backend routes that read c.req.json().
  {
    name: "twitter_customer_session",
    endpoint: "/customer/session",
    write: true, jsonBody: true,
    description:
      "Register YOUR OWN X account session against your API key, so the authenticated-account tools (twitter_home_timeline, twitter_bookmarks, twitter_dm_list, twitter_dm_conversation, twitter_user_likes, twitter_article_list) and the write tools (twitter_create_tweet, twitter_dm_send, twitter_follow_user, twitter_favorite_tweet, twitter_retweet, twitter_media_upload, twitter_article_create, twitter_article_update_title, twitter_article_update_content, twitter_article_publish, twitter_article_unpublish, twitter_article_delete) act as your account. Provide your x.com session cookies auth_token and ct0 (copy them from a logged-in browser); optionally a user_agent and a residential proxy_url. The cookies are stored server-side against your key and are never returned. Returns ok, the resolved username, and whether the session validated live. Prefer twitter_user_login if you would rather pass a username/password than raw cookies. Most tools also accept auth_token/ct0 per-call without registering.",
    args: [
      { name: "auth_token",
        describe:
          "Your x.com auth_token cookie value, from a logged-in browser session. Stored server-side against your key; never returned." },
      { name: "ct0",
        describe:
          "Your x.com ct0 (CSRF) cookie value, from the same browser session. Paired with auth_token." },
      { name: "user_agent",
        describe:
          "Optional. Browser User-Agent to send with this session's requests. Defaults to a current Chrome UA." },
      { name: "proxy_url",
        describe:
          "Optional. HTTP or SOCKS proxy URL to route this session's traffic through, e.g. 'http://user:pass@host:port'." },
    ],
  },
  {
    // The read-back counterpart to twitter_customer_session. Deliberately placed
    // between register and delete so an agent reading the catalog finds the way
    // to CHECK the thing it just registered before it finds the way to remove
    // it. Added for support ticket #197: register and revoke existed, but
    // nothing let the account owner ask "is my session ok" without a human
    // reading the production database. GET, no args: the key comes from the
    // auth middleware's context, so the handler cannot be pointed at another
    // key's session.
    name: "twitter_customer_session_status",
    endpoint: "/customer/session/status",
    description:
      "Read back the X account session you registered with twitter_customer_session, without changing it. Returns registered (false if you never registered one), the resolved username and twitter_user_id the session actually maps to, status ('ok', or 'dead' once X has rejected the cookies), created_at, updated_at, last_used_at, and an egress block: source (one of session, sticky_residential, pool_residential, direct), customer_proxy_in_use (true when the proxy_url you registered is the one your writes leave from), and a note explaining that tier. Never returns auth_token, ct0, or any proxy URL. Use it to answer 'am I posting as the account I think I am', 'has my session expired', and 'is the proxy I supplied actually being used' without opening a support ticket. Free, and scoped to your own API key by construction: it takes no account identifier of any kind, so it cannot read another key's session.",
    args: [],
  },
  {
    // The counterpart to twitter_customer_session. Deliberately placed next to it
    // so an agent reading the catalog finds the way OUT beside the way IN: a
    // credential you cannot withdraw is the objection this endpoint exists to
    // answer, and it went unpublished on every surface for six days.
    name: "twitter_customer_session_delete",
    endpoint: "/customer/session/delete",
    // NOT jsonBody. Unlike its sibling twitter_customer_session, this handler
    // reads nothing from the request: it takes the api key from the auth
    // middleware's context (c.get("apiKey")) and takes no body field and no
    // second header, which is precisely what makes cross-key deletion
    // impossible. A jsonBody:true here would advertise a request body the
    // endpoint does not have.
    write: true,
    description:
      "Revoke the X account session you registered with twitter_customer_session, deleting the stored auth_token and ct0 from twitterapis.com. Self-serve, no ticket and no human in the loop. Scoped to your own API key by construction: it takes no account identifier of any kind, so it cannot reach another key's session. Idempotent and free: revoking twice, or revoking when nothing was stored, still returns ok with deleted=false, and it costs no credits, so a key that is out of balance can still delete its credentials. After this, the authenticated-account tools (twitter_home_timeline, twitter_bookmarks, twitter_dm_list, twitter_dm_conversation, twitter_user_likes) and the write tools stop acting as that account until you register again. IMPORTANT: this deletes the stored copy only. It does NOT log the account out of x.com, so to invalidate the cookies themselves, also revoke the session from your X account settings.",
    args: [],
  },
  {
    // CONTRACT NOTE (maintainers): the published spec documents an
    // {auth_token, ct0, twid} response for this endpoint. That is WRONG. The live
    // handler returns {ok, username, message} and stores the minted session
    // server-side; it never returns the cookies. The description below documents
    // the REAL contract, not the spec's. Fixing the spec's response schema is a
    // docs/website change. Note this is a RESPONSE-shape error, which is why the
    // build cannot catch it: the generator reads request params only, and no gate
    // in this repo reads the live API. Keep the note until the spec is corrected.
    name: "twitter_user_login",
    endpoint: "/user/user_login",
    write: true, jsonBody: true,
    description:
      "Log in to X with a username and password (plus totp_secret if the account has 2FA) and store the resulting session against your API key, so the authenticated-account reads and the write tools then act as that account. On success returns { ok, username, message }; it does NOT return the session cookies (auth_token/ct0 are minted and kept server-side, never sent back). Typical failures: bad_credentials (401), two_factor_required (400, add totp_secret), captcha_required (422), acid_challenge (409, confirm the login from the account then retry). This handles real account credentials; never log or echo the values you pass.",
    args: [
      { name: "username",
        describe:
          "The X account username/handle (without the leading @). Some accounts also accept the login email here." },
      { name: "password",
        describe:
          "The X account password." },
      { name: "totp_secret",
        describe:
          "The account's base32 two-factor (TOTP) secret. Required only when the account has 2FA enabled." },
      // Added 2026-08-09 when the refreshed spec exposed both. Verified against
      // the live handler (backend src/server/routes/user-login.ts), which reads
      // body.proxy_url and body.user_agent and stores them on the resulting
      // session, so they describe the SESSION's ongoing egress and fingerprint,
      // not merely the one login call.
      { name: "proxy_url",
        describe:
          "Optional. HTTP or SOCKS proxy URL to perform the login through, e.g. 'http://user:pass@host:port'. Stored with the session and reused for its later requests. Omit to log in directly from the service's own IP. A residential proxy is recommended: X treats datacenter logins as automated." },
      { name: "user_agent",
        describe:
          "Optional. Browser User-Agent to mint and use the session with. Defaults to a current Chrome UA. Keep it consistent with the environment the account normally signs in from; a mismatch between the UA and the session is itself a signal to X." },
    ],
  },
  {
    name: "twitter_media_upload",
    endpoint: "/media/upload",
    write: true, jsonBody: true,
    description:
      "Upload an image to X and get a media_id to attach to a tweet via twitter_create_tweet's media_ids. Provide media_data as base64-encoded image bytes. Acts as your registered account session (register first with twitter_customer_session or twitter_user_login, or pass auth_token/ct0 for this call). Returns ok and the media_id. Only base64 image data is supported over this tool's JSON transport.",
    args: [
      { name: "media_data",
        describe:
          "Base64-encoded image bytes to upload. Sent in the JSON request body." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_media_status",
    endpoint: "/media/status",
    description:
      "Check whether an uploaded media_id has finished processing on X, before you attach it to a tweet. Video, GIF and large uploads are processed ASYNCHRONOUSLY: twitter_media_upload returns a media_id immediately, but attaching it via twitter_create_tweet FAILS until X reports state 'succeeded'. Poll this until then. Returns media_id, state ('pending', 'in_progress', 'succeeded' or 'failed'), check_after_secs (how long X asks you to wait before polling again, honour it rather than tight-looping), progress_percent, and an error object when state is 'failed'. Reads through YOUR OWN registered account session, the same one that performed the upload, so register first with twitter_customer_session or twitter_user_login, or pass auth_token/ct0 for this call. This is a READ: no daily write cap applies.",
    args: [
      { name: "media_id",
        describe:
          "Numeric media id returned by twitter_media_upload, e.g. '1234567890123456789'." },
      "@INLINE",
      "@PROJECTION",
    ],
  },
  // ── Writes: Articles (X's long-form "Notes" feature, #1096) ────────────────
  // An article is a DRAFT until published, then it is PUBLISHED and carries a
  // public announcement tweet. Every op below except twitter_article_get acts
  // AS the account behind your registered session (same auth model as
  // twitter_create_tweet / twitter_dm_send): register first with
  // twitter_customer_session or twitter_user_login, or pass auth_token/ct0
  // per-call via @INLINE. twitter_article_get is the one PUBLIC read (same
  // auth model as twitter_tweet_detail): just your API key, no session.
  {
    name: "twitter_article_create",
    endpoint: "/article/create",
    write: true,
    description:
      "Start a new DRAFT article ('Note') AS your authenticated account. No input required. Returns the new article's id (pass this to twitter_article_update_title / twitter_article_update_content / twitter_article_publish / twitter_article_delete) and its full article object. Requires an authenticated session with write capability behind your key.",
    args: [
      "@INLINE",
    ],
  },
  {
    name: "twitter_article_update_cover_media",
    endpoint: "/article/update_cover_media",
    write: true,
    description:
      "Attach an ALREADY-UPLOADED image as the cover of a DRAFT or PUBLISHED article, AS your authenticated account. This does NOT upload: call twitter_media_upload first and pass the media_id it returns. Provide the article's id (from twitter_article_create or twitter_article_list). Requires an authenticated session with write capability behind your key. Returns the updated article object with cover_media populated.",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list (e.g. 'ArticleEntity:1234567890123456789')." },
      { name: "media_id",
        describe:
          "The media id returned by twitter_media_upload for the image to use as the cover." },
      { name: "media_category", required: false,
        describe:
          "Optional. X's media category for the upload. Defaults to 'DraftTweetImage', which is what X's own article editor sends for a cover image. Only set this if you know X expects a different category." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_article_update_title",
    endpoint: "/article/update_title",
    write: true,
    description:
      "Set or replace the title of a DRAFT or PUBLISHED article AS your authenticated account. Provide the article's id (from twitter_article_create or twitter_article_list) and the new title. Requires an authenticated session with write capability behind your key. Returns the updated article object.",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list (e.g. 'ArticleEntity:1234567890123456789')." },
      { name: "title", minLength: 1,
        describe:
          "The new article title (non-empty)." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_article_update_content",
    endpoint: "/article/update_content",
    write: true, jsonBody: true,
    description:
      "Replace the body content of a DRAFT or PUBLISHED article AS your authenticated account. Provide the article's id and content_state: Draft.js JSON ({ blocks: [...], entityMap: [...] }) that YOU build; blocks are forwarded with only data/text/key/type/entityRanges/inlineStyleRanges (X rejects any other block field, depth included). Block types X accepts: unstyled, header-two, unordered-list-item, ordered-list-item, blockquote, atomic (a one-space block carrying an entity via entityRanges [{key, offset: 0, length: 1}]); inline styles Bold and Italic. Entity data is snake_case on INPUT and X returns it camelCase: TWEET (an embedded post) {tweet_id}; MEDIA (an inline image) {caption, entity_key, media_items: [{local_media_id, media_category: 'DraftTweetImage', media_id}]} with media_id from twitter_media_upload; DIVIDER {}; LINK {url} (a Mutable entity over a text range, not atomic); MARKDOWN {markdown} (tables). A wrong field is refused by X's schema and this tool answers 422 with reason validation_failed and the offending path in detail. Requires an authenticated session with write capability behind your key. Returns the updated article object (content_state echoed camelCase, media_entities populated for MEDIA).",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list." },
      { name: "content_state", type: "json",
        describe:
          "Draft.js content state object: { blocks: [...], entityMap: [...] } in the shape the X Article editor produces. entityMap is an ARRAY of {key: '0', value: {type, mutability, data}}; entity data keys are snake_case on input (tweet_id, media_items, local_media_id, media_category, media_id, entity_key). Unknown fields are refused by X (422, reason validation_failed, detail names the path)." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_article_publish",
    endpoint: "/article/publish",
    write: true,
    description:
      "Publish a DRAFT article AS your authenticated account, transitioning it to Published and posting a REAL, PUBLIC announcement tweet that your followers and anyone with the link can see. WARNING: this is a genuinely consequential, hard-to-fully-undo action, it is not like saving a draft. twitter_article_unpublish reverts the article to Draft but LEAVES the announcement tweet up; only twitter_article_delete on a published article unpublishes AND removes the announcement tweet, and by then the content was already public for however long it stayed up. Confirm with the caller before publishing unless they have clearly asked for it. Provide the article's id; audience and reply_control default to 'Everyone' when omitted; caption is an optional short (<=256 character) caption for the announcement tweet. Requires an authenticated session with write capability behind your key. Returns the updated (Published) article object.",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list. Must currently be a Draft." },
      { name: "audience", required: false,
        describe:
          "Optional. Who can see the published article, e.g. 'Everyone'. Defaults to 'Everyone' when omitted." },
      { name: "reply_control", required: false,
        describe:
          "Optional. Who can reply to the announcement tweet, e.g. 'Everyone'. Defaults to 'Everyone' when omitted." },
      { name: "caption", required: false,
        describe:
          "Optional. Short caption text for the announcement tweet, up to 256 characters." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_article_unpublish",
    endpoint: "/article/unpublish",
    write: true, destructive: true,
    description:
      "Revert a PUBLISHED article back to Draft AS your authenticated account. The announcement tweet the publish posted is LEFT IN PLACE, still publicly visible, use twitter_article_delete instead if you also want that tweet removed. X refuses this with an 'invalid_lifecycle' error if the article is not currently Published. Requires an authenticated session with write capability behind your key. Returns the updated (Draft) article object.",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list. Must currently be Published." },
      "@INLINE",
    ],
  },
  {
    name: "twitter_article_get",
    endpoint: "/article/get",
    description:
      "Read an article's full content (title, content_state, cover media, author, timestamps, public_url). Two mutually exclusive forms. PUBLIC: provide id or url of the article's announcement tweet, no registered session or per-call credentials needed, just your API key, same auth model as twitter_tweet_detail, works for PUBLISHED articles only. OWNER-ONLY: provide article_id (the article's own entity id, from twitter_article_create or twitter_article_list), requires an authenticated session, also reaches your own Drafts, which have no announcement tweet the public form could resolve. Returns 404 (article null) if not found, not visible, or (article_id form) not owned by the calling account.",
    args: [
      "@TWEET_REF",
      { name: "article_id", required: false,
        describe:
          "OWNER-ONLY form. The article's own entity id, from twitter_article_create or twitter_article_list (e.g. 'ArticleEntity:1234567890123456789', or the bare numeric rest_id). Requires an authenticated session. Provide exactly one of id, url, or article_id." },
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_article_list",
    endpoint: "/article/list",
    description:
      "List YOUR OWN articles (drafts or published) AS your authenticated account, most recent first. X exposes no combined view, so this filters to ONE lifecycle per call: pass lifecycle='published' to list published articles, omit it (or pass 'draft') for drafts. Requires an authenticated session behind your key. Returns count, next_cursor (pass it back as cursor to fetch the next page; null/absent means no more pages), and the page of article objects.",
    args: [
      { name: "lifecycle", enum: ["draft", "published"], required: false,
        describe:
          "Which lifecycle to list: 'draft' or 'published'. Defaults to 'draft' when omitted. X has no combined view, list each lifecycle separately." },
      { name: "count", type: "int", min: 1, max: 100,
        describe:
          "Max articles to return for this page, 1 to 100. Defaults to 20 when omitted." },
      "@CURSOR",
      "@INLINE",
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_article_delete",
    endpoint: "/article/delete",
    write: true, destructive: true,
    description:
      "Delete an article AS your authenticated account. A DRAFT is hard-deleted outright; a PUBLISHED article is unpublished first and then its announcement tweet is deleted too, so this is the one op that fully removes a published article's public footprint (compare twitter_article_unpublish, which leaves the tweet up). Irreversible. lifecycle and tweet_id are optional fast-path hints (read them off a prior twitter_article_create or twitter_article_list response): when omitted, the server figures out the lifecycle itself by scanning your own Draft then Published articles, which costs an extra round trip. Requires an authenticated session with write capability behind your key. Returns ok/deleted and the id you targeted.",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list." },
      { name: "lifecycle", enum: ["draft", "published"], required: false,
        describe:
          "Optional fast-path hint: 'draft' or 'published', if you already know it. Omit to let the server resolve it (slower, one extra lookup)." },
      { name: "tweet_id", required: false,
        describe:
          "Optional fast-path hint: the announcement tweet id, only meaningful when lifecycle is 'published'. Omit to let the server resolve it from your own article list." },
      "@INLINE",
    ],
  },
  // ── Monitoring: account monitors + webhooks (task #14/#488) ────────────────
  // Free account administration, not metered Twitter reads: monitor/webhook CRUD
  // is zero-rated in billing (same precedent as customer/session, account/me,
  // account/payments). Watch an X handle with twitter_monitor_create; register a
  // delivery URL with twitter_monitor_webhook_create; every new post from a watched
  // handle is HMAC-signed and POSTed to your registered webhook(s). /monitor/{id}
  // and /webhook/{id} are each served under more than one HTTP method (POST to
  // update, DELETE to remove), so every tool below that targets one of those two
  // paths sets method explicitly to say which.
  {
    name: "twitter_monitor_create",
    endpoint: "/monitor",
    method: "POST",
    write: true, jsonBody: true,
    // Fixed 2026-08-16: the backend's createMonitorRoute reads ONLY
    // `await c.req.json()` with no query-string fallback (unlike most
    // write endpoints, which go through resolveBodyParam's dual-mode
    // query-or-body resolution). Without jsonBody:true this tool sent
    // every arg as a query string the backend never reads, so EVERY call
    // failed with a 400 "Provide `handle` ... in the JSON body" -- live-
    // reproduced against production before this fix.
    description:
      "Start watching an X account for new posts. Every new post from that handle is HMAC-signed and delivered to your registered webhook(s) on a shared poll interval (see twitter_monitor_webhook_create to register a delivery URL first). Free: monitor creation is account administration, not a metered read. Returns the new monitor's id, plus its normalized handle, status, and poll_interval_ms.",
    args: [
      { name: "handle", minLength: 1,
        describe:
          "The X username to watch, without the leading @ (e.g. 'elonmusk')." },
      { name: "webhook_ids", required: false,
        describe:
          "Optional. Comma-separated webhook id(s) from twitter_monitor_webhook_create to restrict this monitor's deliveries to. Omit to deliver to every active webhook on the account (the default)." },
      { name: "include_replies", required: false,
        describe:
          "Optional boolean. true delivers the account's replies as well as its own posts, which is the default and what every monitor has always done; false holds replies back and delivers only the account's own posts. Must be a real boolean: the string \"false\" and the number 0 are rejected with a 400 rather than coerced, because coercing them would quietly give you the opposite of what you typed, and the wrong answer here is invisible since it looks exactly like the account not having posted." },
      { name: "domain_filter", required: false,
        describe:
          "Optional. A bare hostname ('example.com') or a full URL ('https://example.com/blog') to restrict delivery to only the new posts that link to that host or a subdomain of it (e.g. 'example.com' matches both example.com and blog.example.com). Normalized server-side: lowercased, scheme/path/query/fragment/leading www./trailing :port stripped. Omit for no filter, the default (deliver every new post). Rejected with a 400 if what remains after normalization is not a valid hostname shape. A post with no matching link is filtered out of delivery, never silently dropped: it still advances the monitor's cursor and counts toward the account's tweets_domain_filtered health metric." },
    ],
  },
  {
    name: "twitter_monitor_list",
    endpoint: "/monitor",
    method: "GET",
    description:
      "List every monitor on your account: id, subject (its from:<handle> query), kind, status ('active' or 'paused'), degraded flag, events_possibly_missed, webhook_ids restriction, and created_at. Takes no arguments.",
    args: [],
  },
  {
    name: "twitter_monitor_update",
    endpoint: "/monitor/{id}",
    method: "POST",
    write: true, jsonBody: true,
    // Fixed 2026-08-16, same root cause as twitter_monitor_create above:
    // updateMonitorRoute also reads only c.req.json(), no query fallback.
    description:
      "Partially update an existing monitor: pause or resume it via status, change which webhooks receive its events via webhook_ids, change or clear its domain_filter, or any combination in the same call (applied atomically). Resuming a paused monitor re-runs the same capacity and per-account cap checks as creating a new one, since it adds load back to the shared pool. Free per call. All three fields are optional; omit any of them to leave that part unchanged.",
    args: [
      { name: "id",
        describe:
          "The monitor's id, from twitter_monitor_create or twitter_monitor_list." },
      { name: "status", enum: ["active", "paused"], required: false,
        describe:
          "'paused' to pause the monitor, 'active' to resume it. Omit to leave status unchanged." },
      { name: "webhook_ids", required: false,
        describe:
          "Optional. Comma-separated webhook id(s) to restrict delivery to. Pass an empty string to clear the restriction back to 'deliver to every active webhook'. Omit entirely to leave it unchanged." },
      { name: "domain_filter", required: false, nullable: true,
        describe:
          "Optional. A bare hostname or full URL to restrict delivery to, same shape and normalization as twitter_monitor_create's domain_filter. Pass an empty string (or null) to clear an existing filter back to 'deliver every new post'. Omit entirely to leave the current filter unchanged. Rejected with a 400 if a non-empty value does not normalize to a valid hostname." },
      { name: "include_replies", required: false,
        describe:
          "Optional boolean. true delivers the account's replies as well as its own posts, false holds replies back and delivers only its own posts. Omit the field entirely to leave it unchanged. Same boolean-only validation as twitter_monitor_create: a non-boolean is a 400 rather than a coercion." },
    ],
  },
  {
    name: "twitter_monitor_delete",
    endpoint: "/monitor/{id}",
    method: "DELETE",
    write: true, destructive: true,
    description:
      "Stop and remove a monitor by id. Irreversible: create a new monitor with twitter_monitor_create if you want to watch that handle again. Delivery history referencing this monitor is retained, not cascade-deleted. Free per call.",
    args: [
      { name: "id",
        describe:
          "The monitor's id, from twitter_monitor_create or twitter_monitor_list." },
    ],
  },
  {
    name: "twitter_monitor_health",
    endpoint: "/monitor/{id}/health",
    description:
      "Read one monitor's current status, degradation flag, poll interval, possibly-missed-event count, and cursor position (last_tweet_id, last_poll_at), for building your own health dashboard. Free per call.",
    args: [
      { name: "id",
        describe:
          "The monitor's id, from twitter_monitor_create or twitter_monitor_list." },
    ],
  },
  {
    name: "twitter_monitor_account_health",
    endpoint: "/monitor/health",
    description:
      "Account-wide monitoring rollup in ONE call, distinct from twitter_monitor_health (which needs an id and reports one monitor's cursor): service status ('operational' or 'degraded'), active/paused/total counts across every monitor you own, and pending/delivered/failed delivery counts from the last 24 hours. Takes no arguments. A key with zero monitors gets zeroed counts back, never an error. Free per call.",
    args: [],
  },
  {
    name: "twitter_monitor_deliveries",
    endpoint: "/monitor/deliveries",
    description:
      "List your most recent monitor delivery events across every monitor, most recent first: id, monitor_id, tweet_id, status, tweet_created_at, and the real measured latency (detected_lag_ms, from X's own post timestamp to enqueue; delivery_lag_ms, the separate queue-to-webhook-POST time; total_lag_ms). Free per call.",
    args: [
      { name: "limit", type: "int", min: 1, max: 200,
        describe:
          "Max delivery events to return, 1 to 200. Defaults to 50 when omitted." },
      "@PROJECTION",
    ],
  },
  {
    name: "twitter_x_user_stream_add_user",
    endpoint: "/oapi/x_user_stream/add_user_to_monitor_tweet",
    method: "POST",
    write: true, jsonBody: true,
    // Fixed 2026-08-16, same root cause: addUserToMonitorTweetRoute
    // (the x_user_stream compat module) reads only c.req.json(), no query fallback.
    description:
      "Compat drop-in for twitter_monitor_create using an x_user_stream-shaped request/response envelope: watch an X account for new posts, translated onto the same underlying monitor system. Free per call. Prefer twitter_monitor_create for new integrations; this exists for migrating an existing x_user_stream-shaped integration without a rewrite.",
    args: [
      { name: "x_user_name",
        describe:
          "The X username to watch, without the @." },
    ],
  },
  {
    name: "twitter_x_user_stream_remove_user",
    endpoint: "/oapi/x_user_stream/remove_user_to_monitor_tweet",
    method: "POST",
    write: true, destructive: true, jsonBody: true,
    // Fixed 2026-08-16, same root cause: removeUserToMonitorTweetRoute
    // (the x_user_stream compat module) reads only c.req.json(), no query fallback.
    description:
      "Compat drop-in for twitter_monitor_delete using an x_user_stream-shaped envelope: stop watching an account. Irreversible. Free per call.",
    args: [
      { name: "id_for_user",
        describe:
          "The monitor id, from twitter_x_user_stream_list_users. Same value as a twitter_monitor_* tool's monitor id." },
    ],
  },
  {
    name: "twitter_x_user_stream_list_users",
    endpoint: "/oapi/x_user_stream/get_user_to_monitor_tweet",
    description:
      "Compat drop-in for twitter_monitor_list using an x_user_stream-shaped envelope: list every account you are currently tweet-monitoring. Honest field mapping, not fabricated: x_user_id is always null (this API stores no numeric Twitter user id) and is_monitor_profile is always 0 (profile-change monitoring is not a capability this API has). Free per call.",
    args: [],
  },
  {
    name: "twitter_monitor_webhook_create",
    endpoint: "/webhook",
    method: "POST",
    write: true, jsonBody: true,
    // Fixed 2026-08-16, same root cause: createWebhookRoute (webhook.ts)
    // reads only c.req.json(), no query fallback.
    description:
      "Register an HTTPS endpoint to receive signed monitor events. The HMAC signing secret is returned ONLY in this response, store it immediately: it cannot be retrieved again, and it is what you use to verify the X-TwitterAPIs-Signature header on every delivery. Free per call.",
    args: [
      { name: "url", minLength: 1,
        describe:
          "Your https delivery endpoint, e.g. 'https://example.com/webhooks/twitterapis'. Private, loopback, link-local, and metadata IPs are refused, re-checked at every delivery, not just at registration." },
    ],
  },
  {
    name: "twitter_monitor_webhook_list",
    endpoint: "/webhook",
    method: "GET",
    description:
      "List every webhook registered on your account: id, url, status ('active' delivers, 'disabled' means the endpoint returned a 410 Gone and needs re-registering to reactivate), and created_at. The signing secret is never returned here, only at creation. Takes no arguments.",
    args: [],
  },
  {
    name: "twitter_monitor_webhook_delete",
    endpoint: "/webhook/{id}",
    method: "DELETE",
    write: true, destructive: true,
    description:
      "Soft-delete a webhook by id: it stops receiving deliveries immediately and disappears from twitter_monitor_webhook_list, but delivery history referencing it is retained rather than cascade-deleted. Irreversible from the caller's side (register a new webhook with twitter_monitor_webhook_create to resume delivery). Free per call.",
    args: [
      { name: "id",
        describe:
          "The webhook's id, from twitter_monitor_webhook_create or twitter_monitor_webhook_list." },
    ],
  },
  {
    name: "twitter_monitor_webhook_test",
    endpoint: "/webhook/{id}/test",
    write: true,
    description:
      "Send one HMAC-signed test event to this webhook's URL right now and return the outcome synchronously: delivered (true if your endpoint returned a 2xx within the delivery timeout), status_code, and error. Unlike a real monitor event, a test send is never queued, retried, or dead-lettered, it is a one-shot diagnostic to confirm your endpoint and signature verification both work before relying on the webhook. Free per call.",
    args: [
      { name: "id",
        describe:
          "The webhook's id, from twitter_monitor_webhook_create or twitter_monitor_webhook_list." },
    ],
  },
  {
    name: "twitter_monitor_webhook_redrive",
    endpoint: "/webhook/{id}/redrive",
    write: true,
    // The handler reads max_age_hours and limit from the BODY only, so without
    // this every call would go out as a query string and 400. Caught by
    // body-mode-parity, which reads the backend's own generated manifest.
    jsonBody: true,
    description:
      "Replay deliveries that dead-lettered while your endpoint was down. A delivery is dead-lettered after it fails all 8 attempts across 21 minutes, so an outage longer than that window loses those events; this re-queues them with a full retry budget, oldest first. Bounded by default so a recovered endpoint is not flooded: max_age_hours defaults to 24 and limit to 100. Returns requeued and skipped_permanent. A delivery that died for a permanent reason, a 410 Gone, a deleted webhook, or a URL egress refused, is not replayed, because it would fail the same way and spend the budget again. Replayed events carry the same signature and payload as the original, so make your handler idempotent on the event id if a duplicate would matter. Returns 409 if the webhook is disabled, which happens after your endpoint answers 410 Gone: re-register it first. Free per call.",
    args: [
      { name: "id",
        describe:
          "The webhook's id, from twitter_monitor_webhook_create or twitter_monitor_webhook_list." },
      { name: "max_age_hours", required: false,
        describe:
          "Optional. How far back to look for dead-lettered deliveries, 1 to 168 hours. Defaults to 24." },
      { name: "limit", required: false,
        describe:
          "Optional. Most deliveries to replay in one call, 1 to 1000, oldest first. Defaults to 100." },
    ],
  },
];
