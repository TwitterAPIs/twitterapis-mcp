// Human-readable titles and MCP ToolAnnotations (spec 2025-06-18) for every
// tool in the catalog, keyed by tool name.
//
// Hand-authored, not generated: the hints are judgements about what a call does
// to the world, which the REST contract does not encode. test/annotations.test.mjs
// fails when a catalog tool has no row here, when a row names a tool the catalog
// no longer has, or when a row is missing any of the five fields, so a new tool
// cannot ship without being classified.
//
// How each hint is chosen:
//   readOnlyHint     true for a GET that changes nothing anywhere.
//   destructiveHint  true when the call deletes, unpublishes, removes, unfollows,
//                    or overwrites existing state (a profile field, an image, a
//                    draft body, a stored session, a monitor's settings). False
//                    for additive writes and for every read.
//   idempotentHint   true when repeating the identical call has no further effect
//                    (every read, a set-to-a-fixed-value update, a like or follow
//                    that is already in place, a delete of an id). False when a
//                    repeat creates something new or sends something again.
//   openWorldHint    true when the call reaches X or another endpoint outside this
//                    service. False for tools that only read or change this
//                    service's own records: the account, billing, feedback,
//                    monitor and webhook configuration.

// Shorthand rows: [title, readOnly, destructive, idempotent, openWorld].
const READ_X = (title) => [title, true, false, true, true];
const READ_OWN = (title) => [title, true, false, true, false];

