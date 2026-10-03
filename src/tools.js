// GENERATED FILE. DO NOT EDIT BY HAND.
//
// Built by scripts/gen-tools.mjs from:
//   test/openapi.snapshot.json    the vendored REST contract (structure)
//   scripts/tools.overrides.mjs   the hand-authored agent-facing layer (prose)
//
// Edit one of those two, then run `npm run build`. `npm test` regenerates this
// file in memory and fails if it does not match what is committed, so a hand edit
// here is caught rather than shipped.
//
// Catalog: 112 tools (68 reads, 44 writes).
//
// Each tool maps 1:1 to a REST endpoint at https://api.twitterapis.com. Tool arg
// names map 1:1 to endpoint query params (every endpoint, including the POST
// write actions, reads its params from the query string), except the per-call
// inline credentials, which travel as x-* request headers, the 14
// jsonBody tools, whose fields travel in a JSON request body, and any arg listed
// in pathParams, which is substituted into the URL path (e.g. {id}) instead. A
// tool with `method: "POST"` or `method: "DELETE"` is a write that acts on
// behalf of the authenticated account behind your API key; reads are GET and
// default when `method` is omitted.
//
// write:true       -> action mutates account/Twitter state (readOnlyHint:false)
// destructive:true -> action removes/reverses state (delete, un-follow/like/RT/bookmark)
// local:"<name>"   -> src/index.js dispatches the call to a handler in this
//                     package instead of a plain passthrough (feedback's draft
//                     queue); args flagged local:true in the overrides are
//                     consumed there and never reach the API
// pathParams        -> arg names substituted into the URL template, not sent as
//                      query-string or body fields (e.g. ["id"] for /monitor/{id})
import { z } from "zod";

