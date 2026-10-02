#!/usr/bin/env node
// feedback.test.mjs: the local draft queue behind twitter_feedback_send.
// No network: callEndpoint is a recorder. The queue lives in a temp dir via
// TWITTERAPIS_FEEDBACK_DIR so a run never touches the developer's real queue.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFeedbackHandler, queuePath, draftId, QUEUE_CAP } from "../src/feedback.js";

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) pass++;
  else { fail++; console.error("  FAIL:", name, detail); }
};

const dir = mkdtempSync(join(tmpdir(), "twapi-feedback-"));
const env = { TWITTERAPIS_FEEDBACK_DIR: dir };
const calls = [];
let nextResponse = () => ({ content: [{ type: "text", text: JSON.stringify({ id: "srv-1", status: "new" }) }] });
const callEndpoint = async (path, args, method, jsonBody) => {
  calls.push({ path, args, method, jsonBody });
  return nextResponse();
};
let lastError = null;
const tool = createFeedbackHandler({
  callEndpoint,
  version: "9.9.9",
  getClientInfo: () => ({ name: "claude-code", version: "2.1.259" }),
  getLastError: () => lastError,
  env,
});
const txt = (r) => r.content[0].text;
const queue = () => JSON.parse(readFileSync(queuePath(env), "utf8")).drafts;

// ── draft ──────────────────────────────────────────────────────────────────
{
  const r = await tool({ type: "bug", title: "thread 502 on deleted root", details: "- What happened: 502\n- Repro: x\n- Evidence: y", area: "tweet/thread" });
  check("draft is not an error", !r.isError, txt(r));
  check("draft says nothing was sent", /Nothing was sent/.test(txt(r)));
  check("draft made no network call", calls.length === 0);
  const q = queue();
  check("one draft on disk", q.length === 1);
  check("draft id is stable", q[0].id === draftId("bug", "thread 502 on deleted root"));
  check("client is filled from the handshake and version", q[0].client === "claude-code/2.1.259 via @twitterapis/mcp@9.9.9");
  check("evidence carries mcp_version", q[0].evidence.mcp_version === "9.9.9");
  check("area kept", q[0].area === "tweet/thread");
}
{
  // Redrafting the same issue replaces, never duplicates.
  const r = await tool({ type: "bug", title: "Thread 502 on deleted root ", details: "updated details" });
  check("redraft replaces", /replaced an earlier draft/.test(txt(r)));
  check("still one draft", queue().length === 1);
  check("details updated", queue()[0].details === "updated details");
}
{
  // The last failing call is attached only where the model left a gap.
  lastError = { tool: "twitter_tweet_thread", path: "/twitter/tweet/thread", status: 502, requestId: "req_9" };
  await tool({ type: "missing_capability", title: "no way to fetch a Space transcript", details: "d", evidence: { status: 418 } });
  const d = queue().find((x) => x.type === "missing_capability");
  check("evidence.tool filled from last error", d.evidence.tool === "twitter_tweet_thread");
  check("evidence.endpoint filled from last error", d.evidence.endpoint === "/twitter/tweet/thread");
  check("model-supplied evidence.status wins", d.evidence.status === 418);
  check("request_id filled", d.evidence.request_id === "req_9");
  lastError = null;
}
{
  const bad1 = await tool({ type: "rant", title: "t", details: "d" });
  check("bad type is an error", bad1.isError && /type is required/.test(txt(bad1)));
  const bad2 = await tool({ type: "idea", title: "", details: "d" });
  check("empty title is an error", bad2.isError && /title is required/.test(txt(bad2)));
  const bad3 = await tool({ type: "idea", title: "t", details: "" });
  check("empty details is an error", bad3.isError && /three labelled bullets/.test(txt(bad3)) && !/What the user said/.test(txt(bad3)));
  const bad4 = await tool({ type: "idea", title: "t", details: "d", evidence: { blob: "x".repeat(5000) } });
  check("oversized evidence is an error", bad4.isError && /4096/.test(txt(bad4)));
  check("rejections wrote nothing", queue().length === 2);
}

