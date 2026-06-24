// Dev-only smoke test (not published). Spawns the stdio server, runs the MCP
// handshake, calls tools/list, and asserts the full read-tool catalog is
// advertised with valid schemas. No network/API call is made.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn("node", ["src/index.js"], {
  cwd: root,
  env: { ...process.env, TWITTERAPIS_KEY: "smoke-test-key" },
  stdio: ["pipe", "pipe", "inherit"],
});

const responses = [];
let buf = "";
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) { try { responses.push(JSON.parse(line)); } catch {} }
  }
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } });

setTimeout(() => {
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
}, 600);

setTimeout(() => {
  const init = responses.find((r) => r.id === 1);
  const list = responses.find((r) => r.id === 2);
  const tools = list?.result?.tools || [];
  const initOk = !!init?.result?.serverInfo;
  const schemasOk = tools.every((t) => t.name && t.description && t.inputSchema?.type === "object");
  console.log(`initialize: ${initOk ? "ok" : "FAILED"} (${init?.result?.serverInfo?.name})`);
  console.log(`tools/list: ${tools.length} tools`);
  console.log("names:", tools.map((t) => t.name).join(", "));
  const pass = initOk && tools.length >= 15 && schemasOk;
  console.log(pass ? "SMOKE: PASS" : "SMOKE: FAIL");
  child.kill();
  process.exit(pass ? 0 : 1);
}, 1800);
