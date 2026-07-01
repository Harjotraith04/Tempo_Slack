/**
 * Verifies the live MCP outbound wiring (src/platform/mcp/*) against real MCP
 * servers. Standalone — never imported by app.ts/orchestrator/tests, and NOT
 * wired into `npm test`/`npm run demo`, so it can never break the
 * zero-credential path.
 *
 *   npm run verify:mcp
 *
 * With TEMPO_MCP != "live" (or no server URLs configured) this prints a clear
 * "skipped" message and exits 0 (safe to run by accident, including in CI).
 * With a live config it connects to each configured server and LISTS its tools
 * (non-destructive — it never creates a real event/task) and reports whether the
 * tool name Tempo is configured to call is actually exposed by that server, so
 * the mapping in live.ts can be checked against the real tool surface.
 */

import { config, isLiveMcp } from "../src/config.js";

interface Target {
  label: string;
  url: string | undefined;
  token: string | undefined;
  tool: string;
  name: string;
}

function targets(): Target[] {
  const m = config.mcp;
  return [
    { label: "calendar", url: m.calendarUrl, token: m.calendarToken, tool: m.calendarTool, name: "tempo-calendar" },
    { label: "tasks", url: m.tasksUrl, token: m.tasksToken, tool: m.tasksTool, name: "tempo-tasks" },
  ];
}

async function listTools(t: Target): Promise<string[]> {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const headers = t.token ? { Authorization: `Bearer ${t.token}` } : undefined;
  const transport = new StreamableHTTPClientTransport(new URL(t.url!), {
    requestInit: headers ? { headers } : undefined,
  });
  const client = new Client({ name: t.name, version: "1.0.0" });
  await client.connect(transport);
  const res = (await client.listTools()) as { tools?: { name: string }[] };
  await client.close?.();
  return (res.tools ?? []).map((x) => x.name);
}

async function main(): Promise<void> {
  const configured = targets().filter((t) => t.url);
  if (!isLiveMcp() || configured.length === 0) {
    console.log(
      "Live MCP verification skipped — TEMPO_MCP is not \"live\" or no server URLs are configured.\n" +
        "This is expected for the zero-credential demo. To verify against real MCP servers, set\n" +
        "TEMPO_MCP=live and TEMPO_MCP_CALENDAR_URL / TEMPO_MCP_TASKS_URL (and optional _TOKEN), then\n" +
        "re-run `npm run verify:mcp`.",
    );
    process.exit(0);
  }

  let anyMissing = false;
  for (const t of configured) {
    console.log(`\n[${t.label}] connecting to ${t.url} …`);
    try {
      const tools = await listTools(t);
      console.log(`  → ${tools.length} tools exposed: ${tools.join(", ") || "(none)"}`);
      const present = tools.includes(t.tool);
      console.log(`  → configured tool "${t.tool}" ${present ? "IS" : "is NOT"} exposed by the server.`);
      if (!present) anyMissing = true;
    } catch (err) {
      anyMissing = true;
      console.error(`  → connection/list failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    anyMissing
      ? "\nOne or more servers didn't expose the configured tool — set TEMPO_MCP_*_TOOL to a real\n" +
          "tool name from the list above, or adjust the argument/result mapping in src/platform/mcp/live.ts."
      : "\nAll configured servers expose their tool. The live outbound path is wired correctly.",
  );
}

main().catch((err) => {
  console.error("Live MCP verification failed:", err);
  process.exit(1);
});