// ── list ───────────────────────────────────────────────────────────────────
{
  const r = await tool({ action: "list" });
  check("list names both drafts", /2 feedback draft\(s\) pending/.test(txt(r)) && /thread 502/i.test(txt(r)) && /Space transcript/.test(txt(r)));
  check("list makes no network call", calls.length === 0);
}

// ── send ───────────────────────────────────────────────────────────────────
{
  const noIds = await tool({ action: "send" });
  check("send without ids is an error", noIds.isError && /needs ids/.test(txt(noIds)));
  const unknown = await tool({ action: "send", ids: ["deadbeef"] });
  check("unknown id is an error", unknown.isError && /Unknown draft id/.test(txt(unknown)));
  check("no call for a refused send", calls.length === 0);

  const id = draftId("bug", "thread 502 on deleted root");
  const r = await tool({ action: "send", ids: [id] });
  check("send is not an error", !r.isError, txt(r));
  check("exactly one POST", calls.length === 1);
  check("posted to /feedback as JSON body", calls[0].path === "/feedback" && calls[0].method === "POST" && calls[0].jsonBody === true);
  check("body carries the draft fields", calls[0].args.type === "bug" && calls[0].args.details === "updated details" && calls[0].args.client.startsWith("claude-code/"));
  check("reports the server id", /srv-1/.test(txt(r)));
  check("sent draft left the queue", queue().length === 1 && queue()[0].type === "missing_capability");
}
{
  // A failed send keeps the draft.
  nextResponse = () => ({ isError: true, content: [{ type: "text", text: "HTTP 502 (upstream)" }] });
  const id = queue()[0].id;
  const r = await tool({ action: "send", ids: [id] });
  check("failed send is an error result", r.isError === true);
  check("failed send names the draft", new RegExp(id).test(txt(r)) && /stayed in the queue/.test(txt(r)));
  check("draft kept", queue().length === 1);
  nextResponse = () => ({ content: [{ type: "text", text: "{}" }] });
}

// ── discard ────────────────────────────────────────────────────────────────
{
  const id = queue()[0].id;
  const r = await tool({ action: "discard", ids: [id] });
  check("discard confirms", /Discarded 1/.test(txt(r)));
  check("queue empty", queue().length === 0);
  const empty = await tool({ action: "list" });
  check("empty list says so", /No feedback drafts pending/.test(txt(empty)));
}

// ── cap ────────────────────────────────────────────────────────────────────
{
  for (let i = 0; i < QUEUE_CAP; i++) await tool({ type: "idea", title: `idea ${i}`, details: "d" });
  check(`queue holds ${QUEUE_CAP}`, queue().length === QUEUE_CAP);
  const over = await tool({ type: "idea", title: "one too many", details: "d" });
  check("cap refuses the eleventh", over.isError && /already holds/.test(txt(over)));
  check("cap did not write", queue().length === QUEUE_CAP);
  const bad = await tool({ action: "explode" });
  check("unknown action is an error", bad.isError);
}