const ROWS = {
  // Search and users
  twitter_advanced_search: READ_X("Advanced Tweet Search"),
  twitter_user_search: READ_X("Search Users"),
  twitter_user_info: READ_X("Get User Profile"),
  twitter_user_info_by_id: READ_X("Get User Profile by ID"),
  twitter_user_status: READ_X("Check Account Status"),
  twitter_user_about: READ_X("Get Account About Details"),
  twitter_user_about_batch: READ_X("Get Account About Details in Bulk"),
  twitter_user_affiliates: READ_X("Get Affiliated Accounts"),
  twitter_check_follow_relationship: READ_X("Check Follow Relationship"),
  twitter_check_follow_relationship_batch: READ_X("Check Follow Relationships in Bulk"),
  twitter_audience_summary: READ_X("Summarize Audience by Country"),
  twitter_user_tweets: READ_X("Get User Tweets"),
  twitter_user_tweets_and_replies: READ_X("Get User Tweets and Replies"),
  twitter_user_tweets_complete: READ_X("Get All Recent User Tweets"),
  twitter_user_media: READ_X("Get User Media"),
  twitter_user_mentions: READ_X("Get User Mentions"),
  twitter_user_likes: READ_X("Get User Likes"),
  twitter_user_followers: READ_X("Get Followers"),
  twitter_user_following: READ_X("Get Following"),
  twitter_user_followers_v2: READ_X("Get Followers (v2)"),
  twitter_user_following_v2: READ_X("Get Following (v2)"),
  twitter_user_verified_followers: READ_X("Get Verified Followers"),
  twitter_followers_you_know: READ_X("Get Followers You Know"),

  // Tweets
  twitter_tweet_detail: READ_X("Get Tweet"),
  twitter_tweet_replies: READ_X("Get Tweet Replies"),
  twitter_tweet_replies_complete: READ_X("Get All Tweet Replies"),
  twitter_tweet_thread: READ_X("Get Tweet Thread"),
  twitter_tweet_retweeters: READ_X("Get Retweeters"),
  twitter_tweet_quotes: READ_X("Get Quote Tweets"),

  // Lists, Spaces, communities, trends
  twitter_list_members: READ_X("Get List Members"),
  twitter_list_followers: READ_X("Get List Followers"),
  twitter_list_tweets: READ_X("Get List Tweets"),
  twitter_list_timeline: READ_X("Get List Timeline"),
  twitter_spaces_info: READ_X("Get Space Details"),
  twitter_community_search: READ_X("Search Communities"),
  twitter_community_info: READ_X("Get Community"),
  twitter_community_about: READ_X("Get Community About Details"),
  twitter_community_members: READ_X("Get Community Members"),
  twitter_community_moderators: READ_X("Get Community Moderators"),
  twitter_community_tweets: READ_X("Get Community Tweets"),
  twitter_community_memberships: READ_X("Get Community Memberships"),
  twitter_trends: READ_X("Get Trends"),
  twitter_trends_locations: READ_X("List Trend Locations"),

  // X's built-in AI assistant. A chat starts a conversation on the account, so
  // it is a non-idempotent write; the eligibility check is a plain read.
  twitter_grok_chat: ["Ask the X AI Assistant", false, false, false, true],
  twitter_grok_config: READ_X("Check X AI Assistant Access"),

  // This service's own account, billing and feedback
  twitter_account_me: READ_OWN("Get Account Details"),
  twitter_account_payments: READ_OWN("Get Payment History"),
  // Drafts to a local queue and posts named drafts to this service. Its only
  // removal ("discard") drops unsent local drafts the caller made, so it is not
  // marked destructive.
  twitter_feedback_send: ["Send Product Feedback", false, false, false, false],
  twitter_feedback_get: READ_OWN("Get Feedback Report"),
  twitter_feedback_list: READ_OWN("List Feedback Reports"),

  // Authenticated-account reads
  twitter_home_timeline: READ_X("Get Home Timeline"),
  twitter_bookmarks: READ_X("Get Bookmarks"),
  twitter_blocking: READ_X("Get Blocked Accounts"),
  twitter_muting: READ_X("Get Muted Accounts"),
  twitter_bookmark_search: READ_X("Search Bookmarks"),
  twitter_bookmark_folders: READ_X("List Bookmark Folders"),
  twitter_bookmark_folder_timeline: READ_X("Get Bookmark Folder Tweets"),
  twitter_dm_list: READ_X("List Direct Message Conversations"),
  twitter_dm_conversation: READ_X("Get Direct Message Conversation"),

  // Writes as the authenticated account
  twitter_dm_send: ["Send Direct Message", false, false, false, true],
  twitter_create_tweet: ["Post Tweet", false, false, false, true],
  twitter_delete_tweet: ["Delete Tweet", false, true, true, true],
  twitter_update_profile: ["Update Profile", false, true, true, true],
  twitter_update_avatar: ["Update Profile Image", false, true, true, true],
  twitter_update_banner: ["Update Profile Banner", false, true, true, true],
  twitter_draft_create: ["Create Draft Tweet", false, false, false, true],
  twitter_draft_edit: ["Replace Draft Tweet", false, true, true, true],
  twitter_draft_delete: ["Delete Draft Tweet", false, true, true, true],
  twitter_draft_list: READ_X("List Draft Tweets"),
  twitter_scheduled_create: ["Schedule Tweet", false, false, false, true],
  twitter_scheduled_delete: ["Delete Scheduled Tweet", false, true, true, true],
  twitter_scheduled_list: READ_X("List Scheduled Tweets"),
  twitter_favorite_tweet: ["Like Tweet", false, false, true, true],
  twitter_unfavorite_tweet: ["Unlike Tweet", false, true, true, true],
  twitter_retweet: ["Retweet", false, false, true, true],
  twitter_unretweet: ["Undo Retweet", false, true, true, true],
  twitter_bookmark_tweet: ["Bookmark Tweet", false, false, true, true],
  twitter_unbookmark_tweet: ["Remove Bookmark", false, true, true, true],
  twitter_follow_user: ["Follow User", false, false, true, true],
  twitter_unfollow_user: ["Unfollow User", false, true, true, true],
  twitter_list_add_member: ["Add List Member", false, false, true, true],
  twitter_list_remove_member: ["Remove List Member", false, true, true, true],
  twitter_list_create: ["Create List", false, false, false, true],

  // X session linking. Registering replaces any stored session and validates it
  // live on X; a password login mints a fresh session on X every time.
  twitter_customer_session: ["Link X Session", false, true, true, true],
  twitter_customer_session_status: READ_OWN("Get Linked X Session"),
  twitter_customer_session_delete: ["Unlink X Session", false, true, true, false],
  twitter_user_login: ["Log In to X", false, true, false, true],

  // Media
  twitter_media_upload: ["Upload Media", false, false, false, true],
  twitter_media_status: READ_X("Check Media Processing Status"),

  // Articles
  twitter_article_create: ["Create Article", false, false, false, true],
  twitter_article_update_cover_media: ["Set Article Cover Image", false, true, true, true],
  twitter_article_update_title: ["Set Article Title", false, true, true, true],
  twitter_article_update_content: ["Replace Article Content", false, true, true, true],
  twitter_article_publish: ["Publish Article", false, false, false, true],
  twitter_article_unpublish: ["Unpublish Article", false, true, true, true],
  twitter_article_get: READ_X("Get Article"),
  twitter_article_list: READ_X("List Articles"),
  twitter_article_delete: ["Delete Article", false, true, true, true],

  // Monitoring: configuration lives in this service. Webhook test and redrive
  // POST to the caller's own endpoint, which is outside this service.
  twitter_monitor_create: ["Create Monitor", false, false, false, false],
  twitter_monitor_list: READ_OWN("List Monitors"),
  twitter_monitor_update: ["Update Monitor", false, true, true, false],
  twitter_monitor_delete: ["Delete Monitor", false, true, true, false],
  twitter_monitor_health: READ_OWN("Get Monitor Health"),
  twitter_monitor_account_health: READ_OWN("Get Monitoring Overview"),
  twitter_monitor_deliveries: READ_OWN("List Monitor Deliveries"),
  twitter_x_user_stream_add_user: ["Watch Account (Stream Format)", false, false, false, false],
  twitter_x_user_stream_remove_user: ["Stop Watching Account (Stream Format)", false, true, true, false],
  twitter_x_user_stream_list_users: READ_OWN("List Watched Accounts (Stream Format)"),
  twitter_monitor_webhook_create: ["Create Webhook", false, false, false, false],
  twitter_monitor_webhook_list: READ_OWN("List Webhooks"),
  twitter_monitor_webhook_delete: ["Delete Webhook", false, true, true, false],
  twitter_monitor_webhook_test: ["Send Webhook Test Event", false, false, false, true],
  twitter_monitor_webhook_redrive: ["Redeliver Failed Webhook Events", false, false, false, true],
};

/** name -> { title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint } */
export const TOOL_ANNOTATIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(ROWS).map(([name, [title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint]]) => [
      name,
      Object.freeze({ title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint }),
    ]),
  ),
);

/**
 * The annotations for one tool. Throws for a tool with no row, so a catalog
 * entry added without a classification fails at server construction rather
 * than registering with guessed hints.
 */
export function annotationsFor(name) {
  const row = Object.prototype.hasOwnProperty.call(TOOL_ANNOTATIONS, name) ? TOOL_ANNOTATIONS[name] : null;
  if (!row) throw new Error(`[twitterapis-mcp] tool ${name} has no title or annotation hints in src/annotations.js`);
  return { ...row };
}
