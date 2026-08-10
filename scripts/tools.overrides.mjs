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

/** Reusable arg runs. A tool references one as the string "@NAME". */
export const ARG_GROUPS = {
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
      describe:
        "Max items to return for this page. Typical range 1 to 200; endpoint default (20) applies if omitted. To page through results, pass the cursor from the previous response." },
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
  // from a pool). Omit them to use the key's linked session. Sent as x-* REQUEST
  // HEADERS, never in the URL, so they appear in no spec and are marked
  // header:true to exempt them from the param cross-check.
  INLINE: [
    { name: "auth_token", required: false, header: true,
      describe:
        "Optional. The account's auth_token cookie, to act AS that account for this call (must be paired with ct0). Sent as the x-auth-token header; never placed in the URL." },
    { name: "ct0", required: false, header: true,
      describe:
        "Optional. The account's ct0 cookie, paired with auth_token. Sent as the x-ct0 header." },
    { name: "proxy_url", required: false, header: true,
      describe:
        "Optional. Residential proxy URL to egress this call through. Recommended for writes: X soft-blocks writes from datacenter IPs as automated. Sent as the x-proxy-url header." },
    { name: "user_agent", required: false, header: true,
      describe:
        "Optional. User-Agent string to send for this session. Sent as the x-user-agent header." },
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
    ],
  },
  {
    name: "twitter_user_search",
    endpoint: "/user/search",
    description:
      "Search for Twitter/X user accounts by name, keyword, or topic. Returns matching profiles (username, display name, bio, follower count, verification status) with a pagination cursor. Use this to discover accounts in a niche, find brand handles, or locate a person when you only know their name.",
    args: [
      { name: "query",
        describe:
          "Name, keyword, or topic to search accounts for. Examples: 'OpenAI', 'AI researcher', 'tech founder'." },
      "@PAGINATION",
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
    ],
  },
  {
    name: "twitter_users_by_ids",
    endpoint: "/users/by_ids",
    description:
      "Resolve up to 100 numeric user ids into full profiles in ONE call. Same user object as twitter_user_info_by_id, returned as a list. Use this whenever you hold several ids and would otherwise loop twitter_user_info_by_id, for example hydrating the authors of a batch of tweets. Ids that no longer resolve (suspended or deleted accounts) are omitted rather than returned as nulls; compare the requested and resolved counts in the response, or diff the returned ids against the ones you sent, to see which were dropped. Sending more than 100 ids is rejected rather than truncated, so a short list always means those accounts are gone, never that the request was clipped.",
    args: [
      { name: "user_ids",
        describe:
          "Comma-separated numeric Twitter/X user ids, up to 100 (e.g. '44196397,745273'). Duplicates are collapsed and billed once." },
    ],
  },
  {
    name: "twitter_user_about",
    endpoint: "/user/user_about",
    description:
      "Get a user's full 'About' object: the structured profile facts X surfaces beyond the bio, including account category and professional/business labels, verification and identity-verification flags, joined date, location and linked website, follower/following counts, and X's 'About this account' transparency panel (the account's country, how the account was created, and its username-change history). Provide a username or a user_id. Use this to enrich a profile beyond what twitter_user_info returns.",
    args: [
      "@USER_REF",
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
    ],
  },
  // ── Reads: a user's tweets / timeline ──────────────────────────────────────
  {
    name: "twitter_user_tweets",
    endpoint: "/user/tweets",
    description:
      "Get a user's recent posting timeline. IMPORTANT: this endpoint does NOT filter server-side, so the response routinely includes retweets and replies alongside original posts. Every item carries is_retweet, is_reply and is_quote booleans, so filter client-side on those flags if you need originals only, and read author.username rather than assuming every item was written by the requested user (a retweet's retweeted_tweet holds the original author). Returns tweet text, id, timestamp, and engagement metrics. Paginate with cursor to go further back. For the full back-catalogue in one call, use twitter_user_tweets_complete.",
    args: [
      "@USER_REF",
      "@PAGINATION",
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
    ],
  },
  {
    name: "twitter_user_tweets_complete",
    endpoint: "/user/tweets/complete",
    description:
      "Get a user's near-complete original-tweet history in a single call, auto-paginating server-side up to a cap (Twitter's ~3200-tweet per-user ceiling). Heavier than twitter_user_tweets; use when you want the whole back-catalogue at once rather than page-by-page. Returns a flat tweet array. Requires the numeric user_id (resolve a handle first with twitter_user_info).",
    args: [
      { name: "user_id",
        describe:
          "Numeric Twitter/X user id. Required: this endpoint does not accept a username. Resolve a handle to a user_id first with twitter_user_info." },
      { name: "max", type: "int", min: 1, max: 3200,
        describe:
          "Maximum number of tweets to collect (default 800, hard ceiling 3200). Higher values take longer and cost more." },
    ],
    omit: {
      cursor:
        "Not exposed by the hand-written catalog and kept unexposed here so this generator is behaviour-preserving. The endpoint does accept a resume cursor; surfacing it is a real improvement and a deliberate separate change, not something a codegen should decide.",
    },
  },
  {
    name: "twitter_user_media",
    endpoint: "/user/media",
    description:
      "Get the images and videos a user has posted. Returns media-containing tweets with URLs to the media files, dimensions, and type (photo/video/animated_gif). Paginate with cursor. Use this to pull a user's visual content history.",
    args: [
      "@USER_REF",
      "@PAGINATION",
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
    ],
  },
  // ── Reads: trends ──────────────────────────────────────────────────────────
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
    ],
  },
  {
    name: "twitter_trends_locations",
    endpoint: "/trends/locations",
    description:
      "List every location X publishes trends for, each with the numeric WOEID to pass back to twitter_trends as woeid. Takes no parameters. Use this to resolve a country or city to its WOEID before requesting trends for that place.",
    args: [],
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
  // ── Reads: authenticated-account surfaces (require a session behind your key) ─
  {
    name: "twitter_home_timeline",
    endpoint: "/user/home_timeline",
    description:
      "Get YOUR authenticated account's Home timeline (the 'Following'/'For you' feed), most recent first. Requires an authenticated session behind your key. Returns tweets with author and metrics plus a cursor. Use this to read what your account would see when it opens X.",
    args: [
      "@PAGINATION",
      "@INLINE",
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
    ],
  },
  {
    name: "twitter_dm_list",
    endpoint: "/dm/list",
    description:
      "List YOUR authenticated account's Direct Message conversations (inbox), each with the participant and a conversation_id you can pass to twitter_dm_conversation. Requires an authenticated session behind your key. Read-only: this does not send DMs.",
    args: [
      "@INLINE",
    ],
  },
  {
    name: "twitter_dm_conversation",
    endpoint: "/dm/conversation",
    description:
      "Get the messages in one Direct Message conversation by its conversation_id (from twitter_dm_list). Requires an authenticated session behind your key. Returns each message with sender id, time, and text. Read-only: this does not send DMs.",
    args: [
      { name: "conversation_id",
        describe:
          "The conversation_id from a twitter_dm_list entry identifying which DM thread to read." },
      "@INLINE",
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
      "Follow a user AS your authenticated account, by numeric user_id. Requires write capability behind your key. Reverse with twitter_unfollow_user.",
    args: [
      { name: "user_id",
        describe:
          "Numeric user id of the account to follow. Resolve a handle to a user_id first with twitter_user_info." },
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
      "Unfollow a user AS your authenticated account, by numeric user_id. Requires write capability behind your key.",
    args: [
      { name: "user_id",
        describe:
          "Numeric user id of the account to unfollow." },
      "@INLINE",
    ],
    omit: {
      proxy:
        "Deliberately not a tool arg. The catalog routes a caller-supplied proxy through the x-proxy-url REQUEST HEADER instead (see the proxy_url arg in @INLINE), because a proxy URL routinely embeds user:pass credentials and a query-string param would write those into every URL and access log along the path.",
    },
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
      "Replace the body content of a DRAFT or PUBLISHED article AS your authenticated account. Provide the article's id and content_state: Draft.js JSON ({ blocks: [...], entityMap: [...] }) that YOU build and pass through verbatim, this tool does not construct or validate it. Requires an authenticated session with write capability behind your key. Returns the updated article object.",
    args: [
      { name: "id",
        describe:
          "The article's entity id, from twitter_article_create or twitter_article_list." },
      { name: "content_state", type: "json",
        describe:
          "Draft.js content state object: { blocks: [...], entityMap: [...] }. You construct this JSON yourself (it is the same shape the X Article editor produces); it is passed through to X verbatim and not validated here." },
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
];