// ── review fixes (2026-09-04) ─────────────────────────────────────────────
{
  // Junk entries in the file are skipped, never thrown on.
  await tool({ action: "discard", ids: queue().map((d) => d.id) });
  await tool({ type: "bug", title: "real one", details: "d" });
  const raw = JSON.parse(readFileSync(queuePath(env), "utf8"));
  raw.drafts.push(null, { id: "half" }, 7);
  writeFileSync(queuePath(env), JSON.stringify(raw));
  const l = await tool({ action: "list" });
  check("list survives junk entries", !l.isError && /1 feedback draft/.test(txt(l)), txt(l));
  const d = await tool({ type: "idea", title: "another", details: "d" });
  check("draft survives junk entries", !d.isError, txt(d));
  check("junk dropped on the next write", JSON.parse(readFileSync(queuePath(env), "utf8")).drafts.every((x) => x && typeof x.id === "string"));
}
{
  // Duplicate ids post once; each success is persisted before the next send.
  calls.length = 0;
  const ids = queue().map((d) => d.id);
  let n = 0;
  nextResponse = () => (++n === 1
    ? { content: [{ type: "text", text: '{"id":"srv-a"}' }] }
    : { isError: true, content: [{ type: "text", text: "HTTP 502" }] });
  const r = await tool({ action: "send", ids: [ids[0], ids[0], ids[1]] });
  check("duplicate id posts once", calls.filter((c) => c.args.title === "real one").length === 1);
  check("second draft failed and stayed", queue().length === 1 && queue()[0].id === ids[1], txt(r));
  nextResponse = () => ({ content: [{ type: "text", text: "{}" }] });
  await tool({ action: "discard", ids: queue().map((d) => d.id) });
}
{
  // Stale or self-referential lastError is not attached; a fresh one is.
  lastError = { tool: "twitter_user_info", path: "/twitter/user/info", status: 500, ts: Date.now() - 11 * 60 * 1000 };
  await tool({ type: "bug", title: "stale check", details: "d" });
  check("stale lastError ignored", queue()[0].evidence.tool === undefined);
  lastError = { path: "/feedback", method: "POST", status: 502, ts: Date.now() };
  await tool({ type: "bug", title: "self check", details: "d" });
  check("a failed send is not evidence", queue().find((d) => d.title === "self check").evidence.endpoint === undefined);
  lastError = { tool: "twitter_user_info", path: "/twitter/user/info", status: 500, ts: Date.now() };
  await tool({ type: "bug", title: "fresh check", details: "d" });
  check("fresh lastError attached", queue().find((d) => d.title === "fresh check").evidence.tool === "twitter_user_info");
  lastError = null;
  await tool({ action: "discard", ids: queue().map((d) => d.id) });
}
{
  // client is capped at what billing accepts.
  const longTool = createFeedbackHandler({ callEndpoint, version: "9.9.9", getClientInfo: () => ({ name: "x".repeat(200), version: "1" }), env });
  await longTool({ type: "idea", title: "long client", details: "d" });
  check("client capped at 120", queue()[0].client.length === 120);
  await tool({ action: "discard", ids: queue().map((d) => d.id) });
}
{
  // Two processes drafting into one queue lose nothing.
  const dir2 = mkdtempSync(join(tmpdir(), "twapi-feedback-race-"));
  const code = `import("${new URL("../src/feedback.js", import.meta.url).pathname}").then(async ({ createFeedbackHandler }) => { const t = createFeedbackHandler({ callEndpoint: async () => ({}), version: "0", env: { TWITTERAPIS_FEEDBACK_DIR: process.argv[1] } }); for (let i = 0; i < 5; i++) await t({ type: "idea", title: process.argv[2] + i, details: "d" }); });`;
  const procs = ["A-", "B-"].map((tag) => spawnSync(process.execPath, ["--input-type=module", "-e", code, dir2, tag], { encoding: "utf8" }));
  const p2 = spawnSync(process.execPath, ["--input-type=module", "-e", code, dir2, "C-"], { encoding: "utf8" });
  const survivors = JSON.parse(readFileSync(join(dir2, "feedback-queue.json"), "utf8")).drafts.map((d) => d.title).sort();
  check("sequential writers keep all drafts", survivors.length === 10 && survivors.filter((t) => t.startsWith("A-")).length === 5, survivors.join(","));
  // True concurrency: two writers started together.
  const dir3 = mkdtempSync(join(tmpdir(), "twapi-feedback-race2-"));
  const { spawn } = await import("node:child_process");
  await Promise.all(["A-", "B-"].map((tag) => new Promise((res) => spawn(process.execPath, ["--input-type=module", "-e", code, dir3, tag], { stdio: "ignore" }).on("exit", res))));
  const s3 = JSON.parse(readFileSync(join(dir3, "feedback-queue.json"), "utf8")).drafts.map((d) => d.title);
  check("concurrent writers keep all drafts (10 of 10)", s3.length === 10, s3.join(","));
  rmSync(dir2, { recursive: true, force: true }); rmSync(dir3, { recursive: true, force: true });
  void procs; void p2;
}

