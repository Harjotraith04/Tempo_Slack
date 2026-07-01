import { describe, expect, it } from "vitest";
import { buildAgentforceDescriptor, TEMPO_PERSONA } from "./descriptor.js";
import { TEMPO_TOOLS } from "../mcp/server/index.js";

describe("Agentforce descriptor", () => {
  it("packages every inbound MCP tool (never drifts from the server)", () => {
    const d = buildAgentforceDescriptor({ endpoint: "https://tempo.example.com/api/mcp/server" });
    expect(d.tools.map((t) => t.name).sort()).toEqual(TEMPO_TOOLS.map((t) => t.name).sort());
    for (const t of d.tools) expect(t.description.length).toBeGreaterThan(0);
  });

  it("carries the trust contract + the MCP connection", () => {
    const d = buildAgentforceDescriptor({ endpoint: "https://x/api/mcp/server" });
    expect(d.trust).toEqual({
      actsAsInitiatingUser: true,
      neverStoresRtsContent: true,
      humanInTheLoop: true,
    });
    expect(d.connection).toMatchObject({ type: "mcp", transport: "streamable-http", endpoint: "https://x/api/mcp/server", auth: "bearer-agent-token" });
    expect(d.instructions).toBe(TEMPO_PERSONA);
  });

  it("the persona states the three trust rules plainly", () => {
    const p = TEMPO_PERSONA.toLowerCase();
    expect(p).toContain("initiating user");
    expect(p).toContain("never store");
    expect(p).toContain("without the user");
  });
});