export const TOOLS = [
  {
    name: "twitter_advanced_search",
    path: "/twitter/tweet/advanced_search",
    description:
      "Searches recent tweets with X's advanced-search operators: from:, to:, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:links, -filter:replies, lang:en, and free text. Returns tweet text, author info, engagement metrics and a pagination cursor. product='Latest' gives chronological results; 'Top' (the default) is engagement-ranked. Example queries: 'AI agents min_faves:100', 'from:openai filter:links since:2024-01-01', '#buildinpublic -filter:replies lang:en'. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/search/tweet-advanced-search",
    shape: {
      query: z.string().describe(
        "Full advanced-search query string. Supports X operators: from:handle, to:handle, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:links, filter:images, filter:videos, -filter:replies, lang:en, #hashtag, \"exact phrase\". Example: 'from:openai min_faves:500 since:2024-01-01'.",
      ),
      product: z.enum(["Top","Latest","Media","People"]).optional().describe(
        "Result ranking mode. 'Latest' = reverse-chronological. 'Top' = engagement-ranked (default when omitted). 'Media' = tweets with images/video. 'People' = matching user accounts.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_search",
    path: "/twitter/user/search",
    description:
      "Searches Twitter/X user accounts by display name or handle (X's People search). Bio text is not searched, so a word that appears only in a bio returns no match. Returns matching profiles (username, display name, bio, follower count, verification status) with a pagination cursor. Covers brand handles, partial handles, and people known only by name. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/search/user-search",
    shape: {
      query: z.string().describe(
        "Name, brand, or partial handle to search accounts for, matched against display name and handle. Examples: 'OpenAI', 'Sam Altman', 'stablecoin'.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_info",
    path: "/twitter/user/info",
    description:
      "Returns a user's complete public profile by @handle: display name, bio, follower count, following count, verification status, location, website, account creation date, pinned tweet, and the numeric user_id. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-info",
    shape: {
      username: z.string().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. 'elonmusk', 'openai', 'sama').",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_info_by_id",
    path: "/twitter/user/info_by_id",
    description:
      "Returns a user's complete public profile by numeric user id: display name, bio, follower and following counts, verification status, location, website, account creation date and pinned tweet. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-info-by-id",
    shape: {
      user_id: z.string().describe(
        "Numeric Twitter/X user id (e.g. '44196397' for @elonmusk), as it appears in API responses under user_id or author_id.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_status",
    path: "/twitter/user/status",
    description:
      "Reports whether a Twitter/X account is alive, suspended, or deleted. Returns a status field that is one of 'alive', 'suspended', 'not_found' or 'unavailable', plus the numeric id when the account is alive and X's own reason when it gives one. It distinguishes a suspended or deleted account from a handle that does not exist, which a profile read answers the same way. Every outcome is a successful response: the answer is in the status field, and a suspension is not an error. A protected (private) account counts as alive, since protection is a visibility setting and not an account state. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-status",
    shape: {
      userName: z.string().describe(
        "Twitter/X handle WITHOUT the leading @ (e.g. 'elonmusk', 'openai', 'sama').",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_about",
    path: "/twitter/user/user_about",
    description:
      "Returns a user's full 'About' object: the structured profile facts X surfaces beyond the bio, including account category and professional/business labels, verification and identity-verification flags, joined date, location and linked website, follower/following counts, and X's 'About this account' transparency panel (the account's country, how the account was created, and its username-change history). Takes a username or a user_id. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-user-about",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_about_batch",
    path: "/twitter/user/user_about/batch",
    description:
      "Returns the 'About' object (account country, how the account was created, username-change history, verification and the other About fields) for up to 100 accounts in one call. Takes usernames or user_ids as a comma-separated list, not both. Results come back in request order, each with an about object or an error code (not_found is billed; forbidden is free, X refuses that account to everyone; rate_limited and unavailable are free and retryable). Billed per account X answered for. One batch per API key runs at a time: a concurrent call gets 429 batch_in_progress (not billed). fields/compact apply inside each item's about object (fields=account_based_in); a results.* path returns about: {}. Cost: $0.0008 per billed item. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-user-about-batch",
    shape: {
      usernames: z.string().optional().describe(
        "Comma-separated handles, with or without the leading @ (e.g. 'openai,naval,sama'). 1 to 100 after duplicates are removed.",
      ),
      user_ids: z.string().optional().describe(
        "Comma-separated numeric user ids (e.g. '44196397,745273'), as an alternative to usernames. 1 to 100.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_affiliates",
    path: "/twitter/user/affiliates",
    description:
      "Lists the affiliated accounts of an organization profile (the smaller accounts X displays under a company's 'Affiliated' badge, e.g. employees or sub-brands). Takes a username or user_id. Returns profile data per affiliate plus a pagination cursor, and an empty list for accounts with no affiliations. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-affiliates",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      team: z.string().optional().describe(
        "Optional team/sub-group name to filter affiliates by, when the org exposes named teams.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_check_follow_relationship",
    path: "/twitter/user/check_follow_relationship",
    description:
      "Returns the follow relationship between two accounts: whether the source follows the target, whether the target follows the source, and blocking/muting flags where available. Each side is a numeric user id or a username (an unknown username or id returns a not-found error, not billed). Covers checking a follow before or after a follow action, and detecting mutuals. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-check-follow-relationship",
    shape: {
      source_user_id: z.string().optional().describe(
        "Numeric user id of the SOURCE account (the 'is this account following...' subject). Alternative: source_username.",
      ),
      source_username: z.string().optional().describe(
        "Handle of the SOURCE account, as an alternative to source_user_id.",
      ),
      target_user_id: z.string().optional().describe(
        "Numeric user id of the TARGET account (the '...the target?' object). Alternative: target_username.",
      ),
      target_username: z.string().optional().describe(
        "Handle of the TARGET account, as an alternative to target_user_id.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_check_follow_relationship_batch",
    path: "/twitter/user/check_follow_relationship/batch",
    description:
      "Checks one account against up to 100 others in one call. Either one source (source_user_id or source_username) with up to 100 targets (target_usernames or target_user_ids), or one target with up to 100 sources (source_usernames or source_user_ids): a list on one side only. Each result carries the relationship from the SOURCE's side (following = source follows target, followed_by = target follows source), in request order. Example: which accounts on a shortlist already follow a brand, with the brand as target_username and the shortlist as source_usernames. Billed per pair answered with a relationship; not_found, forbidden, rate_limited and unavailable pairs are free. One batch per API key runs at a time (a concurrent call gets 429 batch_in_progress, not billed). fields/compact apply inside each item's relationship object. Cost: $0.0008 per billed item. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-check-follow-relationship-batch",
    shape: {
      source_user_id: z.string().optional().describe(
        "Numeric id of the single SOURCE account, when the list is targets.",
      ),
      source_username: z.string().optional().describe(
        "Handle of the single SOURCE account, when the list is targets.",
      ),
      target_user_id: z.string().optional().describe(
        "Numeric id of the single TARGET account, when the list is sources.",
      ),
      target_username: z.string().optional().describe(
        "Handle of the single TARGET account, when the list is sources.",
      ),
      target_usernames: z.string().optional().describe(
        "Comma-separated target handles (with or without @), 1 to 100, when the source is fixed.",
      ),
      target_user_ids: z.string().optional().describe(
        "Comma-separated numeric target ids, 1 to 100, when the source is fixed.",
      ),
      source_usernames: z.string().optional().describe(
        "Comma-separated source handles (with or without @), 1 to 100, when the target is fixed.",
      ),
      source_user_ids: z.string().optional().describe(
        "Comma-separated numeric source ids, 1 to 100, when the target is fixed.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_audience_summary",
    path: "/twitter/user/audience_summary",
    description:
      "Summarises an audience in one call: samples up to 100 followers of an account (username or user_id) or retweeters of a tweet (tweet_id), reads each sampled account's About country, and returns a country histogram (shares over accounts with a known country) plus a likely-bot share from documented profile signals (default avatar, no bio, under 5 followers, extreme follow ratio, no posts, created in the last 30 days, digit-suffix handle; 3 or more signals = likely automated, a heuristic, not a verdict). Billed per item: each sample page that added accounts plus each sampled account X answered About for, so sample=100 costs at most $0.08 plus up to 3 pages. Shares the one-batch-per-key slot with the batch endpoints. Cost: $0.0008 per billed item. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-audience-summary",
    shape: {
      username: z.string().optional().describe(
        "Handle whose FOLLOWERS are sampled (alternative: user_id).",
      ),
      user_id: z.string().optional().describe(
        "Numeric id whose FOLLOWERS are sampled (alternative: username).",
      ),
      tweet_id: z.string().optional().describe(
        "Tweet whose RETWEETERS are sampled, instead of a user's followers.",
      ),
      source: z.string().optional().describe(
        "Optional: 'followers' (with username/user_id) or 'retweeters' (with tweet_id), matching the identifier sent.",
      ),
      sample: z.number().int().optional().describe(
        "How many accounts to sample, 10 to 100 (default 50).",
      ),
    },
  },
  {
    name: "twitter_user_tweets",
    path: "/twitter/user/tweets",
    description:
      "Returns a user's recent posting timeline, cursor-paginated further back. The endpoint does not filter server-side, so the response routinely includes retweets and replies alongside original posts. Every item carries is_retweet, is_reply and is_quote booleans, and author.username names who wrote it (a retweet's retweeted_tweet holds the original author). Returns tweet text, id, timestamp and engagement metrics. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-tweets",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_tweets_and_replies",
    path: "/twitter/user/tweets_and_replies",
    description:
      "Returns a user's full activity timeline: their original tweets and their replies to others, cursor-paginated. Shows how someone engages with a community, not just what they post. Items carry is_retweet, is_reply and is_quote booleans. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-tweets-and-replies",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_tweets_complete",
    path: "/twitter/user/tweets/complete",
    description:
      "Returns a large batch of a user's tweet history in one call, auto-paginating server-side across upstream pages: { count, next_cursor, has_more, tweets }. One call does not guarantee the whole history: next_cursor is the completion signal, not count. A non-null next_cursor means the history is truncated and more remains, and passing it back as cursor continues from where the call stopped; a null next_cursor means the history is complete (has_more is the same signal as a boolean). Each call is bounded by both max and a server-side wall-clock budget, so a response can be truncated even when it holds fewer tweets than max, which is why count is not a completion signal. Takes the numeric user_id only. Billed flat per call regardless of how many tweets come back, so fewer, larger calls cost less than many small ones. Cost: $0.0024 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-tweets-complete",
    shape: {
      user_id: z.string().describe(
        "Numeric Twitter/X user id. Required: this endpoint does not accept a username.",
      ),
      max: z.number().int().min(1).max(3200).optional().describe(
        "Target number of tweets to collect in this call. Defaults to 200 when omitted. This is a minimum target, not a hard cap: pages arrive in whole chunks, so a response may contain up to one page (<=100) more than requested (measured live 2026-09-05: max=10 returned 20), and count can differ from max. Twitter's ~3200-per-user history ceiling applies overall.",
      ),
      cursor: z.string().optional().describe(
        "Resume point from a previous response's next_cursor. Absent on the first request; with it, collection continues where the last call stopped, for as long as next_cursor is non-null.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_media",
    path: "/twitter/user/media",
    description:
      "Returns the images and videos a user has posted: media-containing tweets with URLs to the media files, dimensions, and type (photo/video/animated_gif), cursor-paginated. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-media",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_mentions",
    path: "/twitter/user/mentions",
    description:
      "Returns recent public tweets that mention (@ tag) a user, found with the to: search operator, with author info and metrics, cursor-paginated. Covers brand mentions, replies directed at an account, and public conversations about a person. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-mentions",
    shape: {
      username: z.string().describe(
        "Twitter/X handle WITHOUT the leading @ of the user to find mentions for (e.g. 'openai' to find tweets mentioning @openai).",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_likes",
    path: "/twitter/user/likes",
    description:
      "Returns the tweets a user has liked (their public Likes tab), most recent first, each with author and metrics, plus a pagination cursor. Empty if the account hides its likes. Takes the numeric user_id only. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-likes",
    shape: {
      user_id: z.string().describe(
        "Numeric Twitter/X user id (e.g. '44196397'). Required: this endpoint does not accept a username.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_user_followers",
    path: "/twitter/user/followers",
    description:
      "Lists the accounts that follow a given user, with profile data for each follower (username, display name, bio, follower count), cursor-paginated for large audiences. Covers audience analysis, such as who follows a brand or influencer. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/follower-graph/user-followers",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_following",
    path: "/twitter/user/following",
    description:
      "Lists the accounts a given user follows, with profile data for each account followed, cursor-paginated. Covers a user's information sources, influencer networks, and competitor monitoring lists. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/follower-graph/user-following",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_followers_v2",
    path: "/twitter/user/followers_v2",
    description:
      "Lists a user's followers in the v2 response shape: richer profile fields and more reliable cursoring for deep follower lists. Takes a username or user_id. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/follower-graph/user-followers-v2",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_following_v2",
    path: "/twitter/user/following_v2",
    description:
      "Lists the accounts a user follows in the v2 response shape: richer profile fields and more reliable cursoring for deep following lists. Takes a username or user_id. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/follower-graph/user-following-v2",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_user_verified_followers",
    path: "/twitter/user/verified_followers",
    description:
      "Lists a user's followers that have a verified account (checkmark), cursor-paginated: the follower list filtered to verified accounts, which surfaces notable or institutional followers. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/follower-graph/user-verified-followers",
    shape: {
      username: z.string().optional().describe(
        "Twitter/X handle without the leading @ (e.g. \"elonmusk\", \"openai\"). Exactly one of username or user_id is required.",
      ),
      user_id: z.string().optional().describe(
        "Numeric Twitter/X user id (e.g. \"44196397\"). Exactly one of username or user_id is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_followers_you_know",
    path: "/twitter/user/followers_you_know",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the 'Followers you know' for a target user id: the followers of that account that the authenticated account also follows (mutual-connection overlap). Requires an authenticated X session behind the API key. Returns profile data per overlap account plus a cursor. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/follower-graph/user-followers-you-know",
    shape: {
      user_id: z.string().describe(
        "Numeric user id of the target account to compute shared followers against.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_tweet_detail",
    path: "/twitter/tweet/detail",
    description:
      "Returns the full detail of a single tweet: text, author profile, post timestamp, like/retweet/reply/quote counts (quote_count is X's own total of quote tweets), attached media, referenced quoted tweet, and parent reply context. Takes the tweet id or its full URL. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/tweet-details/tweet-detail",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_tweet_replies",
    path: "/twitter/tweet/replies",
    description:
      "Returns replies to a specific tweet, each with author, text and metrics, cursor-paginated. Covers the conversation under a tweet, its sentiment, and notable responses. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/tweet-details/tweet-replies",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_tweet_thread",
    path: "/twitter/tweet/thread",
    description:
      "Returns all tweets in a thread: the connected chain of tweets posted by the SAME author in sequence (a tweetstorm or numbered thread). Any tweet id or url from the thread returns the full ordered sequence in a single call. Replies from other users are not included. Takes the tweet id or its full URL. Cost: $0.0040 per call. Docs: https://docs.twitterapis.com/docs/reference/tweet-details/tweet-thread",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_tweet_retweeters",
    path: "/twitter/tweet/retweeters",
    description:
      "Lists the accounts that retweeted a specific tweet, with profile data for each retweeter, cursor-paginated. Shows who amplified a piece of content and how it spread. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/tweet-details/tweet-retweeters",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_tweet_quotes",
    path: "/twitter/tweet/quotes",
    description:
      "Lists the tweets that QUOTE a specific tweet, cursor-paginated as full tweet objects, so each carries the commentary attached rather than just a number. A plain retweet carries no text and a reply is not a quote, so neither appears here. The endpoint is SEARCH-BACKED: X exposes no dedicated quote-tweets operation, so it runs the query quoted_tweet_id:<id> against X's search index. The returned 'count' is how many quotes this search returned, not the tweet's true total; the authoritative total is 'quote_count' on the tweet object, and the two differ because of index lag and because deleted, protected, suspended and region-withheld quotes are absent from search. Every response carries 'source' (\"search\"), 'search_query' (the exact query sent), and 'quote_matched' (how many returned tweets demonstrably quote the requested id). quote_matched equal to count means every row is genuine; quote_matched 0 on a NON-EMPTY page means X stopped honouring the operator and the rows are unrelated to the tweet. An empty first Top page is served from Latest instead of reading as zero quotes: the response then says product_used \"Latest\" and top_fallback true, and its next_cursor pages that Latest list. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/tweet-details/tweet-quotes",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      product: z.enum(["Latest","Top"]).optional().describe(
        "Search ordering. 'Latest' (default) is reverse-chronological and cheap. 'Top' is X's ranked ordering and is materially slower upstream. Any other value falls back to Latest.",
      ),
      strict: z.string().optional().describe(
        "\"true\" DROPS every returned row that does not demonstrably quote the requested tweet, instead of only counting them in quote_matched. Default false, because X does not embed the quoted original on every search result, so strict trades a false-positive risk for a false-negative one. Billing follows what is returned, so rows dropped by strict are not charged.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max quote tweets to request for this page. Defaults to 20 and is clamped to 1-100 by the underlying search, so a larger number returns at most 100 rather than erroring.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_list_members",
    path: "/twitter/list/members",
    description:
      "Lists the members of a Twitter/X List by its numeric list id, with profile data for each member, cursor-paginated. Covers curated account sets such as competitor lists, industry watchlists or media outlet lists. The list_id appears in the X.com list URL (x.com/i/lists/<list_id>). Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/list-data/list-members",
    shape: {
      list_id: z.string().describe(
        "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_list_followers",
    path: "/twitter/list/followers",
    description:
      "Lists a public List's followers by its numeric id, cursor-paginated. Followers and members are different sets of people: members are the accounts the List owner added to it, followers are the accounts that subscribed to read it. A List with hundreds of members commonly has only a handful of followers, so a small count here is normal and is not a truncated page. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/list-data/list-followers",
    shape: {
      list_id: z.string().describe(
        "Numeric Twitter/X List id. Found in the list URL: x.com/i/lists/<list_id>.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max items to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page. next_cursor is null once X marks the follower list complete.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_list_tweets",
    path: "/twitter/list/tweets",
    description:
      "Returns the posts written by the members of a public Twitter/X List, newest first, through X's search index. This is the FILTERABLE List feed: it accepts since and until date bounds and an include_replies toggle. It returns no retweets, and search-index lag applies, so a post made moments ago can be missing for a short while. Cursor-paginated. The list_id appears in the X.com list URL (x.com/i/lists/<list_id>). Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/list-data/list-tweets",
    shape: {
      list_id: z.string().describe(
        "Numeric Twitter/X List id, found in the list URL: x.com/i/lists/<list_id>. Public Lists only.",
      ),
      since: z.string().optional().describe(
        "Optional. Only posts on or after this date, as YYYY-MM-DD (e.g. \"2026-08-01\"). Any other format is rejected with a 400.",
      ),
      until: z.string().optional().describe(
        "Optional. Only posts BEFORE this date, as YYYY-MM-DD. EXCLUSIVE, matching X's own until: search operator, so a post made on the until date is not returned. Any other format is rejected with a 400.",
      ),
      include_replies: z.string().optional().describe(
        "Optional. Whether replies written by List members are included: the string \"true\" or \"false\"; defaults to true when omitted. Any other value is rejected with a 400 rather than read as false.",
      ),
      product: z.enum(["Latest","Top"]).optional().describe(
        "Which search ranking to read. 'Latest' (default) is reverse-chronological. 'Top' is X's ranked ordering. Any unrecognised value falls back to Latest rather than erroring.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max posts to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns at most 100 rather than erroring.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_list_timeline",
    path: "/twitter/list/timeline",
    description:
      "Returns a public Twitter/X List's NATIVE feed: the same posts and the same ordering the List shows on x.com, including members' retweets. It takes only list_id, count and cursor; no date range and no reply filter exist on this endpoint, because a native timeline cannot honour search operators. Cursor-paginated; an empty tweets array marks the end. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/list-data/list-timeline",
    shape: {
      list_id: z.string().describe(
        "Numeric Twitter/X List id, found in the list URL: x.com/i/lists/<list_id>. Public Lists only.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max posts to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns at most 100 rather than erroring.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_spaces_info",
    path: "/twitter/spaces/info",
    description:
      "Get metadata and the participant roster for one X Space by id, live or ended: title, lifecycle state (Scheduled, NotStarted, Running or Ended), host, topics, scheduled and actual start/end times, peak live listener count, replay view count, and the admin, speaker and listener rosters. Returns metadata only, NOT the Space audio. Note that X does not retain the per-person listener roster once a Space ends, so listeners comes back empty for an ended Space while total_live_listeners and total_replay_watched still reflect the real audience. All timestamps are millisecond-epoch numbers. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/spaces/spaces-info",
    shape: {
      id: z.string().describe(
        "The Space id: the trailing token of a x.com/i/spaces/<id> URL, e.g. '1RKZzjkoYRAKB'. A '/peek' suffix on the URL is not part of the id.",
      ),
      with_listeners: z.string().optional().describe(
        "Optional. Include the listener roster. Defaults to true. X drops this roster once a Space ends, so it is empty for an ended Space regardless of this flag.",
      ),
      with_replays: z.string().optional().describe(
        "Optional. Include replay availability and related metadata. Defaults to true.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_community_search",
    path: "/twitter/community/search",
    description:
      "Finds X Communities by keyword, cursor-paginated, returning each community's id. Each hit is a compact record: id, name, member count, nsfw flag, topic name, banners and the facepile avatars, exactly what X's own search sends and nothing more. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-search",
    shape: {
      query: z.string().describe(
        "Keyword to search for, 1 to 500 characters, e.g. 'build in public'.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_community_info",
    path: "/twitter/community/info",
    description:
      "Returns the metadata for one X Community by its numeric id: name, description, member_count, moderator_count, join_policy, invites_policy, the join question, primary topic, search tags, the posted rules, both the custom and the default banner plus a resolved banner_url, the permalink, the admin and creator profiles, and the facepile member ids. The community id is the digits in a x.com/i/communities/<id> URL. role, can_join, is_pinned and viewer_relationship_type are null by design, not an error: they describe the account that made the call, and this is a pooled read served by a rotating account. rules[].description is also null: X sends only the rule id and name on this payload. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-info",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'. Digits only. This is NOT a Space id (those are base-62 tokens) and NOT a user id.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_community_about",
    path: "/twitter/community/about",
    description:
      "The About tab for one X Community: its moderators, and a preview of its members, both returned as FULL user profiles with bio, follower and following counts, tweet counts, location, website, banner and join date, so it answers who runs a community in one call. It covers the PEOPLE, not the community object (name, description, rules, join policy). Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-about",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_community_members",
    path: "/twitter/community/members",
    description:
      "Lists the member roster of an X Community, cursor-paginated, with each row carrying that member's own role in the community: 'Admin', 'Moderator' or 'Member'. Rows are { user, role }. The user object is REDUCED (id, username, name, profile_image_url, is_blue_verified, verified, is_protected) because X's roster operation sends no bio, no follower or following counts and no created_at. The role on a member ROW is not caller-relative and is returned in full, unlike the role field on the community object itself. Admins and moderators are interleaved through this list at arbitrary positions, so one page filtered by role is not a complete moderator list. Paging is a bare next_cursor with no total count from X; the list ends when members comes back empty or has_more is false. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-members",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max roster rows to return for this page. Defaults to 20 and is clamped to 1-100, so a larger number returns 100 rather than erroring.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page. Absence of next_cursor is the only end-of-list signal X gives on this operation.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_community_moderators",
    path: "/twitter/community/moderators",
    description:
      "Lists the moderators and admins of an X Community, cursor-paginated, in { user, role } rows (the array is named members). This is a SEPARATE upstream operation, not a filter over the member roster: moderators sit at arbitrary positions inside the full roster, so filtering one roster page would return only the moderators among its first rows while looking like a complete answer. Admins appear here too; each row's role says which. Paging is a bare next_cursor with no total count from X. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-moderators",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max rows to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_community_tweets",
    path: "/twitter/community/tweets",
    description:
      "Returns an X Community's own post timeline, cursor-paginated as full tweet objects, with the community's PINNED post in its own separate 'pinned' field rather than as an item inside 'tweets'. X delivers the pinned post as a different timeline entry and does not repeat it in the feed, so 'tweets' alone omits it, and it is very often the community's rules post. One flat list is 'pinned' (when non-null) followed by 'tweets'; the pinned post is excluded from 'tweets', so there is no duplicate. ranking_mode is a REAL upstream parameter, not a local sort. Scope is one community. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-tweets",
    shape: {
      community_id: z.string().describe(
        "Numeric X community id, the digits in a x.com/i/communities/<id> URL, e.g. '1493446837214187523'.",
      ),
      ranking_mode: z.enum(["Recency","Relevance"]).optional().describe(
        "Ordering, sent to X as a real request parameter. 'Recency' is the default and the only value confirmed against a live capture. 'Relevance' is accepted because X's own community tab offers exactly two orderings, but it is NOT confirmed live. Any other value is rejected with a 400.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max posts to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_community_memberships",
    path: "/twitter/community/memberships",
    description:
      "The INVERSE community lookup: given a numeric X USER id, lists the communities that account belongs to, cursor-paginated. Each row is the FULL community object (member counts, rules, topic, policies, admin and creator). Takes a numeric user id ONLY, not a @handle. An EMPTY communities array is a real, successful answer (the account is in no communities), not a not-found. role / can_join / is_pinned / viewer_relationship_type are null on every community returned, because this is a pooled read. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/communities/community-memberships",
    shape: {
      user_id: z.string().describe(
        "Numeric X user id, e.g. '1281109705495130113'. Not a @handle and not a community id.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max communities to return for this page. Defaults to 20 and is clamped to 1-100.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent on the first page.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_grok_chat",
    path: "/twitter/grok/chat",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Asks X's own Grok a question as the authenticated account and returns ONE complete JSON reply: the answer text, citations (url, domain, title, snippet) merged and de-duplicated across every search Grok ran, the searches themselves (tool_calls), the conversation and turn ids, and both the requested model and which model ACTUALLY answered (they can differ). Grok reads X in real time, so it answers about what is being said right now, and a bare tweet or status URL as the message returns a structured summary of that post. The reply is text and JSON only: it has no image or media field. Buffered, not streamed. STATELESS: nothing is stored, so a multi-turn conversation carries its prior turns in messages[] along with conversation_id. Requires an authenticated X session for the acting account. Cost: $0.0040 per call. Docs: https://docs.twitterapis.com/docs/reference/grok/grok-chat",
    shape: {
      message: z.string().optional().describe(
        "The prompt, for a single-turn question, up to 20,000 characters. A bare tweet or status URL is a first-class input and comes back as a summary of that post. Either this or messages[] is required.",
      ),
      messages: z.string().optional().describe(
        "Prior turns for a multi-turn conversation, oldest first, each { role: 'user' | 'assistant', content: '...' } (X's own { sender: 1 | 2, message } shape also works, 2 being Grok). The endpoint stores nothing, so this array is the whole history Grok sees. Either this or message is required.",
      ),
      conversation_id: z.string().optional().describe(
        "Conversation id returned by a previous call. Absent on the first turn, in which case a new conversation is opened and its id returned.",
      ),
      mode: z.string().optional().describe(
        "Which Grok answers: 'auto' (default, balanced), 'fast' (quicker, less thorough) or 'expert' (slowest, most thorough). The response reports which model actually answered, which can differ from the mode requested.",
      ),
      image_count: z.number().int().optional().describe(
        "Forwarded to X as its image-generation count, clamped to 0 through 4 (default 4, the value X's own client sends); 0 asks for a text-only answer. The reply has no image field, so a generated image is not returned.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_grok_config",
    path: "/twitter/grok/config",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Reports whether the authenticated account can use Grok, and which models it may pick: eligibility, X's own reasons when it is NOT eligible (passed through verbatim, since X's policy is not visible to this API), whether free access is enabled, and the available model options. Eligibility is a property of the X ACCOUNT rather than of the API key. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/grok/grok-config",
    shape: {
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_trends",
    path: "/twitter/trends",
    description:
      "Returns the current top trends for a location, or for one of X's Explore topic tabs. With no parameter, returns Worldwide (WOEID 1, X's own default). country takes an ISO code or country name (e.g. 'US' or 'Japan'); woeid takes a numeric WOEID and wins when both are given. category reads an X Explore tab instead (trending, news, sports, entertainment or for_you), or business_and_finance for only the ranked trends X labels Business and finance, read from the Trending and News tabs. category cannot be combined with country or woeid (400). business_and_finance returns no story items and can return an empty list when X labels nothing Business and finance at that moment. Category results reflect the Explore view of the account the API reads with. Returns the as_of timestamp and the ranked trends; a location call also returns the resolved location and created_at. A category response echoes category and has location and created_at null. An Explore tab response lists X's ranked trends first, then the tab's story items: AI-written headlines X marks, each with the headline as query, an x.com/i/trending/<id> url and the post count as tweet_volume. Story items carry is_ai_story true, but so can a ranked trend X flags as AI-written; the x.com/i/trending url is what marks a story item. A tab may hold only story items. count truncates the list. A location X does not serve returns a 400. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/trends/trends",
    shape: {
      category: z.enum(["trending","news","sports","entertainment","for_you","business_and_finance"]).optional().describe(
        "Optional. An X Explore tab (trending, news, sports, entertainment or for_you), or business_and_finance: a filter that reads the Trending and News tabs and keeps only the ranked trends X itself labels Business and finance (no story items). Read in place of a location's trends. Cannot be combined with country or woeid.",
      ),
      country: z.string().optional().describe(
        "Country name or ISO code to get trends for, e.g. 'US' or 'Japan'. Resolved against the trends locations list. Absent: Worldwide.",
      ),
      woeid: z.string().optional().describe(
        "Numeric WOEID, as listed by the trends locations endpoint. Takes precedence over country when both are supplied.",
      ),
      count: z.number().int().min(1).optional().describe(
        "Truncates the returned trends list to at most this many. Absent: X's full list for the location or tab.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_trends_locations",
    path: "/twitter/trends/locations",
    description:
      "Lists every location X publishes trends for, each with its name and numeric WOEID. Takes no required parameters. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/trends/trends-locations",
    shape: {
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_account_me",
    path: "/account/me",
    description:
      "Returns your twitterapis.com account details: email, name, credits remaining, credits used, total requests made, and account creation date. Authenticated by the API key. An account read, not Twitter data; it spends no credits. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account/account-me",
    shape: {},
  },
  {
    name: "twitter_account_payments",
    path: "/account/payments",
    description:
      "Returns your twitterapis.com payment history: the list of top-ups and charges on the account. Authenticated by the API key. An account read, not Twitter data; it spends no credits. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account/account-payments",
    shape: {},
  },
  {
    name: "twitter_feedback_send",
    path: "/feedback",
    method: "POST",
    write: true,
    jsonBody: true,
    local: "feedback",
    localArgs: ["action","ids"],
    description:
      "Reports a product problem or gap in twitterapis.com to its team from inside this session. A report is first drafted to a local queue (action \"draft\", the default), which sends nothing; action \"send\" posts the drafts named in ids to POST /feedback and returns a server id per report. action \"list\" shows the pending drafts with their ids, and action \"discard\" drops drafts. A draft carries a type (bug, idea or missing_capability), a title of at most 120 characters, details of at most 8000 characters, an optional area, and optional evidence identifiers. Evidence fields left out are filled from the last failing call in this session (tool, endpoint, HTTP status, request id), and mcp_version and client are attached to every report. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account/feedback-post",
    shape: {
      action: z.enum(["draft","list","send","discard"]).optional().describe(
        "What to do. \"draft\" (default) queues a new report locally and sends nothing. \"list\" shows the pending drafts with their ids. \"send\" posts the drafts named in ids to twitterapis.com. \"discard\" drops the drafts named in ids.",
      ),
      type: z.enum(["bug","idea","missing_capability"]).optional().describe(
        "Required for a draft. \"bug\": a tool or endpoint misbehaved. \"idea\": a change that would have made the task easier. \"missing_capability\": the user needed something no tool provides.",
      ),
      title: z.string().optional().describe(
        "Required for a draft. One specific line, at most 120 characters, naming the endpoint and the defect, e.g. \"tweet/thread returns 502 when the root tweet is deleted\".",
      ),
      details: z.string().optional().describe(
        "Required for a draft. At most 8000 characters: three labelled bullets in order, What happened, Repro, Evidence, optionally preceded by a one-line summary of the goal. No quotes of the conversation.",
      ),
      area: z.string().optional().describe(
        "Optional. The endpoint or feature the report is about, e.g. \"tweet/thread\" or \"monitoring\". At most 80 characters.",
      ),
      evidence: z.record(z.string(), z.unknown()).optional().describe(
        "Optional identifiers only, not payloads: {tool, endpoint, status, request_id}. Fields left out are filled from the last failing call in this session; mcp_version and client are attached to every report.",
      ),
      ids: z.array(z.string()).optional().describe(
        "For action \"send\" or \"discard\": the draft ids to act on, exactly as shown by action \"list\".",
      ),
    },
  },
  {
    name: "twitter_feedback_get",
    path: "/feedback/{id}",
    pathParams: ["id"],
    description:
      "Returns the status of a feedback report this account sent earlier, by its server id: status new, triaged, shipped or declined, the team's response text if any, and updated_at, which moves only when the team acts on it. 404 if the id is not on this account. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account/feedback-id",
    shape: {
      id: z.string().describe(
        "The server id of a sent report (a UUID), as returned when the report was sent. Not a local draft id.",
      ),
    },
  },
  {
    name: "twitter_feedback_list",
    path: "/feedback",
    description:
      "Lists the feedback reports this account has already SENT to twitterapis.com, newest first: server-side reports, not local drafts that are still unsent. Each item carries id, type, title, area, status (new, triaged, shipped or declined), the team's response if any, created_at and updated_at; details and evidence are not included, so paging this cannot bulk-export a report's body. Cursor-paginated while next_cursor is non-null. Feedback calls share a 10-per-minute rate limit. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account/feedback-get",
    shape: {
      limit: z.number().int().min(1).max(100).optional().describe(
        "Max reports to return, 1 to 100. Defaults to 25. Anything outside that range is rejected with 400 naming limit.",
      ),
      cursor: z.string().optional().describe(
        "Opaque continuation token from a previous response's next_cursor. Absent: starts from the newest report. A cursor that cannot be decoded is a 400 naming cursor, not a silently empty page.",
      ),
      status: z.enum(["new","triaged","shipped","declined"]).optional().describe(
        "Optional. Return only reports in this state. Anything else is rejected with 400 naming status.",
      ),
      type: z.enum(["bug","idea","missing_capability"]).optional().describe(
        "Optional. Return only reports of this kind. Anything else is rejected with 400 naming type.",
      ),
    },
  },
  {
    name: "twitter_home_timeline",
    path: "/twitter/user/home_timeline",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Returns the authenticated account's Home timeline (the 'Following'/'For you' feed), most recent first: what that account sees when it opens X. Requires an authenticated X session behind the API key. Returns tweets with author and metrics plus a cursor. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-home-timeline",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_bookmarks",
    path: "/twitter/user/bookmarks",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the authenticated account's bookmarked tweets, most recent first. Requires an authenticated X session behind the API key. Returns each bookmarked tweet with author and metrics plus a cursor. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-bookmarks",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_blocking",
    path: "/twitter/user/blocking",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the accounts the authenticated account has BLOCKED, as full user objects, cursor-paginated. Requires an authenticated X session behind the API key. There is no user_id argument: X provides no way to read another account's block list, so this reads the authenticated account's only. An empty users array is a real answer meaning the account blocks nobody, not a silent failure, because the endpoint returns an error status rather than an empty page when it cannot read the list. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-blocking",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_muting",
    path: "/twitter/user/muting",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the accounts the authenticated account has MUTED, as full user objects, cursor-paginated. Muting hides an account's posts from the timeline without blocking it, so the mute list is a different list from the block list and an account can appear in one and not the other. Requires an authenticated X session behind the API key. There is no user_id argument: X provides no way to read another account's mute list. An empty users array means the account mutes nobody, not a silent failure. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-muting",
    shape: {
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_bookmark_search",
    path: "/twitter/user/bookmark_search",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Full-text search within the authenticated account's bookmarks. Requires an authenticated X session behind the API key. Returns matching bookmarked tweets plus a cursor. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-bookmark-search",
    shape: {
      query: z.string().describe(
        "Search terms matched against the bookmarked tweets' text.",
      ),
      count: z.number().int().min(1).max(200).optional().describe(
        "Requested page size, capped at 200. Advisory on this endpoint: X's own search backend typically returns around 13 to 20 tweets per page regardless of the value requested, an upstream limit this API does not control. More results come from paging with next_cursor, not from a larger count.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_bookmark_folders",
    path: "/twitter/user/bookmark_folders",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the authenticated account's bookmark FOLDERS (X's internal name: collections), the named groups saved tweets can be organised into, separate from the flat bookmarks list. Requires an authenticated X session behind the API key. Returns each folder's id, name, and a cover image. Takes no arguments; the folders resolve from the session alone. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-bookmark-folders",
    shape: {
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_bookmark_folder_timeline",
    path: "/twitter/user/bookmark_folder_timeline",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Returns the tweets inside ONE of the authenticated account's bookmark folders, identified by folder_id. Requires an authenticated X session behind the API key. Cursor-paginated; there is no count/page-size argument for this operation. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/user-reads/user-bookmark-folder-timeline",
    shape: {
      folder_id: z.string().describe(
        "The bookmark folder's id, as listed in the account's bookmark folders (e.g. '2073826456430592429').",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
      paid_promotion: z.enum(["only","exclude"]).optional().describe(
        "Optional. Filters this page's tweets by X's Paid partnership label: \"only\" keeps tweets whose is_paid_promotion is true, \"exclude\" keeps the rest. It filters the page X returned and fetches no more, so a page can hold fewer tweets than requested, or none, while next_cursor still pages on; the response carries paid_promotion_filter { mode, kept, removed }. A retweet is judged by its own flag, not the retweeted post's. Same cost as without it.",
      ),
    },
  },
  {
    name: "twitter_dm_list",
    path: "/twitter/dm/list",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the authenticated account's Direct Message conversations (inbox), each with the participant and its conversation_id. Requires an authenticated X session behind the API key. Read-only: sends nothing. It reads X's standard DM inbox, so conversations X has moved to end-to-end encrypted chat may not appear, and conversations still in the message-requests folder may be missing. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/direct-messages/dm-list",
    shape: {
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_dm_conversation",
    path: "/twitter/dm/conversation",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Returns the messages in one Direct Message conversation by its conversation_id. Requires an authenticated X session behind the API key. Returns each message with sender id, time, and text, plus min_entry_id and max_entry_id for the page; max_id set to a page's min_entry_id returns the next older page. Read-only: sends nothing. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/direct-messages/dm-conversation",
    shape: {
      conversation_id: z.string().describe(
        "The conversation_id of the DM thread to read, as listed in the DM inbox.",
      ),
      max_id: z.string().optional().describe(
        "Optional. Pages backwards: returns entries older than this numeric entry id (a previous page's min_entry_id). Absent: the newest page. A non-numeric value returns 400.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_dm_send",
    path: "/twitter/dm/send",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Sends a Direct Message as the authenticated account to a recipient's numeric user id (recipient_id) with the message text. Requires an authenticated X session with write capability behind the API key; X soft-blocks writes from datacenter IPs, and a residential proxy_url makes delivery more reliable. Returns message_id and conversation_id. Delivers a real DM and is not silently reversible. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/direct-messages/dm-send",
    shape: {
      recipient_id: z.string().describe(
        "Numeric Twitter/X user id of the recipient (e.g. '44196397'), not a @handle. The recipient's settings have to allow DMs from the sending account.",
      ),
      text: z.string().min(1).describe(
        "The Direct Message body text to send (non-empty).",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_create_tweet",
    path: "/twitter/tweet/create",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Posts a new tweet as the authenticated account. reply_to posts it as a reply, quote as a quote-tweet. It publishes publicly and is not silently reversible; removal is a separate delete. Requires an authenticated X session with write capability behind the API key. Returns the new tweet_id and url. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-create",
    shape: {
      text: z.string().min(1).describe(
        "The tweet body text (1 to 280 characters, or longer if the account has extended limits).",
      ),
      reply_to: z.string().optional().describe(
        "Optional. Numeric id of the tweet to reply to. When set, this tweet is posted as a reply in that conversation.",
      ),
      quote: z.string().optional().describe(
        "Optional. Numeric id of the tweet to quote. When set, this tweet quote-tweets that tweet.",
      ),
      media_ids: z.string().optional().describe(
        "Optional. Comma-separated media id(s) from a prior media upload to attach (images/video).",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_delete_tweet",
    path: "/twitter/tweet/delete",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Deletes a tweet as the authenticated account. Irreversible: the tweet is permanently removed. Only tweets the authenticated account authored can be deleted. Takes the tweet id or url. Requires write capability behind the API key. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-delete",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_update_profile",
    path: "/twitter/user/update_profile",
    method: "POST",
    write: true,
    jsonBody: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Changes the display name, bio, location or link on the authenticated account's own X profile. This is a PARTIAL update: only the fields sent change, and every omitted field keeps its current value, so a name alone leaves the bio intact. An empty string CLEARS that field, which differs from omitting it: \"\" blanks the value, an absent key leaves it alone. At least one of name, description, location or url is required, and a request whose only value is an empty string is a valid clear rather than an empty request. It writes a real profile and takes effect immediately with no undo. Requires an authenticated X session behind the API key. Returns ok and updated_fields, which echoes the field names SENT rather than a diff against the previous profile. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/user-update-profile",
    shape: {
      name: z.string().optional().describe(
        "Optional. New display name, up to 50 characters. Absent: unchanged.",
      ),
      description: z.string().optional().describe(
        "Optional. New bio. Send an EMPTY STRING to clear it; OMIT the field to leave it alone. Those are different.",
      ),
      location: z.string().optional().describe(
        "Optional. New location text. Same rule: an empty string clears it, omitting the field leaves it alone.",
      ),
      url: z.string().optional().describe(
        "Optional. New profile link.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_update_avatar",
    path: "/twitter/user/update_avatar",
    method: "POST",
    write: true,
    jsonBody: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Replaces the profile picture on the authenticated account's own X profile. Takes ONE field, image, holding base64-encoded image bytes: not a URL, not multipart, and not a media upload id. It writes a real profile and takes effect immediately with NO UNDO, and X keeps no history of the previous picture; its current URL is profile_image_url on the profile. Returns ok. X mints a new media id for every accepted upload, so profile_image_url changes even when the image is byte-identical to the one already in place. Requires an authenticated X session behind the API key. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/user-update-avatar",
    shape: {
      image: z.string().describe(
        "Required. Base64-encoded image bytes. Not a URL, not multipart, and not a media_id. banner and data are accepted as aliases for this same field.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_update_banner",
    path: "/twitter/user/update_banner",
    method: "POST",
    write: true,
    jsonBody: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Replaces the wide header image on the authenticated account's own X profile. Takes ONE field, banner, holding base64-encoded image bytes: not a URL, not multipart, and not a media upload id. X renders the header as a wide strip, so a 3:1 image fills it without cropping. It writes a real profile and takes effect immediately with NO UNDO, and X keeps no history of the previous banner; its current URL is cover_picture on the profile. Returns ok. At least one of X's own endpoints reports cover_picture as empty for accounts that plainly have a banner, so an empty cover_picture is not by itself evidence the account has none. Requires an authenticated X session behind the API key. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/user-update-banner",
    shape: {
      banner: z.string().describe(
        "Required. Base64-encoded image bytes. Not a URL, not multipart, and not a media_id. image and data are accepted as aliases for this same field.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_draft_create",
    path: "/twitter/draft/create",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Saves a PRIVATE draft tweet on the authenticated account. Nothing is posted and nobody can see it: the draft lands in X's own composer under Drafts until a person publishes or deletes it. Requires an authenticated X session behind the API key. Returns ok and draft_tweet_id. A null draft_tweet_id means X refused the create; that answers 422 and is not billed. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/draft-create",
    shape: {
      text: z.string().min(1).describe(
        "The draft body text. Required: a draft with no text is refused with 400, so a media-only draft cannot be created through this API.",
      ),
      reply_to: z.string().optional().describe(
        "Optional. Numeric id of the tweet this draft replies to, as a string: X ids are 19 digits, and an unquoted number is refused rather than silently rounded to a different tweet.",
      ),
      quote: z.string().optional().describe(
        "Optional. Numeric id of the tweet this draft quotes, as a string (same reason as reply_to).",
      ),
      media_ids: z.string().optional().describe(
        "Optional. Comma-separated media id(s) from a prior media upload to attach. Up to 4.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_draft_edit",
    path: "/twitter/draft/edit",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Replaces the contents of one existing PRIVATE draft on the authenticated account. The fields sent BECOME the draft rather than merging into it, so any field left out is dropped, including media. Posts nothing. Requires an authenticated X session behind the API key. Returns ok and the draft_tweet_id edited. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/draft-edit",
    shape: {
      id: z.string().describe(
        "Numeric id of the draft to edit (its draft_tweet_id). Also accepted by the API as draft_tweet_id.",
      ),
      text: z.string().min(1).describe(
        "The replacement draft body text. Required: an edit with no text is refused with 400.",
      ),
      reply_to: z.string().optional().describe(
        "Optional. Numeric id of the tweet this draft replies to, as a string.",
      ),
      quote: z.string().optional().describe(
        "Optional. Numeric id of the tweet this draft quotes, as a string.",
      ),
      media_ids: z.string().optional().describe(
        "Optional. Comma-separated media id(s) to attach. Omitting this drops whatever media the draft had; it is not merged.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_draft_delete",
    path: "/twitter/draft/delete",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Deletes one PRIVATE draft from the authenticated account by id. Irreversible, but low-stakes: a draft is not public, so this retracts nothing and notifies nobody. Requires an authenticated X session behind the API key. Returns ok, deleted, and the draft_tweet_id targeted. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/draft-delete",
    shape: {
      id: z.string().describe(
        "Numeric id of the draft to delete (its draft_tweet_id). Also accepted by the API as draft_tweet_id.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_draft_list",
    path: "/twitter/draft/list",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the PRIVATE drafts saved on the authenticated account, the source of draft ids for an edit or a delete. Drafts are private to the account that holds them, so no other account's drafts are readable. Requires an authenticated X session behind the API key. Returns drafts (each with draft_tweet_id, text, thread_truncated), count, and sometimes partial. thread_truncated true means the draft is a THREAD and text is only its first tweet, which is a parse that succeeded. partial true means X's answer was read but not fully understood, which is NOT 'no drafts': partial is absent entirely on a clean read, so an empty drafts array with no partial flag means the account has none. One call returns the whole list; there is no cursor and no timestamp on a draft row. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/draft-list",
    shape: {
      ascending: z.string().optional().describe(
        "Optional. The STRING \"true\" asks X for the oldest draft first. Any other value, or none, sends ascending=false, which is what X's own composer sends. The resulting order is X's and is not re-sorted, so newest-first is not guaranteed.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_scheduled_create",
    path: "/twitter/scheduled/create",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Schedules a tweet to POST PUBLICLY at a future instant from the authenticated account. This is NOT a draft: it goes out on its own at execute_at unless it is cancelled first. execute_at is epoch SECONDS, not milliseconds (a Date.now() millisecond value is 1000x too large), and a millisecond value is refused with a message naming the unit rather than scheduling the post tens of thousands of years out. It has to be strictly in the future. Requires an authenticated X session behind the API key. Returns ok, scheduled_tweet_id, and the execute_at sent. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/scheduled-create",
    shape: {
      text: z.string().min(1).describe(
        "The tweet body text that will be published. Required: a scheduled post with no text is refused with 400.",
      ),
      execute_at: z.number().int().describe(
        "Posting time, as epoch SECONDS in the future (for example 1829752200). NOT milliseconds: a value of 1000000000000 or more is rejected as a millisecond timestamp. Also accepted by the API as schedule_at.",
      ),
      reply_to: z.string().optional().describe(
        "Optional. Numeric id of the tweet this post replies to, as a string.",
      ),
      quote: z.string().optional().describe(
        "Optional. Numeric id of the tweet this post quotes, as a string.",
      ),
      media_ids: z.string().optional().describe(
        "Optional. Comma-separated media id(s) from a prior media upload to attach. Up to 4.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_scheduled_delete",
    path: "/twitter/scheduled/delete",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Cancels one PENDING scheduled post on the authenticated account so it does not publish. Applies only before its execute_at: once the post has gone out there is no scheduled row left to cancel, and what remains is an ordinary tweet. Requires an authenticated X session behind the API key. Returns ok, deleted, and the scheduled_tweet_id targeted. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/scheduled-delete",
    shape: {
      id: z.string().describe(
        "Numeric id of the scheduled post to cancel (its scheduled_tweet_id). Also accepted by the API as scheduled_tweet_id.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_scheduled_list",
    path: "/twitter/scheduled/list",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the posts QUEUED to publish on the authenticated account: the source of scheduled ids for a cancel, and a record of what is already queued. Rows carry X's own state label verbatim (for example Scheduled), and a row that has already published leaves the queue and becomes an ordinary tweet. Requires an authenticated X session behind the API key. Returns scheduled (each with scheduled_tweet_id, text, thread_truncated, execute_at, state), count, and sometimes partial. thread_truncated is INFERRED on this endpoint rather than captured: a scheduled row carries the same compose payload a draft row does, and the captured scheduled row elides that body, so the flag is sound and fail-safe (an absent key yields false) but has not been seen true. execute_at comes back in epoch SECONDS: X answers this operation in milliseconds and the value is normalised, so it is in the same unit the scheduling input takes. partial true means X's answer was read but not fully understood, which is not the same as an empty queue; on a clean read it is absent entirely. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/scheduled-list",
    shape: {
      ascending: z.string().optional().describe(
        "Optional. The STRING \"true\" returns the oldest row first. Any other value, or none, returns X's default order.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_favorite_tweet",
    path: "/twitter/tweet/favorite",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Likes (favorites) a tweet as the authenticated account. Takes the tweet id or url. Requires write capability behind the API key. Reversible. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-favorite",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_unfavorite_tweet",
    path: "/twitter/tweet/unfavorite",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Removes a like (unfavorite) from a tweet as the authenticated account. Takes the tweet id or url. Requires write capability behind the API key. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-unfavorite",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_retweet",
    path: "/twitter/tweet/retweet",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Retweets a tweet as the authenticated account. Takes the tweet id or url. Requires write capability behind the API key. Reversible. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-retweet",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_unretweet",
    path: "/twitter/tweet/unretweet",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Undoes a retweet as the authenticated account. Takes the tweet id or url. Requires write capability behind the API key. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-unretweet",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_bookmark_tweet",
    path: "/twitter/tweet/bookmark",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Bookmarks a tweet to the authenticated account's private bookmarks. Takes the tweet id or url. Requires write capability behind the API key. Reversible. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-bookmark",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_unbookmark_tweet",
    path: "/twitter/tweet/unbookmark",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Removes a tweet from the authenticated account's bookmarks. Takes the tweet id or url. Requires write capability behind the API key. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/tweet-unbookmark",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_follow_user",
    path: "/twitter/user/follow",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Follows a user as the authenticated account, by numeric user_id or by @handle (exactly one of the two). Requires write capability behind the API key. Reversible. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/user-follow",
    shape: {
      user_id: z.string().optional().describe(
        "Numeric user id of the account to follow. Exactly one of user_id or username is required; user_id skips the handle lookup.",
      ),
      username: z.string().optional().describe(
        "The @handle without the leading @ (e.g. \"elonmusk\") of the account to follow. Exactly one of user_id or username is required; the API resolves the handle to its id on every call, not from a cache, so a renamed account is followed by its current handle.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_unfollow_user",
    path: "/twitter/user/unfollow",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Unfollows a user as the authenticated account, by numeric user_id or by @handle (exactly one of the two). Requires write capability behind the API key. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/user-unfollow",
    shape: {
      user_id: z.string().optional().describe(
        "Numeric user id of the account to unfollow. Exactly one of user_id or username is required.",
      ),
      username: z.string().optional().describe(
        "The @handle without the leading @ of the account to unfollow. Exactly one of user_id or username is required; resolved to its id on every call, not from a cache.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_list_add_member",
    path: "/twitter/list/add_member",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Adds one account to a Twitter/X List that the registered X session owns, by numeric list id and numeric user id. Example: adding each speaker at a conference to a List as they are announced. Returns ok, action, list_id, user_id, the List's member_count read back from X after the write, and the full list object. member_count confirms the change landed; it is null when X returned no list object at all, which is itself the not-applied signal. A write that does not apply (the account is already a member, the List belongs to another account) comes back with the SAME field layout plus a 422 and a machine-readable reason, and is not billed. Reversible. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/list-add-member",
    shape: {
      list_id: z.string().describe(
        "Numeric id of a List the session owns, found in the list URL: x.com/i/lists/<list_id>.",
      ),
      user_id: z.string().describe(
        "Numeric user id of the account to add (not a handle).",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_list_remove_member",
    path: "/twitter/list/remove_member",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Removes one account from a Twitter/X List that the registered X session owns, by numeric list id and numeric user id. Example: pruning accounts that have gone quiet from a curated List. Returns ok, action, list_id, user_id, the List's member_count read back from X after the write, and the full list object. member_count confirms the removal landed; it is null when X returned no list object at all, which is itself the not-applied signal. A write that does not apply (the account was not a member, the List belongs to another account) comes back with the SAME field layout plus a 422 and a machine-readable reason, and is not billed. Reversible. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/list-remove-member",
    shape: {
      list_id: z.string().describe(
        "Numeric id of a List the session owns, found in the list URL: x.com/i/lists/<list_id>.",
      ),
      user_id: z.string().describe(
        "Numeric user id of the account to remove (not a handle).",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_list_create",
    path: "/twitter/list/create",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Creates a new Twitter/X List owned by the registered X session, with a name and an optional description and privacy flag. Returns ok, action, the new list_id, member_count, and the full list object X returned. A List is PUBLIC unless is_private is \"true\", and a private List is not readable through the public List reads (members, tweets, timeline). Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/list-create",
    shape: {
      name: z.string().min(1).describe(
        "Display name for the new List, e.g. \"Founders\". Required; an empty or whitespace-only name is rejected with a 400.",
      ),
      description: z.string().optional().describe(
        "Optional. Description shown on the List, e.g. \"People building in public\". Defaults to empty.",
      ),
      is_private: z.string().optional().describe(
        "Optional. The string \"true\" creates a PRIVATE List. Defaults to false (public), because a public List can be made private later while a leak cannot be undone. A private List is not readable through the public List reads.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_customer_session",
    path: "/twitter/customer/session",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Registers your own X account session against the API key, so the authenticated-account reads (home timeline, bookmarks, DMs, likes, articles) and the write actions (posting, DMs, follows, likes, retweets, media upload, articles) act as that account. Takes the x.com session cookies auth_token and ct0 (copied from a logged-in browser), plus an optional user_agent and residential proxy_url. The cookies are stored server-side against the key and are not returned. Returns ok, the resolved username, and whether the session validated live. A username/password login is the alternative to raw cookies. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account-session/customer-session",
    shape: {
      auth_token: z.string().describe(
        "Your x.com auth_token cookie value, from a logged-in browser session. Stored server-side against the key; not returned.",
      ),
      ct0: z.string().describe(
        "Your x.com ct0 (CSRF) cookie value, from the same browser session. Paired with auth_token.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. Browser User-Agent to send with this session's requests. Defaults to a current Chrome UA.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. HTTP or SOCKS proxy URL to route this session's traffic through, in the form scheme://user:pass@host:port.",
      ),
    },
  },
  {
    name: "twitter_customer_session_status",
    path: "/twitter/customer/session/status",
    description:
      "Reads back the X account session registered against this API key, without changing it. Returns registered (false if none was registered), the resolved username and twitter_user_id the session maps to, status ('ok', or 'dead' once X has rejected the cookies), created_at, updated_at, last_used_at, and an egress block: source (one of session, sticky_residential, pool_residential, direct), customer_proxy_in_use (true when the registered proxy_url is the one writes leave from), and a note explaining that tier. It does not return auth_token, ct0, or any proxy URL. Answers 'which account am I posting as', 'has my session expired', and 'is the proxy I supplied being used'. Scoped to the calling API key by construction: it takes no account identifier of any kind, so it cannot read another key's session. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account-session/customer-session-status",
    shape: {},
  },
  {
    name: "twitter_customer_session_delete",
    path: "/twitter/customer/session/delete",
    method: "POST",
    write: true,
    description:
      "Revokes the X account session registered against this API key, deleting the stored auth_token and ct0 from twitterapis.com. Self-serve, with no ticket and no human in the loop. Scoped to the calling API key by construction: it takes no account identifier of any kind, so it cannot reach another key's session. Idempotent and free: revoking twice, or revoking when nothing was stored, returns ok with deleted=false, and it costs no credits, so a key that is out of balance can still delete its credentials. Afterwards the authenticated-account reads and the write actions stop acting as that account until a session is registered again. This deletes the stored copy only: it does not log the account out of x.com, and the cookies themselves stay valid until the session is revoked in the X account settings. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/account-session/customer-session-delete",
    shape: {},
  },
  {
    name: "twitter_user_login",
    path: "/twitter/user/user_login",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Logs in to X with a username and password (plus totp_secret if the account has 2FA) and stores the resulting session against the API key, so the authenticated-account reads and the write actions then act as that account. On success returns { ok, username, message }; it does not return the session cookies (auth_token/ct0 are minted and kept server-side, not sent back). Typical failures: bad_credentials (401), two_factor_required (400, needs totp_secret), captcha_required (422), acid_challenge (409, the login has to be confirmed from the account before a retry). Handles real account credentials. Cost: $0.0100 per call. Docs: https://docs.twitterapis.com/docs/reference/account-session/user-user-login",
    shape: {
      username: z.string().describe(
        "The X account username/handle (without the leading @). Some accounts also accept the login email here.",
      ),
      password: z.string().describe(
        "The X account password.",
      ),
      totp_secret: z.string().optional().describe(
        "The account's base32 two-factor (TOTP) secret. Required only when the account has 2FA enabled.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. HTTP or SOCKS proxy URL to perform the login through, in the form scheme://user:pass@host:port. Stored with the session and reused for its later requests. Absent: the login runs directly from the service's own IP. X treats datacenter logins as automated, so a residential proxy fares better.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. Browser User-Agent to mint and use the session with. Defaults to a current Chrome UA. A mismatch between the UA and the environment the account normally signs in from is itself a signal to X.",
      ),
    },
  },
  {
    name: "twitter_media_upload",
    path: "/twitter/media/upload",
    method: "POST",
    write: true,
    jsonBody: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Uploads an image to X and returns a media_id for a tweet's media_ids. Takes media_data as base64-encoded image bytes. Acts as the X session registered against the API key. Per-call auth_token and ct0 are also accepted. Returns ok and the media_id. Only base64 image data is supported over this JSON transport. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/media-upload",
    shape: {
      media_data: z.string().describe(
        "Base64-encoded image bytes to upload. Sent in the JSON request body.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_media_status",
    path: "/twitter/media/status",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Reports whether an uploaded media_id has finished processing on X. Video, GIF and large uploads are processed ASYNCHRONOUSLY: the upload returns a media_id immediately, but a tweet attaching it fails until X reports state 'succeeded'. Returns media_id, state ('pending', 'in_progress', 'succeeded' or 'failed'), check_after_secs (how long X asks to wait before the next status check), progress_percent, and an error object when state is 'failed'. Reads through the registered X session, the same one that performed the upload. Per-call auth_token and ct0 are also accepted. A READ: no daily write cap applies. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/write-actions/media-status",
    shape: {
      media_id: z.string().describe(
        "Numeric media id returned by the media upload, e.g. '1234567890123456789'.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_article_create",
    path: "/twitter/article/create",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Starts a new DRAFT article ('Note') as the authenticated account. No input required. Returns the new article's entity id and its full article object. Requires an authenticated X session with write capability behind the API key. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-create",
    shape: {
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_article_update_cover_media",
    path: "/twitter/article/update_cover_media",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Attaches an ALREADY-UPLOADED image as the cover of a DRAFT or PUBLISHED article, as the authenticated account. This does not upload: media_id is the id a prior media upload returned. Takes the article's entity id. Requires an authenticated X session with write capability behind the API key. Returns the updated article object with cover_media populated. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-update-cover-media",
    shape: {
      id: z.string().describe(
        "The article's entity id (e.g. 'ArticleEntity:1234567890123456789'), as returned when the article was created or listed.",
      ),
      media_id: z.string().describe(
        "The media id a prior media upload returned, for the image used as the cover.",
      ),
      media_category: z.string().optional().describe(
        "Optional. X's media category for the upload. Defaults to 'DraftTweetImage', which is what X's own article editor sends for a cover image.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_article_update_title",
    path: "/twitter/article/update_title",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Sets or replaces the title of a DRAFT or PUBLISHED article as the authenticated account. Takes the article's entity id and the new title. Requires an authenticated X session with write capability behind the API key. Returns the updated article object. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-update-title",
    shape: {
      id: z.string().describe(
        "The article's entity id (e.g. 'ArticleEntity:1234567890123456789'), as returned when the article was created or listed.",
      ),
      title: z.string().min(1).describe(
        "The new article title (non-empty).",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_article_update_content",
    path: "/twitter/article/update_content",
    method: "POST",
    write: true,
    jsonBody: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Replaces the body content of a DRAFT or PUBLISHED article as the authenticated account. Takes the article's entity id and content_state: Draft.js JSON ({ blocks: [...], entityMap: [...] }) built by the caller; blocks are forwarded with only the data, text, key, type, entityRanges and inlineStyleRanges fields (X rejects any other block field, depth included). Block types X accepts: unstyled, header-two, unordered-list-item, ordered-list-item, blockquote, atomic (a one-space block carrying an entity via entityRanges [{key, offset: 0, length: 1}]); inline styles Bold and Italic. Entity data is snake_case on INPUT and X returns it camelCase: TWEET (an embedded post) {tweet_id}; MEDIA (an inline image) {caption, entity_key, media_items: [{local_media_id, media_category: 'DraftTweetImage', media_id}]} with media_id from a prior media upload; DIVIDER {}; LINK {url} (a Mutable entity over a text range, not atomic); MARKDOWN {markdown} (tables). A wrong field is refused by X's schema and the call answers 422 with reason validation_failed and the offending path in detail. Requires an authenticated X session with write capability behind the API key. Returns the updated article object (content_state echoed camelCase, media_entities populated for MEDIA). Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-update-content",
    shape: {
      id: z.string().describe(
        "The article's entity id, as returned when the article was created or listed.",
      ),
      content_state: z.record(z.string(), z.unknown()).describe(
        "Draft.js content state object: { blocks: [...], entityMap: [...] } in the shape the X Article editor produces. entityMap is an ARRAY of {key: '0', value: {type, mutability, data}}; entity data keys are snake_case on input (tweet_id, media_items, local_media_id, media_category, media_id, entity_key). Unknown fields are refused by X (422, reason validation_failed, detail names the path).",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_article_publish",
    path: "/twitter/article/publish",
    method: "POST",
    write: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Publishes a DRAFT article as the authenticated account, transitioning it to Published and posting a REAL, PUBLIC announcement tweet that followers and anyone with the link can see. A consequential, hard-to-fully-undo action, unlike saving a draft: unpublishing reverts the article to Draft but LEAVES the announcement tweet up, and only deleting a published article both unpublishes it and removes the announcement tweet, by which time the content was public for however long it stayed up. Takes the article's entity id; audience and reply_control default to 'Everyone' when omitted; caption is an optional short (up to 256 characters) caption for the announcement tweet. Requires an authenticated X session with write capability behind the API key. Returns the updated (Published) article object. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-publish",
    shape: {
      id: z.string().describe(
        "The article's entity id, of an article currently in Draft.",
      ),
      audience: z.string().optional().describe(
        "Optional. Who can see the published article, e.g. 'Everyone'. Defaults to 'Everyone' when omitted.",
      ),
      reply_control: z.string().optional().describe(
        "Optional. Who can reply to the announcement tweet, e.g. 'Everyone'. Defaults to 'Everyone' when omitted.",
      ),
      caption: z.string().optional().describe(
        "Optional. Short caption text for the announcement tweet, up to 256 characters.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_article_unpublish",
    path: "/twitter/article/unpublish",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Reverts a PUBLISHED article back to Draft as the authenticated account. The announcement tweet the publish posted is LEFT IN PLACE and stays publicly visible; deleting the article is what removes that tweet. X refuses this with an 'invalid_lifecycle' error if the article is not currently Published. Requires an authenticated X session with write capability behind the API key. Returns the updated (Draft) article object. Cost: $0.0016 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-unpublish",
    shape: {
      id: z.string().describe(
        "The article's entity id, of an article currently Published.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_article_get",
    path: "/twitter/article/get",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Returns an article's full content (title, content_state, cover media, author, timestamps, public_url). Two mutually exclusive forms. PUBLIC: id or url of the article's announcement tweet; no registered session or per-call credentials needed, only the API key; PUBLISHED articles only. OWNER-ONLY: article_id (the article's own entity id); requires an authenticated session, and also reaches the account's own Drafts, which have no announcement tweet the public form could resolve. Returns 404 (article null) if not found, not visible, or (article_id form) not owned by the calling account. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-get",
    shape: {
      id: z.string().optional().describe(
        "Tweet/post numeric id (e.g. \"1789012345678901234\"). Exactly one of id or url is required.",
      ),
      url: z.string().optional().describe(
        "Full tweet URL, e.g. \"https://x.com/elonmusk/status/1789012345678901234\". Exactly one of id or url is required.",
      ),
      article_id: z.string().optional().describe(
        "OWNER-ONLY form. The article's own entity id (e.g. 'ArticleEntity:1234567890123456789', or the bare numeric rest_id). Requires an authenticated session. Exactly one of id, url, or article_id is required.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_article_list",
    path: "/twitter/article/list",
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Lists the authenticated account's own articles (drafts or published), most recent first. X exposes no combined view, so each call covers ONE lifecycle: lifecycle='published' lists published articles; omitted (or 'draft') lists drafts. Requires an authenticated X session behind the API key. Returns count, next_cursor (the cursor for the next page; null or absent means no more pages), and the page of article objects. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-list",
    shape: {
      lifecycle: z.enum(["draft","published"]).optional().describe(
        "Which lifecycle to list: 'draft' or 'published'. Defaults to 'draft' when omitted. X has no combined view; each lifecycle is listed separately.",
      ),
      count: z.number().int().min(1).max(100).optional().describe(
        "Max articles to return for this page, 1 to 100. Defaults to 20 when omitted.",
      ),
      cursor: z.string().optional().describe(
        "Opaque pagination cursor from a previous response's next_cursor field. Absent, the first page is returned; with it, the next page.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_article_delete",
    path: "/twitter/article/delete",
    method: "POST",
    write: true,
    destructive: true,
    headerArgs: ["auth_token","ct0","proxy_url","user_agent"],
    description:
      "Deletes an article as the authenticated account. A DRAFT is hard-deleted outright; a PUBLISHED article is unpublished first and then its announcement tweet is deleted too, so this fully removes a published article's public footprint, unlike unpublishing, which leaves the tweet up. Irreversible. lifecycle and tweet_id are optional fast-path hints from a prior create or list response: when omitted, the server resolves the lifecycle itself by scanning the account's own Draft then Published articles, which costs an extra round trip. Requires an authenticated X session with write capability behind the API key. Returns ok/deleted and the id targeted. Cost: $0.0008 per call. Docs: https://docs.twitterapis.com/docs/reference/articles/article-delete",
    shape: {
      id: z.string().describe(
        "The article's entity id, as returned when the article was created or listed.",
      ),
      lifecycle: z.enum(["draft","published"]).optional().describe(
        "Optional fast-path hint: 'draft' or 'published', when already known. Absent: the server resolves it (slower, one extra lookup).",
      ),
      tweet_id: z.string().optional().describe(
        "Optional fast-path hint: the announcement tweet id, meaningful only when lifecycle is 'published'. Absent: the server resolves it from the account's own article list.",
      ),
      auth_token: z.string().optional().describe(
        "Optional. The account's auth_token cookie; together with ct0, this call acts as that account. Sent out of band: as the x-auth-token request header on most endpoints, or inside the JSON request body on endpoints that take one. It is not sent as a query parameter, so it does not reach a URL or an access log.",
      ),
      ct0: z.string().optional().describe(
        "Optional. The account's ct0 cookie, paired with auth_token. Same transport as auth_token: the x-ct0 request header, or the JSON body on a body-taking endpoint. It is not sent as a query parameter.",
      ),
      proxy_url: z.string().optional().describe(
        "Optional. Residential proxy URL this call egresses through. X soft-blocks writes from datacenter IPs as automated. Honoured on write endpoints on its own; on a read endpoint it is honoured only when auth_token and ct0 are sent with it, otherwise the read leaves through the session's own egress. Sent as the x-proxy-url request header, or in the JSON body on a body-taking endpoint.",
      ),
      user_agent: z.string().optional().describe(
        "Optional. User-Agent string sent for this session. Sent as the x-user-agent request header, or in the JSON body on a body-taking endpoint.",
      ),
    },
  },
  {
    name: "twitter_monitor_create",
    path: "/twitter/monitor",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Starts watching an X account for new posts. Every new post from that handle is HMAC-signed and delivered to the account's registered webhook(s) on a shared poll interval. Monitor creation is account administration, not a metered read. Returns the new monitor's id, plus its normalized handle, status, and poll_interval_ms. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-post",
    shape: {
      handle: z.string().min(1).describe(
        "The X username to watch, without the leading @ (e.g. 'elonmusk').",
      ),
      webhook_ids: z.string().optional().describe(
        "Optional. Comma-separated webhook id(s) this monitor's deliveries are restricted to. Absent: delivery to every active webhook on the account (the default).",
      ),
      include_replies: z.string().optional().describe(
        "Optional boolean. true delivers the account's replies as well as its own posts, which is the default and what every monitor has done; false holds replies back and delivers only the account's own posts. A real boolean is required: the string \"false\" and the number 0 are rejected with a 400 rather than coerced, because coercing them would quietly give the opposite of what was typed, and the wrong answer here is invisible since it looks exactly like the account not having posted.",
      ),
      domain_filter: z.string().optional().describe(
        "Optional. A bare hostname ('example.com') or a full URL ('https://example.com/blog') that restricts delivery to only the new posts that link to that host or a subdomain of it (e.g. 'example.com' matches both example.com and blog.example.com). Normalized server-side: lowercased, scheme/path/query/fragment/leading www./trailing :port stripped. Absent: no filter, the default (every new post delivered). Rejected with a 400 if what remains after normalization is not a valid hostname shape. A post with no matching link is filtered out of delivery, not silently dropped: it still advances the monitor's cursor and counts toward the account's tweets_domain_filtered health metric.",
      ),
    },
  },
  {
    name: "twitter_monitor_list",
    path: "/twitter/monitor",
    description:
      "List every monitor on your account: id, subject (its from:<handle> query), kind, status ('active' or 'paused'), degraded flag, events_possibly_missed, webhook_ids restriction, and created_at. Takes no arguments. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-get",
    shape: {},
  },
  {
    name: "twitter_monitor_update",
    path: "/twitter/monitor/{id}",
    method: "POST",
    write: true,
    jsonBody: true,
    pathParams: ["id"],
    description:
      "Partially updates an existing monitor: pause or resume it via status, change which webhooks receive its events via webhook_ids, change or clear its domain_filter, or any combination in the same call (applied atomically). Resuming a paused monitor re-runs the same capacity and per-account cap checks as creating a new one, since it adds load back to the shared pool. All fields are optional; an omitted field stays unchanged. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-id-post",
    shape: {
      id: z.string().describe(
        "The monitor's id, as returned when it was created or listed.",
      ),
      status: z.enum(["active","paused"]).optional().describe(
        "'paused' pauses the monitor, 'active' resumes it. Absent: status unchanged.",
      ),
      webhook_ids: z.string().optional().describe(
        "Optional. Comma-separated webhook id(s) to restrict delivery to. An empty string clears the restriction back to 'deliver to every active webhook'. Absent: unchanged.",
      ),
      domain_filter: z.string().nullable().optional().describe(
        "Optional. A bare hostname or full URL to restrict delivery to, with the same shape and normalization as on monitor creation. An empty string (or null) clears an existing filter back to 'deliver every new post'. Absent: the current filter stays. Rejected with a 400 if a non-empty value does not normalize to a valid hostname.",
      ),
      include_replies: z.string().optional().describe(
        "Optional boolean. true delivers the account's replies as well as its own posts, false holds replies back and delivers only its own posts. Absent: unchanged. Same boolean-only validation as on monitor creation: a non-boolean is a 400 rather than a coercion.",
      ),
    },
  },
  {
    name: "twitter_monitor_delete",
    path: "/twitter/monitor/{id}",
    method: "DELETE",
    write: true,
    destructive: true,
    pathParams: ["id"],
    description:
      "Stops and removes a monitor by id. Irreversible: watching that handle again takes a new monitor. Delivery history referencing this monitor is retained, not cascade-deleted. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-id-delete",
    shape: {
      id: z.string().describe(
        "The monitor's id, as returned when it was created or listed.",
      ),
    },
  },
  {
    name: "twitter_monitor_health",
    path: "/twitter/monitor/{id}/health",
    pathParams: ["id"],
    description:
      "Returns one monitor's current status, degradation flag, poll interval, possibly-missed-event count, and cursor position (last_tweet_id, last_poll_at), for a health dashboard. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-id-health",
    shape: {
      id: z.string().describe(
        "The monitor's id, as returned when it was created or listed.",
      ),
    },
  },
  {
    name: "twitter_monitor_account_health",
    path: "/twitter/monitor/health",
    description:
      "Account-wide monitoring rollup in ONE call, with no monitor id: service status ('operational' or 'degraded'), active/paused/total counts across every monitor on the account, and pending/delivered/failed delivery counts from the last 24 hours. Takes no arguments. A key with zero monitors gets zeroed counts back, not an error. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-health",
    shape: {},
  },
  {
    name: "twitter_monitor_deliveries",
    path: "/twitter/monitor/deliveries",
    description:
      "Lists the most recent monitor delivery events across every monitor, most recent first: id, monitor_id, tweet_id, status, tweet_created_at, and the real measured latency (detected_lag_ms, from X's own post timestamp to enqueue; delivery_lag_ms, the separate queue-to-webhook-POST time; total_lag_ms). Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/monitor-deliveries",
    shape: {
      limit: z.number().int().min(1).max(200).optional().describe(
        "Max delivery events to return, 1 to 200. Defaults to 50 when omitted.",
      ),
      fields: z.string().optional().describe(
        "Optional. Comma-separated dotted field paths to keep in the response, applied to every object in the returned lists and to nested objects (e.g. \"id,text,author.username\"; a list name may prefix a path, \"tweets.id\"; a prefix that lands on an array applies to each element). Pagination and envelope keys (next_cursor, cursor, has_more, count, partial, error, message, reason) are kept regardless; every other top-level key not named is dropped.",
      ),
      compact: z.enum(["1","true"]).optional().describe(
        "Optional. \"1\" applies the built-in compact preset: ids, url, text, created_at, lang, engagement counts, the is_retweet/is_reply/is_quote flags, conversation ids, the author's id/username/name/followers_count/verification, and the quoted or retweeted tweet's id/url/author username. It trims only what it recognises and on its own does not reduce a body to {}. Combined with fields, only the named paths and the envelope keys remain.",
      ),
    },
  },
  {
    name: "twitter_x_user_stream_add_user",
    path: "/oapi/x_user_stream/add_user_to_monitor_tweet",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Compatibility endpoint with an x_user_stream-shaped request/response envelope: watches an X account for new posts, translated onto the same underlying monitor system. It exists for migrating an existing x_user_stream-shaped integration without a rewrite. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/oapi-x-user-stream-add-user-to-monitor-tweet",
    shape: {
      x_user_name: z.string().describe(
        "The X username to watch, without the @.",
      ),
    },
  },
  {
    name: "twitter_x_user_stream_remove_user",
    path: "/oapi/x_user_stream/remove_user_to_monitor_tweet",
    method: "POST",
    write: true,
    destructive: true,
    jsonBody: true,
    description:
      "Compatibility endpoint with an x_user_stream-shaped envelope: stops watching an account. Irreversible. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/oapi-x-user-stream-remove-user-to-monitor-tweet",
    shape: {
      id_for_user: z.string().describe(
        "The monitor id, as listed by the x_user_stream list endpoint; the same value as the monitor id elsewhere in the monitoring API.",
      ),
    },
  },
  {
    name: "twitter_x_user_stream_list_users",
    path: "/oapi/x_user_stream/get_user_to_monitor_tweet",
    description:
      "Compatibility endpoint with an x_user_stream-shaped envelope: lists every account currently tweet-monitored. Field mapping, not fabricated: x_user_id is null (this API stores no numeric Twitter user id) and is_monitor_profile is 0 (profile-change monitoring is not a capability this API has). Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/oapi-x-user-stream-get-user-to-monitor-tweet",
    shape: {},
  },
  {
    name: "twitter_monitor_webhook_create",
    path: "/twitter/webhook",
    method: "POST",
    write: true,
    jsonBody: true,
    description:
      "Registers an HTTPS endpoint to receive signed monitor events. The HMAC signing secret is returned ONLY in this response and cannot be retrieved again; it verifies the X-TwitterAPIs-Signature header on every delivery. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/webhook-post",
    shape: {
      url: z.string().min(1).describe(
        "Your https delivery endpoint, e.g. 'https://example.com/webhooks/twitterapis'. Private, loopback, link-local, and metadata IPs are refused, re-checked at every delivery, not just at registration.",
      ),
    },
  },
  {
    name: "twitter_monitor_webhook_list",
    path: "/twitter/webhook",
    description:
      "Lists every webhook registered on the account: id, url, status ('active' delivers, 'disabled' means the endpoint returned a 410 Gone and needs re-registering to reactivate), and created_at. The signing secret is not returned here; it is returned at creation alone. Takes no arguments. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/webhook-get",
    shape: {},
  },
  {
    name: "twitter_monitor_webhook_delete",
    path: "/twitter/webhook/{id}",
    method: "DELETE",
    write: true,
    destructive: true,
    pathParams: ["id"],
    description:
      "Soft-deletes a webhook by id: it stops receiving deliveries immediately and disappears from the webhook list, but delivery history referencing it is retained rather than cascade-deleted. Irreversible from the caller's side; resuming delivery takes a newly registered webhook. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/webhook-id",
    shape: {
      id: z.string().describe(
        "The webhook's id, as returned when it was created or listed.",
      ),
    },
  },
  {
    name: "twitter_monitor_webhook_test",
    path: "/twitter/webhook/{id}/test",
    method: "POST",
    write: true,
    pathParams: ["id"],
    description:
      "Sends one HMAC-signed test event to this webhook's URL right now and returns the outcome synchronously: delivered (true if the endpoint returned a 2xx within the delivery timeout), status_code, and error. Unlike a real monitor event, a test send is not queued, retried, or dead-lettered: it is a one-shot diagnostic of the endpoint and its signature verification. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/webhook-id-test",
    shape: {
      id: z.string().describe(
        "The webhook's id, as returned when it was created or listed.",
      ),
    },
  },
  {
    name: "twitter_monitor_webhook_redrive",
    path: "/twitter/webhook/{id}/redrive",
    method: "POST",
    write: true,
    jsonBody: true,
    pathParams: ["id"],
    description:
      "Replays deliveries that dead-lettered while the endpoint was down. A delivery is dead-lettered after it fails all 8 attempts across 21 minutes, so an outage longer than that window loses those events; this re-queues them with a full retry budget, oldest first. Bounded by default so a recovered endpoint is not flooded: max_age_hours defaults to 24 and limit to 100. Returns requeued and skipped_permanent. A delivery that died for a permanent reason (a 410 Gone, a deleted webhook, or a URL egress refused) is not replayed, because it would fail the same way and spend the budget again. Replayed events carry the same signature and payload as the original, so a receiver idempotent on the event id sees no duplicate effect. Returns 409 if the webhook is disabled, which happens after the endpoint answers 410 Gone; a disabled webhook has to be re-registered. Cost: Free per call. Docs: https://docs.twitterapis.com/docs/reference/monitoring/webhook-id-redrive",
    shape: {
      id: z.string().describe(
        "The webhook's id, as returned when it was created or listed.",
      ),
      max_age_hours: z.number().int().optional().describe(
        "Optional. How far back to look for dead-lettered deliveries, 1 to 168 hours. Defaults to 24.",
      ),
      limit: z.number().int().optional().describe(
        "Optional. Most deliveries to replay in one call, 1 to 1000, oldest first. Defaults to 100.",
      ),
    },
  },
];

// The query-string builder and the path-param substitution helper are
// hand-written logic, not catalog data, so they live in their own module and
// are re-exported here to keep this file's one import path.
export { buildQuery, resolvePathParams, MissingPathParamError } from "./query.js";
