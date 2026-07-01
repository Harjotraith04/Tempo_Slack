/**
 * Standalone inbound-MCP-server check — mirrors the other verify:* scripts.
 * Never imported by the app/tests, never in `npm test`/`npm run demo`, so it
 * can't break the zero-credential path. It enumerates the tools Tempo exposes
 * (always available — they're SDK-free) and reports whether the HTTP endpoint is
 * enabled + gated.
 *
 *   npm run verify:mcp-server
 */

import "dotenv/config";
import { config, isMcpServerEnabled } from "../src/config.js";
import { TEMPO_TOOLS } from "../src/platform/mcp/server/index.js";

function main() {
  console.log(`Tempo would expose ${TEMPO_TOOLS.length} MCP tools at /api/mcp/server:`);
  for (const t of TEMPO_TOOLS) console.log(`  • ${t.name} — ${t.description.slice(0, 72)}…`);

  if (!isMcpServerEnabled()) {
    console.log('\nInbound MCP server is OFF — set TEMPO_MCP_SERVER="on" to enable the endpoint.');
    process.exit(0);
  }

  const gated = config.mcp.server.token ? "bearer-token gated ✅" : "OPEN ⚠️  — set TEMPO_MCP_SERVER_TOKEN";
  console.log(`\nInbound MCP server is ENABLED (${gated}). Endpoint: /api/mcp/server (Streamable HTTP).`);
  process.exit(0);
}

main();