// ── send must not hold the lock across the network ────────────────────────
{
  const dir4 = mkdtempSync(join(tmpdir(), "twapi-feedback-slow-send-"));
  const env4 = { TWITTERAPIS_FEEDBACK_DIR: dir4 };
  const q4 = () => JSON.parse(readFileSync(queuePath(env4), "utf8")).drafts.map((d) => d.title);
  const other = createFeedbackHandler({ callEndpoint: async () => { throw new Error("other never sends"); }, version: "9.9.9", getClientInfo: () => ({ name: "b", version: "1" }), getLastError: () => null, env: env4 });
  let midSendDraft = null;
  let duringSecond = null;
  let calls4 = 0;
  const slow = createFeedbackHandler({
    callEndpoint: async () => {
      calls4++;
      if (calls4 === 1) {
        // While the FIRST send is on the network, another process drafts. With the
        // lock held across the call this either times out (3s wait) or, past
        // LOCK_STALE_MS, reclaims the lock and is overwritten by the sender.
        midSendDraft = await other({ type: "idea", title: "landed mid-send", details: "- What happened: x\n- Repro: z\n- Evidence: w" });
      }
      if (calls4 === 2) duringSecond = q4();
      return { content: [{ type: "text", text: JSON.stringify({ id: `srv-${calls4}` }) }] };
    },
    version: "9.9.9", getClientInfo: () => ({ name: "a", version: "1" }), getLastError: () => null, env: env4,
  });
  await slow({ type: "bug", title: "first", details: "- What happened: 1\n- Repro: 3\n- Evidence: 4" });
  await slow({ type: "bug", title: "second", details: "- What happened: 1\n- Repro: 3\n- Evidence: 4" });
  const ids4 = JSON.parse(readFileSync(queuePath(env4), "utf8")).drafts.map((d) => d.id);
  const r4 = await slow({ action: "send", ids: ids4 });
  check("slow send is not an error", !r4.isError, txt(r4));
  check("a draft made during the send is accepted, not refused as locked", midSendDraft && !midSendDraft.isError, midSendDraft && txt(midSendDraft));
  check("that draft survives the sender's writes", q4().includes("landed mid-send"), q4().join(","));
  check("both sent drafts left the queue", !q4().includes("first") && !q4().includes("second"), q4().join(","));
  check("the first draft was already off disk while the second send was in flight", Array.isArray(duringSecond) && !duringSecond.includes("first") && duringSecond.includes("second"), JSON.stringify(duringSecond));
  check("pending count reports the survivor", /1 draft\(s\) still pending/.test(txt(r4)), txt(r4));
  rmSync(dir4, { recursive: true, force: true });
}

// ── a posted report whose draft cannot be removed is never re-sendable ─────
{
  const dir5 = mkdtempSync(join(tmpdir(), "twapi-feedback-stuck-"));
  const env5 = { TWITTERAPIS_FEEDBACK_DIR: dir5 };
  const lockDir = `${queuePath(env5)}.lock`;
  const { mkdirSync: mk } = await import("node:fs");
  let posts5 = 0;
  const stuck = createFeedbackHandler({
    callEndpoint: async () => {
      posts5++;
      // A foreign holder takes the lock while we are on the network and keeps it
      // past LOCK_WAIT_MS, so the per-success re-take cannot succeed.
      mk(lockDir, { recursive: true });
      return { content: [{ type: "text", text: JSON.stringify({ id: "srv-stuck" }) }] };
    },
    version: "9.9.9", getClientInfo: () => ({ name: "a", version: "1" }), getLastError: () => null, env: env5,
  });
  await stuck({ type: "bug", title: "stuck one", details: "- What happened: 1\n- Repro: 3\n- Evidence: 4" });
  const id5 = JSON.parse(readFileSync(queuePath(env5), "utf8")).drafts[0].id;
  const t0 = Date.now();
  const r5 = await stuck({ action: "send", ids: [id5] });
  const dt = Date.now() - t0;
  rmSync(lockDir, { recursive: true, force: true });
  check("posted once even though the re-take failed", posts5 === 1);
  check("the send is reported as a success, not an error", !r5.isError, txt(r5));
  check("the server id is still reported", /srv-stuck/.test(txt(r5)), txt(r5));
  check("the caller is told not to resend and to discard", /WERE posted/.test(txt(r5)) && new RegExp(id5).test(txt(r5)) && /discard/.test(txt(r5)), txt(r5));
  check("waited for the lock before giving up", dt >= 2500, String(dt));
  rmSync(dir5, { recursive: true, force: true });
}

rmSync(dir, { recursive: true, force: true });
console.log(`feedback: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
